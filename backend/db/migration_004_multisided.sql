-- ═══════════════════════════════════════════════════════════
-- BERISA Migration 004 — Multi-lado market upgrade
-- Supplier capabilities, demand needs, matching, procurement,
-- compliance, finance, ROI, integrations, privacy, admin
-- ═══════════════════════════════════════════════════════════

-- Supplier capability catalog (coded capabilities)
CREATE TABLE supplier_capability_catalog (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  category     VARCHAR(80),
  description  TEXT,
  is_active    BOOLEAN DEFAULT true,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO supplier_capability_catalog(code,name,category) VALUES
  ('civil_general','Obras Civiles Generales','Construcción'),
  ('mep_electrical','MEP - Instalaciones Eléctricas','MEP'),
  ('mep_mechanical','MEP - Mecánica Industrial','MEP'),
  ('mep_plumbing','MEP - Plomería y Sanitario','MEP'),
  ('steel_structural','Acero Estructural','Materiales'),
  ('concrete_supply','Suministro de Hormigón','Materiales'),
  ('aggregates','Áridos y Materiales Pétreos','Materiales'),
  ('steel_rebar','Fierro de Refuerzo','Materiales'),
  ('equipment_heavy','Maquinaria Pesada','Equipos'),
  ('equipment_lifting','Equipos de Izaje y Grúas','Equipos'),
  ('logistics_transport','Logística y Transporte','Logística'),
  ('hse_consulting','Consultora HSE','HSE'),
  ('lab_testing','Laboratorio y Ensayos','Control Calidad'),
  ('survey_topography','Topografía y Survey','Ingeniería'),
  ('engineering_design','Ingeniería de Diseño','Ingeniería'),
  ('geotechnics','Geotecnia','Ingeniería'),
  ('environmental','Gestión Ambiental','Medio Ambiente'),
  ('waste_management','Gestión de Residuos','Medio Ambiente'),
  ('electrical_ht','Tendido Eléctrico Alta Tensión','Energía'),
  ('solar_pv','Instalación Fotovoltaica','Energía'),
  ('instrumentation','Instrumentación y Control','Automatización'),
  ('scaffolding','Andamiaje y Encofrado','Auxiliares'),
  ('insulation','Aislación Térmica e Industrial','Auxiliares'),
  ('painting_coating','Pintura y Recubrimientos','Terminaciones'),
  ('catering_camp','Alimentación y Campamento','Servicios'),
  ('security_services','Seguridad y Vigilancia','Servicios'),
  ('cleaning_services','Aseo Industrial','Servicios'),
  ('drone_survey','Topografía con Drones','Tecnología'),
  ('bim_services','Modelamiento BIM','Tecnología'),
  ('it_systems','Sistemas TI en Obra','Tecnología');

-- Supplier profile capabilities (M2M)
CREATE TABLE supplier_profile_capabilities (
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES supplier_capability_catalog(id) ON DELETE CASCADE,
  years_exp     SMALLINT,
  notes         TEXT,
  verified      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (supplier_id, capability_id)
);

-- Supplier performance events
CREATE TABLE supplier_performance_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  rfq_id       UUID REFERENCES rfq_requests(id) ON DELETE SET NULL,
  event_type   VARCHAR(50) NOT NULL, -- awarded|completed_ontime|completed_late|nonconformance|reference|rating
  value        DECIMAL(5,2),
  notes        TEXT,
  recorded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_spe_supplier ON supplier_performance_events(supplier_id);

-- Multi-dimensional supplier score
CREATE TABLE supplier_scores (
  supplier_id   UUID PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  score_hse     DECIMAL(4,2) DEFAULT 0,
  score_quality DECIMAL(4,2) DEFAULT 0,
  score_env     DECIMAL(4,2) DEFAULT 0,
  score_finance DECIMAL(4,2) DEFAULT 0,
  score_perf    DECIMAL(4,2) DEFAULT 0,
  score_docs    DECIMAL(4,2) DEFAULT 0,
  score_total   DECIMAL(4,2) GENERATED ALWAYS AS (ROUND((score_hse+score_quality+score_env+score_finance+score_perf+score_docs)/6,2)) STORED,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Project demand needs
CREATE TABLE project_demand_needs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  capability_ids  UUID[] DEFAULT '{}',
  estimated_usd_m DECIMAL(10,2),
  region          VARCHAR(100),
  required_date   DATE,
  required_level  VARCHAR(20) DEFAULT 'nivel_1',
  required_certs  TEXT[] DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'open', -- open|matched|closed
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pdn_org ON project_demand_needs(org_id);
CREATE INDEX idx_pdn_project ON project_demand_needs(project_id);

-- Marketplace matches (explainable)
CREATE TABLE marketplace_matches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  need_id      UUID NOT NULL REFERENCES project_demand_needs(id) ON DELETE CASCADE,
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  match_score  DECIMAL(5,2),
  fit_reasons  JSONB DEFAULT '[]',   -- [{dim, label, score}]
  risk_flags   JSONB DEFAULT '[]',   -- [{code, label, severity}]
  status       VARCHAR(20) DEFAULT 'pending', -- pending|invited|accepted|declined
  invited_at   TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(need_id, supplier_id)
);
CREATE INDEX idx_mm_need ON marketplace_matches(need_id);

-- Buyer shortlist items (detailed)
CREATE TABLE buyer_shortlist_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id      UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  match_id    UUID REFERENCES marketplace_matches(id) ON DELETE SET NULL,
  rank        SMALLINT,
  match_score DECIMAL(5,2),
  fit_reasons JSONB DEFAULT '[]',
  risk_flags  JSONB DEFAULT '[]',
  status      VARCHAR(20) DEFAULT 'invited',
  notes       TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

-- Purchase orders (OC)
CREATE TABLE purchase_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id       UUID REFERENCES rfq_requests(id) ON DELETE SET NULL,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  po_number    VARCHAR(50),
  title        TEXT NOT NULL,
  description  TEXT,
  amount_usd   DECIMAL(12,2),
  currency     CHAR(3) DEFAULT 'USD',
  status       VARCHAR(30) DEFAULT 'draft', -- draft|issued|accepted|in_progress|completed|cancelled
  issued_at    TIMESTAMPTZ,
  due_date     DATE,
  payment_terms TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_po_org ON purchase_orders(org_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);

-- PO milestones
CREATE TABLE po_milestones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  amount_usd  DECIMAL(12,2),
  due_date    DATE,
  status      VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  notes       TEXT,
  sort_order  INT DEFAULT 0
);
CREATE INDEX idx_pom_po ON po_milestones(po_id);

-- PO invoices
CREATE TABLE po_invoices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES po_milestones(id) ON DELETE SET NULL,
  invoice_num VARCHAR(50),
  amount_usd  DECIMAL(12,2),
  status      VARCHAR(20) DEFAULT 'pending', -- pending|approved|paid|rejected
  issued_date DATE,
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  file_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Subcontracting packages
CREATE TABLE subcontracting_packages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_id        UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  contract_num VARCHAR(50),
  title        TEXT NOT NULL,
  amount_usd   DECIMAL(12,2),
  start_date   DATE,
  end_date     DATE,
  status       VARCHAR(30) DEFAULT 'onboarding', -- onboarding|execution|payment|closed
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sp_org ON subcontracting_packages(org_id);

-- Subcontracting checklist items
CREATE TABLE subcontracting_checklist (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id   UUID NOT NULL REFERENCES subcontracting_packages(id) ON DELETE CASCADE,
  stage        VARCHAR(30) NOT NULL, -- onboarding|monthly|payment|closure
  dimension    VARCHAR(30) NOT NULL, -- legal|hse|labor|insurance|financial|quality|environmental
  item_key     VARCHAR(100) NOT NULL,
  item_label   TEXT NOT NULL,
  required     BOOLEAN DEFAULT true,
  completed    BOOLEAN DEFAULT false,
  doc_url      TEXT,
  notes        TEXT,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE(package_id, stage, item_key)
);
CREATE INDEX idx_scl_package ON subcontracting_checklist(package_id);

-- Finance partners and referrals
CREATE TABLE finance_partners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  type        VARCHAR(50), -- factoring|insurance|confirming|guarantee
  country     CHAR(2) DEFAULT 'CL',
  is_sandbox  BOOLEAN DEFAULT true,
  is_active   BOOLEAN DEFAULT true,
  config      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance_referrals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id   UUID REFERENCES finance_partners(id) ON DELETE SET NULL,
  po_id        UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  type         VARCHAR(30),
  amount_usd   DECIMAL(12,2),
  status       VARCHAR(30) DEFAULT 'pending', -- pending|screening|consented|submitted|approved|rejected
  consent_at   TIMESTAMPTZ,
  screened_at  TIMESTAMPTZ,
  result_data  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fr_org ON finance_referrals(org_id);

-- ROI events and targets
CREATE TABLE roi_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  opp_id      UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  po_id       UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  event_type  VARCHAR(50) NOT NULL, -- quote_sent|quote_won|po_issued|meeting|call|demo
  value_usd_m DECIMAL(10,2),
  notes       TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_roi_org ON roi_events(org_id);
CREATE INDEX idx_roi_user ON roi_events(user_id);

CREATE TABLE roi_targets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  period      VARCHAR(7) NOT NULL, -- YYYY-MM
  metric      VARCHAR(50) NOT NULL, -- pipeline_value|quotes_sent|po_issued|meetings
  target      DECIMAL(12,2),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id, period, metric)
);

-- Commercial accounts (separate from pipeline)
CREATE TABLE commercial_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  type        VARCHAR(50), -- prospect|customer|partner|lost
  sector      VARCHAR(100),
  region      VARCHAR(100),
  website     TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  score       SMALLINT DEFAULT 0,
  annual_value_usd_m DECIMAL(10,2),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ca_org ON commercial_accounts(org_id);

-- Integrations catalog
CREATE TABLE integration_catalog (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(50), -- email|calendar|crm|erp|accounting|factoring|insurance|messaging
  logo_url    TEXT,
  description TEXT,
  auth_type   VARCHAR(30), -- oauth2|api_key|webhook
  is_active   BOOLEAN DEFAULT true
);
INSERT INTO integration_catalog(code,name,category,auth_type) VALUES
  ('gmail','Gmail','email','oauth2'),
  ('google_calendar','Google Calendar','calendar','oauth2'),
  ('google_contacts','Google Contacts','crm','oauth2'),
  ('outlook_email','Outlook Email','email','oauth2'),
  ('outlook_calendar','Outlook Calendar','calendar','oauth2'),
  ('hubspot','HubSpot CRM','crm','oauth2'),
  ('salesforce','Salesforce','crm','oauth2'),
  ('erp_generic','ERP Genérico','erp','api_key'),
  ('facturacion_electronica','Facturación Electrónica','accounting','api_key'),
  ('factoring_partner','Factoring Partner','factoring','api_key'),
  ('seguro_credito','Seguro de Crédito','insurance','api_key'),
  ('slack','Slack','messaging','oauth2');

CREATE TABLE tenant_integrations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_id  UUID NOT NULL REFERENCES integration_catalog(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT false,
  config_enc  TEXT,  -- encrypted config JSON
  last_sync   TIMESTAMPTZ,
  sync_status VARCHAR(30) DEFAULT 'idle',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, catalog_id)
);

CREATE TABLE integration_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  event_type  VARCHAR(50),
  status      VARCHAR(20),
  payload     JSONB,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Privacy requests (Ley 19.628 / GDPR)
CREATE TABLE privacy_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
  requester_email VARCHAR(255) NOT NULL,
  request_type VARCHAR(30) NOT NULL, -- access|rectification|deletion|portability|objection
  description TEXT,
  status      VARCHAR(20) DEFAULT 'pending', -- pending|in_review|resolved|rejected
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant limits (configurable per plan)
CREATE TABLE tenant_limits (
  org_id          UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_users       INT DEFAULT 5,
  max_projects    INT DEFAULT 0,   -- 0 = unlimited
  max_alerts      INT DEFAULT 10,
  max_api_calls_day INT DEFAULT 1000,
  max_reports_month INT DEFAULT 5,
  max_suppliers   INT DEFAULT 0,
  feature_bom     BOOLEAN DEFAULT true,
  feature_crm     BOOLEAN DEFAULT true,
  feature_api     BOOLEAN DEFAULT false,
  feature_compliance BOOLEAN DEFAULT false,
  feature_finance BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion lineage
CREATE TABLE ingestion_lineage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source        VARCHAR(50) NOT NULL,
  source_id     VARCHAR(200),
  source_url    TEXT,
  field_name    VARCHAR(100),
  field_value   TEXT,
  scraped_at    TIMESTAMPTZ NOT NULL,
  license_valid BOOLEAN DEFAULT true,
  license_notes TEXT
);
CREATE INDEX idx_il_project ON ingestion_lineage(project_id);

-- Apply updated_at triggers
DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT DISTINCT table_name FROM information_schema.columns
  WHERE column_name='updated_at' AND table_schema='public'
  AND table_name NOT IN (SELECT table_name FROM pg_trigger WHERE tgname LIKE 'trg_%_upd')
LOOP
  BEGIN
    EXECUTE format('CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t,t);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END LOOP; END; $$;
