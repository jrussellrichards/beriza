-- ═══════════════════════════════════════════════════════
-- BERISA Platform — PostgreSQL Schema v2.0
-- Multi-tenant · RBAC · Suppliers · CRM · Billing · Audit
-- ═══════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE plan_tier       AS ENUM ('starter','profesional','business','enterprise');
CREATE TYPE org_role        AS ENUM ('admin','manager','analyst','viewer','buyer','supplier_admin');
CREATE TYPE project_status  AS ENUM ('prefactibilidad','factibilidad','en_diseno','en_licitacion','ejecucion','terminado','suspendido','cancelado');
CREATE TYPE opp_stage       AS ENUM ('prospecting','qualifying','proposal','negotiation','closing','won','lost');
CREATE TYPE alert_type      AS ENUM ('new_project','status_change','capex_threshold','opp_window','supplier_match');
CREATE TYPE alert_channel   AS ENUM ('email','slack','webhook','push');
CREATE TYPE doc_status      AS ENUM ('pending','valid','expiring','expired','rejected');
CREATE TYPE supplier_level  AS ENUM ('nivel_0','nivel_1','nivel_2','nivel_3','nivel_4');
CREATE TYPE homolog_status  AS ENUM ('in_progress','submitted','approved','rejected','expired');
CREATE TYPE rfq_status      AS ENUM ('draft','published','closed','awarded','cancelled');
CREATE TYPE report_status   AS ENUM ('queued','generating','ready','failed');
CREATE TYPE audit_action    AS ENUM ('login','logout','create','update','delete','export','api_call','auth_fail','plan_change');

-- Organizations (multi-tenant root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL, slug VARCHAR(80) UNIQUE NOT NULL,
  plan plan_tier NOT NULL DEFAULT 'starter', plan_status VARCHAR(20) NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ, stripe_customer_id VARCHAR(100), stripe_sub_id VARCHAR(100),
  logo_url TEXT, website VARCHAR(300), sector VARCHAR(100), country CHAR(2) DEFAULT 'CL',
  settings JSONB DEFAULT '{}', max_users INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orgs_slug ON organizations(slug);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL, email_verified BOOLEAN DEFAULT false,
  password_hash VARCHAR(255), name VARCHAR(200) NOT NULL, avatar_url TEXT,
  role org_role NOT NULL DEFAULT 'viewer', is_active BOOLEAN DEFAULT true,
  totp_secret VARCHAR(100), totp_enabled BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ, last_login_ip INET, login_count INT DEFAULT 0,
  failed_attempts INT DEFAULT 0, locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(), settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET, user_agent TEXT, expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL, key_prefix CHAR(8) NOT NULL, key_hash VARCHAR(255) NOT NULL UNIQUE,
  permissions JSONB DEFAULT '["read"]', rate_limit INT DEFAULT 1000,
  calls_today INT DEFAULT 0, calls_total BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) DEFAULT 'manual', source_id VARCHAR(200), source_url TEXT,
  name TEXT NOT NULL, sector VARCHAR(100), status project_status,
  country CHAR(2) DEFAULT 'CL', region VARCHAR(100), subregion VARCHAR(100),
  location_text TEXT, lat DECIMAL(10,7), lon DECIMAL(10,7),
  capex_usd_m DECIMAL(12,2), currency_orig CHAR(3) DEFAULT 'USD', capex_orig DECIMAL(14,2),
  start_date DATE, end_date DATE, licitacion_date DATE,
  typology TEXT, description TEXT, owner_name TEXT, owner_rut VARCHAR(20),
  score SMALLINT CHECK (score BETWEEN 1 AND 5), score_breakdown JSONB,
  opp_window VARCHAR(10) CHECK (opp_window IN ('green','yellow','red','none')),
  opp_label TEXT, tags TEXT[] DEFAULT '{}', raw_data JSONB, is_active BOOLEAN DEFAULT true,
  scraped_at TIMESTAMPTZ, verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_proj_sector    ON projects(sector);
CREATE INDEX idx_proj_status    ON projects(status);
CREATE INDEX idx_proj_country   ON projects(country);
CREATE INDEX idx_proj_region    ON projects(region);
CREATE INDEX idx_proj_capex     ON projects(capex_usd_m);
CREATE INDEX idx_proj_score     ON projects(score);
CREATE INDEX idx_proj_opp       ON projects(opp_window);
CREATE INDEX idx_proj_source    ON projects(source, source_id);
CREATE INDEX idx_proj_geo       ON projects(lat, lon);
CREATE INDEX idx_proj_search    ON projects USING gin(to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(owner_name,'')));

CREATE TABLE org_project_saves (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, project_id)
);

-- Contacts & CRM
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL, title VARCHAR(200), company VARCHAR(200),
  email VARCHAR(255), phone VARCHAR(50), linkedin_url TEXT,
  category VARCHAR(50), tag VARCHAR(50),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  enriched_at TIMESTAMPTZ, enrichment_data JSONB, notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_org ON contacts(org_id);
CREATE INDEX idx_contacts_proj ON contacts(project_id);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL, company VARCHAR(200), value_usd_m DECIMAL(10,2),
  stage opp_stage NOT NULL DEFAULT 'prospecting',
  probability SMALLINT CHECK (probability BETWEEN 0 AND 100),
  sector VARCHAR(100), assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE, closed_at TIMESTAMPTZ, won_at TIMESTAMPTZ, lost_reason TEXT, notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_opps_org ON opportunities(org_id);
CREATE INDEX idx_opps_stage ON opportunities(org_id, stage);
CREATE INDEX idx_opps_assign ON opportunities(assigned_to);

CREATE TABLE crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opp_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL, subject TEXT, body TEXT, outcome TEXT,
  due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_act_org ON crm_activities(org_id);
CREATE INDEX idx_act_opp ON crm_activities(opp_id);

-- Alerts
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL, type alert_type NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  channels alert_channel[] DEFAULT '{email}', channel_config JSONB DEFAULT '{}',
  frequency VARCHAR(20) DEFAULT 'immediate', is_active BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ, fire_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_arules_org ON alert_rules(org_id);

CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type alert_type, payload JSONB, channels_sent alert_channel[],
  read_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, failed_at TIMESTAMPTZ, error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aevents_org ON alert_events(org_id);
CREATE INDEX idx_aevents_read ON alert_events(org_id, read_at);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  company_name VARCHAR(300) NOT NULL, rut VARCHAR(20) UNIQUE, legal_name VARCHAR(300),
  entity_type VARCHAR(50),
  contact_name VARCHAR(200), contact_email VARCHAR(255), contact_phone VARCHAR(50),
  website TEXT, linkedin_url TEXT,
  country CHAR(2) DEFAULT 'CL', region VARCHAR(100), address TEXT,
  geo_coverage TEXT[], sectors TEXT[], subsectors TEXT[], specialties TEXT[],
  employee_count VARCHAR(30), annual_revenue VARCHAR(30),
  homolog_level supplier_level DEFAULT 'nivel_0', homolog_status homolog_status DEFAULT 'in_progress',
  homolog_score DECIMAL(5,2), homolog_expires_at TIMESTAMPTZ,
  rating DECIMAL(3,2) CHECK (rating BETWEEN 0 AND 5),
  jobs_completed INT DEFAULT 0, on_time_rate DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true, is_verified BOOLEAN DEFAULT false,
  is_blacklisted BOOLEAN DEFAULT false, blacklist_reason TEXT,
  profile_complete_pct SMALLINT DEFAULT 0,
  logo_url TEXT, description TEXT, certifications TEXT[], social_links JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sup_sectors ON suppliers USING gin(sectors);
CREATE INDEX idx_sup_regions ON suppliers USING gin(geo_coverage);
CREATE INDEX idx_sup_level ON suppliers(homolog_level);
CREATE INDEX idx_sup_search ON suppliers USING gin(to_tsvector('spanish', coalesce(company_name,'')));

CREATE TABLE supplier_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  doc_type VARCHAR(80) NOT NULL, doc_label VARCHAR(200), version INT DEFAULT 1,
  file_url TEXT NOT NULL, file_name VARCHAR(300), file_size_kb INT, mime_type VARCHAR(100),
  status doc_status DEFAULT 'pending', issued_date DATE, expires_at DATE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ, rejection_reason TEXT, notes TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sdocs_supplier ON supplier_documents(supplier_id);
CREATE INDEX idx_sdocs_expiry ON supplier_documents(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE homolog_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  target_level supplier_level NOT NULL, item_key VARCHAR(100) NOT NULL,
  item_label VARCHAR(300), required BOOLEAN DEFAULT true, completed BOOLEAN DEFAULT false,
  doc_id UUID REFERENCES supplier_documents(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ, notes TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, target_level, item_key)
);
CREATE INDEX idx_hcl_supplier ON homolog_checklists(supplier_id);

-- RFQ / Procurement
CREATE TABLE rfq_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT, sector VARCHAR(100), budget_usd_m DECIMAL(10,2),
  required_level supplier_level DEFAULT 'nivel_1', regions TEXT[], specialties TEXT[],
  due_date DATE, status rfq_status DEFAULT 'draft',
  published_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  awarded_to UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ, award_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rfq_org ON rfq_requests(org_id);
CREATE INDEX idx_rfq_status ON rfq_requests(status);

CREATE TABLE rfq_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2), match_reasons JSONB,
  invited_at TIMESTAMPTZ DEFAULT NOW(), responded_at TIMESTAMPTZ,
  response VARCHAR(20), decline_reason TEXT,
  UNIQUE(rfq_id, supplier_id)
);

CREATE TABLE rfq_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  value_usd_m DECIMAL(10,2), timeline_days INT, description TEXT,
  attachments JSONB DEFAULT '[]', score DECIMAL(5,2), notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(), reviewed_at TIMESTAMPTZ,
  UNIQUE(rfq_id, supplier_id)
);

-- Billing
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_event_id VARCHAR(200) UNIQUE, event_type VARCHAR(100) NOT NULL,
  amount_usd DECIMAL(10,2), currency CHAR(3) DEFAULT 'USD', status VARCHAR(30),
  metadata JSONB DEFAULT '{}', processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(200) UNIQUE,
  amount_usd DECIMAL(10,2) NOT NULL, status VARCHAR(20) NOT NULL,
  period_start DATE, period_end DATE, pdf_url TEXT, due_date DATE, paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inv_org ON invoices(org_id);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, title TEXT NOT NULL, params JSONB DEFAULT '{}',
  status report_status DEFAULT 'queued', file_url TEXT, file_size_kb INT, pages INT,
  generated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_org ON reports(org_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Onboarding
CREATE TABLE onboarding_progress (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  step_profile BOOLEAN DEFAULT false,
  step_first_alert BOOLEAN DEFAULT false,
  step_first_project BOOLEAN DEFAULT false,
  step_first_opp BOOLEAN DEFAULT false,
  step_invite_user BOOLEAN DEFAULT false,
  step_api_key BOOLEAN DEFAULT false,
  step_billing BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ, dismissed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraper jobs
CREATE TABLE scraper_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL, status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  projects_found INT DEFAULT 0, projects_new INT DEFAULT 0, projects_updated INT DEFAULT 0,
  errors JSONB DEFAULT '[]', duration_secs INT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (partitioned by month)
CREATE TABLE audit_logs (
  id BIGSERIAL, org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action audit_action NOT NULL, resource_type VARCHAR(50), resource_id UUID,
  ip_address INET, user_agent TEXT, request_path TEXT, request_method VARCHAR(10),
  status_code SMALLINT, duration_ms INT, changes JSONB, metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_q2 PARTITION OF audit_logs FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_q3 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_q4 PARTITION OF audit_logs FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE TABLE audit_logs_2027    PARTITION OF audit_logs FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

CREATE INDEX idx_audit_org    ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user   ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT DISTINCT table_name FROM information_schema.columns
  WHERE column_name='updated_at' AND table_schema='public' AND table_name!='audit_logs'
LOOP EXECUTE format('CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t,t);
END LOOP; END; $$;
