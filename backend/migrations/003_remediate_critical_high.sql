-- Berisa Platform v3 - remediación de hallazgos críticos y altos
-- Incluye: RBAC platform/tenant, PII normalizada/cifrada, API enterprise,
-- delivery de alertas, entity resolution, control de migraciones y billing básico.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles explícitos de plataforma y tenant.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role='platform_admin' WHERE role='admin';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('viewer','analyst','commercial','tenant_admin','platform_admin'));

-- Control de migraciones para operación segura.
CREATE TABLE IF NOT EXISTS migration_history (
  filename TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Endurecimiento de fuentes e ingestión.
ALTER TABLE ingestion_sources ADD COLUMN IF NOT EXISTS connector_type TEXT NOT NULL DEFAULT 'file_json' CHECK (connector_type IN ('file_json','http_json','client_upload','manual'));
ALTER TABLE ingestion_sources ADD COLUMN IF NOT EXISTS connector_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ingestion_sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE ingestion_sources ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS connector_type TEXT;

-- Normalización y protección de PII. No almacenar datos personales en projects.contacts ni source_records.payload.
CREATE TABLE IF NOT EXISTS contact_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  source_record_id UUID REFERENCES source_records(id) ON DELETE SET NULL,
  contact_hash TEXT NOT NULL,
  role TEXT,
  company TEXT,
  category TEXT,
  encrypted_payload TEXT NOT NULL,
  lawful_basis TEXT NOT NULL DEFAULT 'legitimate_interest_b2b_preliminary',
  source_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','redacted','suppressed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, contact_hash)
);
CREATE INDEX IF NOT EXISTS idx_contact_records_project ON contact_records(project_id, status);
CREATE INDEX IF NOT EXISTS idx_contact_records_hash ON contact_records(contact_hash);

-- Entity resolution y deduplicación.
CREATE TABLE IF NOT EXISTS canonical_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  duplicate_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id UUID REFERENCES ingestion_sources(id) ON DELETE SET NULL,
  match_method TEXT NOT NULL,
  match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  review_status TEXT NOT NULL DEFAULT 'auto_linked' CHECK (review_status IN ('auto_linked','needs_review','confirmed','rejected')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(canonical_project_id, duplicate_project_id)
);
CREATE INDEX IF NOT EXISTS idx_canonical_links_duplicate ON canonical_project_links(duplicate_project_id);

-- Delivery externo de alertas.
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS email_to TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS delivery_config JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS alert_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_event_id UUID NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','webhook')),
  target TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_delivery_pending ON alert_delivery_events(status, next_retry_at);

-- API enterprise.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL DEFAULT '["projects:read"]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  rows_returned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage_events(tenant_id, created_at DESC);

-- BOM más explícito y trazable.
ALTER TABLE bom_assumptions ADD COLUMN IF NOT EXISTS model_family TEXT NOT NULL DEFAULT 'investment_rule';
ALTER TABLE bom_assumptions ADD COLUMN IF NOT EXISTS required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE project_bom_estimates ADD COLUMN IF NOT EXISTS input_features JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_bom_estimates ADD COLUMN IF NOT EXISTS disclaimer TEXT NOT NULL DEFAULT 'Estimación preliminar para priorización comercial; no apta para presupuesto contractual sin validación técnica.';

-- Billing básico para cerrar el loop SaaS.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','cancelled')),
  monthly_price_usd NUMERIC NOT NULL DEFAULT 0,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at DATE,
  external_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','void','overdue')),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON billing_invoices(tenant_id, period_start DESC);

-- Sanitización física de PII heredada en tablas JSON.
UPDATE projects SET contacts='[]'::jsonb, contact_count=0;
UPDATE source_records SET payload = payload - 'cts' - 'contacts' - 'contactos';

DROP TRIGGER IF EXISTS trg_contact_records_updated ON contact_records;
CREATE TRIGGER trg_contact_records_updated BEFORE UPDATE ON contact_records FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated ON billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
