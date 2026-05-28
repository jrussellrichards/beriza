-- Berisa Platform v3 - capacidades críticas del plan comercial
-- Cubre: ingestión recurrente, trazabilidad de fuentes, multi-tenant, alertas,
-- BOM, gobierno de datos personales y métricas ROI.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

-- 1) Multi-tenant SaaS
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  tax_id TEXT,
  plan TEXT NOT NULL DEFAULT 'pilot' CHECK (plan IN ('pilot','starter','professional','enterprise','internal')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','cancelled')),
  billing_email TEXT,
  monthly_price_usd NUMERIC NOT NULL DEFAULT 0,
  trial_ends_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_name_unique ON tenants(lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_name_exact_unique ON tenants(name);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_role TEXT NOT NULL DEFAULT 'member' CHECK (tenant_role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_limits (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_saved_alerts INTEGER NOT NULL DEFAULT 10,
  max_monthly_exports INTEGER NOT NULL DEFAULT 20,
  api_enabled BOOLEAN NOT NULL DEFAULT false,
  contact_visibility BOOLEAN NOT NULL DEFAULT false,
  bom_enabled BOOLEAN NOT NULL DEFAULT true,
  roi_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants(name, legal_name, plan, status, monthly_price_usd)
VALUES ('Berisa Internal', 'Berisa Inteligencia Comercial', 'internal', 'active', 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO tenant_limits(tenant_id, max_users, max_saved_alerts, max_monthly_exports, api_enabled, contact_visibility, bom_enabled, roi_enabled)
SELECT id, 50, 100, 500, true, true, true, true FROM tenants WHERE name='Berisa Internal'
ON CONFLICT (tenant_id) DO NOTHING;

-- 2) Trazabilidad de fuentes y licencias
CREATE TABLE IF NOT EXISTS ingestion_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'public_registry' CHECK (source_type IN ('public_registry','licensed_dataset','client_upload','manual_research','partner_api','internal')),
  base_url TEXT,
  license_name TEXT NOT NULL DEFAULT 'no_definida',
  license_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (license_status IN ('approved','pending_review','restricted','expired','not_allowed')),
  terms_url TEXT,
  allowed_use TEXT NOT NULL DEFAULT 'Uso interno y validación comercial preliminar hasta revisión legal.',
  refresh_interval_hours INTEGER NOT NULL DEFAULT 168,
  retention_days INTEGER NOT NULL DEFAULT 730,
  enabled BOOLEAN NOT NULL DEFAULT true,
  requires_human_review BOOLEAN NOT NULL DEFAULT true,
  last_success_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ingestion_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed','skipped')),
  mode TEXT NOT NULL DEFAULT 'scheduled' CHECK (mode IN ('scheduled','manual','seed','api')),
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_upserted INTEGER NOT NULL DEFAULT 0,
  records_rejected INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ingestion_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  record_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_updated_at TIMESTAMPTZ,
  valid_from DATE,
  valid_until DATE,
  license_status TEXT NOT NULL DEFAULT 'pending_review',
  data_quality_score INTEGER NOT NULL DEFAULT 50 CHECK (data_quality_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS project_sources (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_record_id UUID NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES ingestion_sources(id) ON DELETE CASCADE,
  field_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_source_records_hash ON source_records(record_hash);
CREATE INDEX IF NOT EXISTS idx_project_sources_project ON project_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs(source_id, started_at DESC);

-- Fuentes base. No implica que todas estén habilitadas legalmente para uso comercial.
INSERT INTO ingestion_sources(source_key, name, source_type, base_url, license_name, license_status, allowed_use, refresh_interval_hours, requires_human_review, next_run_at)
VALUES
 ('manual_seed', 'Base inicial sanitizada Berisa', 'internal', NULL, 'Dataset interno sanitizado', 'approved', 'Carga inicial de demostración y piloto.', 720, true, now()),
 ('seia', 'SEIA / Expedientes ambientales', 'public_registry', 'https://seia.sea.gob.cl', 'Revisar términos vigentes antes de uso comercial', 'pending_review', 'Consulta y validación individual. Requiere revisión legal para extracción recurrente.', 24, true, now()),
 ('mercado_publico', 'Mercado Público', 'public_registry', 'https://www.mercadopublico.cl', 'Revisar términos vigentes antes de uso comercial', 'pending_review', 'Consulta de licitaciones públicas con trazabilidad de fuente.', 24, true, now()),
 ('municipal', 'Permisos municipales', 'public_registry', NULL, 'Variable por municipio', 'pending_review', 'Uso condicionado a disponibilidad y reglas de cada municipio.', 168, true, now()),
 ('licensed_dataset', 'Base licenciada / partner', 'licensed_dataset', NULL, 'Contrato requerido', 'restricted', 'No habilitar sin contrato o licencia documentada.', 168, true, NULL)
ON CONFLICT (source_key) DO UPDATE SET
  name=excluded.name,
  source_type=excluded.source_type,
  base_url=excluded.base_url,
  license_name=excluded.license_name,
  license_status=excluded.license_status,
  allowed_use=excluded.allowed_use,
  refresh_interval_hours=excluded.refresh_interval_hours,
  requires_human_review=excluded.requires_human_review;

-- 3) BOM y demanda estimada con supuestos trazables
CREATE TABLE IF NOT EXISTS bom_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  factor_per_musd NUMERIC NOT NULL CHECK (factor_per_musd >= 0),
  min_quantity NUMERIC NOT NULL DEFAULT 0,
  max_quantity NUMERIC,
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  source_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sector, item_code)
);

CREATE TABLE IF NOT EXISTS project_bom_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  calculation_version TEXT NOT NULL DEFAULT 'v1-rule-based',
  investment_musd NUMERIC,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','rejected')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_project ON project_bom_estimates(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_tenant ON project_bom_estimates(tenant_id, created_at DESC);

INSERT INTO bom_assumptions(sector, item_code, item_name, unit, factor_per_musd, min_quantity, max_quantity, confidence, source_note, status)
VALUES
 ('Energía', 'CONCRETE_M3', 'Hormigón estimado', 'm3', 85, 0, NULL, 35, 'Supuesto preliminar interno; debe calibrarse con proyectos comparables antes de cotizar.', 'active'),
 ('Energía', 'STEEL_T', 'Acero estructural / armaduras estimado', 't', 12, 0, NULL, 30, 'Supuesto preliminar para prefactibilidad comercial.', 'active'),
 ('Minería', 'CONCRETE_M3', 'Hormigón estimado', 'm3', 120, 0, NULL, 40, 'Supuesto preliminar sector minería; requiere validación técnica por tipo de faena.', 'active'),
 ('Minería', 'EARTHWORK_M3', 'Movimiento de tierra estimado', 'm3', 1650, 0, NULL, 35, 'Supuesto preliminar de oportunidad, no apto para presupuesto contractual.', 'active'),
 ('Vialidad y Transporte', 'CONCRETE_M3', 'Hormigón estimado', 'm3', 140, 0, NULL, 35, 'Supuesto preliminar para obras viales/ferroviarias.', 'active'),
 ('Vialidad y Transporte', 'EARTHWORK_M3', 'Movimiento de tierra estimado', 'm3', 2100, 0, NULL, 35, 'Supuesto preliminar para priorización comercial.', 'active'),
 ('Edificación e Infraestructura', 'CONCRETE_M3', 'Hormigón estimado', 'm3', 180, 0, NULL, 30, 'Supuesto preliminar de edificación; calibrar por m2 si se obtiene superficie.', 'active'),
 ('Industrial', 'CONCRETE_M3', 'Hormigón estimado', 'm3', 110, 0, NULL, 30, 'Supuesto preliminar de plantas industriales.', 'active'),
 ('*', 'ENGINEERING_HH', 'Horas de ingeniería comercial estimadas', 'hh', 18, 6, NULL, 45, 'Supuesto transversal para dimensionar esfuerzo preventa.', 'active')
ON CONFLICT (sector, item_code) DO UPDATE SET
  item_name=excluded.item_name,
  unit=excluded.unit,
  factor_per_musd=excluded.factor_per_musd,
  min_quantity=excluded.min_quantity,
  max_quantity=excluded.max_quantity,
  confidence=excluded.confidence,
  source_note=excluded.source_note,
  status=excluded.status;

-- 4) Alertas por sector, geografía, score y ventana comercial
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  country TEXT,
  region TEXT,
  opportunity_status TEXT,
  min_score INTEGER CHECK (min_score BETWEEN 1 AND 5),
  min_investment_musd NUMERIC,
  latitude NUMERIC,
  longitude NUMERIC,
  radius_km NUMERIC,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('realtime','daily','weekly')),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','webhook')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'project_match' CHECK (event_type IN ('project_match','project_changed','source_updated','deadline_near')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','medium','high','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, project_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_alert_events_tenant ON alert_events(tenant_id, created_at DESC);

-- 5) Gobierno de datos personales y solicitudes de titulares
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','rectification','deletion','objection','source_information','consent_review')),
  subject_name TEXT,
  subject_email TEXT,
  subject_phone TEXT,
  contact_hash TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','rejected')),
  request_body TEXT NOT NULL,
  resolution_notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS redacted_contact_hashes (
  contact_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS privacy_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  lawful_basis TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsr_status ON data_subject_requests(status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsr_contact_hash ON data_subject_requests(contact_hash);

-- 6) ROI medible para demostrar valor comercial por cliente
CREATE TABLE IF NOT EXISTS commercial_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_pipeline_musd NUMERIC NOT NULL DEFAULT 0,
  target_won_musd NUMERIC NOT NULL DEFAULT 0,
  target_new_opportunities INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS roi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('lead_created','meeting_booked','proposal_sent','won_revenue','avoided_cost','subscription_cost','manual_adjustment')),
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  gross_margin_percent NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_events_tenant ON roi_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_events_project ON roi_events(project_id);

-- Alteraciones multi-tenant sobre pipeline existente
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE opportunities SET tenant_id = (SELECT id FROM tenants WHERE name='Berisa Internal' LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE opportunities ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_project_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_project_tenant_unique'
  ) THEN
    ALTER TABLE opportunities ADD CONSTRAINT opportunities_project_tenant_unique UNIQUE(project_id, tenant_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage ON opportunities(tenant_id, stage);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE activities a SET tenant_id = o.tenant_id FROM opportunities o WHERE a.opportunity_id = o.id AND a.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id, due_date);

-- Triggers updated_at para nuevas tablas
DROP TRIGGER IF EXISTS trg_tenants_updated ON tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS trg_sources_updated ON ingestion_sources;
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON ingestion_sources FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS trg_source_records_updated ON source_records;
CREATE TRIGGER trg_source_records_updated BEFORE UPDATE ON source_records FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS trg_bom_assumptions_updated ON bom_assumptions;
CREATE TRIGGER trg_bom_assumptions_updated BEFORE UPDATE ON bom_assumptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS trg_alert_rules_updated ON alert_rules;
CREATE TRIGGER trg_alert_rules_updated BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
