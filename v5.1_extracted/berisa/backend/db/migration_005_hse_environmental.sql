-- PostgreSQL version check (requires 12+ for GENERATED ALWAYS AS)
DO $$ BEGIN
  IF current_setting('server_version_num')::int < 120000 THEN
    RAISE EXCEPTION 'BERISA Migration 005 requires PostgreSQL 12+. Current: %', current_setting('server_version');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- BERISA Migration 005 — HSE Operacional & Gestión Ambiental
-- Módulos M-HSE-01 a M-HSE-05 + M-AMB-01
-- Normativa: Ley 16.744 · DS 44/2024 · DS 76 · DS 594 · DS 132 · Ley 19.300
-- ═══════════════════════════════════════════════════════════════════

-- ─── M-HSE-01: Incidentes ────────────────────────────────────────────
CREATE TABLE hse_incidents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  incident_date DATE NOT NULL,
  incident_time TIME,
  incident_type VARCHAR(30) NOT NULL, -- accident_work|accident_commute|near_miss|occupational_disease|environmental
  severity     VARCHAR(20) NOT NULL,  -- fatal|serious|minor|near_miss|property_damage
  title        TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  workers_involved INT DEFAULT 1,
  lost_days    INT DEFAULT 0,
  diat_number  VARCHAR(50),           -- Denuncia Individual Accidente Trabajo
  diep_number  VARCHAR(50),           -- Denuncia Individual Enfermedad Profesional
  oa_reported  BOOLEAN DEFAULT false, -- Reportado al Organismo Administrador
  status       VARCHAR(20) DEFAULT 'open', -- open|investigating|capa_open|closed
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hi_org ON hse_incidents(org_id);
CREATE INDEX idx_hi_supplier ON hse_incidents(supplier_id);
CREATE INDEX idx_hi_date ON hse_incidents(incident_date);

CREATE TABLE hse_investigations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id  UUID NOT NULL REFERENCES hse_incidents(id) ON DELETE CASCADE,
  method       VARCHAR(30) DEFAULT 'five_whys', -- five_whys|fault_tree|bowtie
  root_causes  JSONB DEFAULT '[]',  -- [{level, description}]
  contributing_factors JSONB DEFAULT '[]',
  immediate_causes JSONB DEFAULT '[]',
  findings     TEXT,
  responsible  UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_capa (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id    UUID REFERENCES hse_incidents(id) ON DELETE CASCADE,
  capa_type      VARCHAR(20) DEFAULT 'corrective', -- corrective|preventive|improvement
  title          TEXT NOT NULL,
  description    TEXT,
  responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date       DATE,
  status         VARCHAR(20) DEFAULT 'open', -- open|in_progress|completed|verified|overdue
  evidence_url   TEXT,
  completed_at   TIMESTAMPTZ,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hca_org ON hse_capa(org_id);

CREATE TABLE hse_stats_snapshots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  period_type  VARCHAR(10) DEFAULT 'monthly', -- monthly|quarterly|annual|biennial
  workers_avg  INT DEFAULT 0,
  hours_worked BIGINT DEFAULT 0,
  accidents_total INT DEFAULT 0,
  accidents_fatal  INT DEFAULT 0,
  accidents_serious INT DEFAULT 0,
  accidents_minor  INT DEFAULT 0,
  near_misses  INT DEFAULT 0,
  lost_days    INT DEFAULT 0,
  -- Calculated KPIs (stored for performance)
  ta   DECIMAL(6,3) DEFAULT 0,  -- Tasa Accidentabilidad = (accidentes/trabajadores)*100
  if_index DECIMAL(8,3) DEFAULT 0,  -- IF = (accidentes*10^6)/horas
  ig_index DECIMAL(8,3) DEFAULT 0,  -- IG = (días_perdidos*10^6)/horas
  tasa_cotizacion_adicional DECIMAL(4,2) DEFAULT 0, -- DS 67 vigente
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hss_org ON hse_stats_snapshots(org_id, period_start DESC);

-- ─── M-HSE-02: Prevención ────────────────────────────────────────────
CREATE TABLE hse_risk_matrix (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  standard     VARCHAR(20) DEFAULT 'DS44_2024',
  status       VARCHAR(20) DEFAULT 'active',
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_risk_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matrix_id    UUID NOT NULL REFERENCES hse_risk_matrix(id) ON DELETE CASCADE,
  activity     TEXT NOT NULL,
  hazard       TEXT NOT NULL,
  risk         TEXT NOT NULL,
  probability  SMALLINT CHECK (probability BETWEEN 1 AND 5),
  consequence  SMALLINT CHECK (consequence BETWEEN 1 AND 5),
  risk_level   VARCHAR(20) GENERATED ALWAYS AS (
    CASE WHEN probability * consequence >= 15 THEN 'critical'
         WHEN probability * consequence >= 10 THEN 'high'
         WHEN probability * consequence >= 5  THEN 'medium'
         ELSE 'low' END
  ) STORED,
  controls     TEXT,
  responsible  VARCHAR(200),
  deadline     DATE,
  status       VARCHAR(20) DEFAULT 'open',
  sort_order   INT DEFAULT 0
);
CREATE INDEX idx_hri_matrix ON hse_risk_items(matrix_id);

CREATE TABLE hse_cphs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  cphs_type    VARCHAR(20) DEFAULT 'own', -- own|site_faena
  constitution_date DATE,
  dt_registration VARCHAR(50),
  status       VARCHAR(20) DEFAULT 'active',
  period_end   DATE,
  president_name VARCHAR(200),
  members      JSONB DEFAULT '[]', -- [{name, role, company, type: employer|worker}]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_cphs_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cphs_id      UUID NOT NULL REFERENCES hse_cphs(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  attendees    JSONB DEFAULT '[]',
  agenda       TEXT,
  minutes      TEXT,
  agreements   JSONB DEFAULT '[]', -- [{description, responsible, due_date, status}]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_prevention_programs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year         SMALLINT NOT NULL,
  title        TEXT NOT NULL,
  objectives   TEXT,
  status       VARCHAR(20) DEFAULT 'draft', -- draft|approved|active|closed
  approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_prevention_activities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id   UUID NOT NULL REFERENCES hse_prevention_programs(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  category     VARCHAR(50), -- training|inspection|audit|drill|campaign|committee|other
  responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  planned_date DATE,
  completed_date DATE,
  status       VARCHAR(20) DEFAULT 'planned',
  evidence_url TEXT,
  notes        TEXT,
  sort_order   INT DEFAULT 0
);
CREATE INDEX idx_hpa_program ON hse_prevention_activities(program_id);

CREATE TABLE hse_inspections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  inspection_type VARCHAR(30) DEFAULT 'preventive', -- preventive|reactive|supervisory|external
  inspection_date DATE NOT NULL,
  inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
  area_inspected TEXT,
  findings     JSONB DEFAULT '[]', -- [{description, severity, photo_url, capa_required}]
  total_findings INT DEFAULT 0,
  critical_findings INT DEFAULT 0,
  result       VARCHAR(20), -- satisfactory|with_observations|unsatisfactory
  capa_ids     UUID[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── M-HSE-03: Acreditación ─────────────────────────────────────────
CREATE TABLE hse_worker_accreditation (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  worker_name  VARCHAR(200) NOT NULL,
  worker_rut   VARCHAR(20),
  worker_role  VARCHAR(100),
  induction_at TIMESTAMPTZ,
  induction_valid_until DATE,
  accreditation_status VARCHAR(20) DEFAULT 'pending', -- pending|active|expired|suspended
  site_access  BOOLEAN DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hwa_org ON hse_worker_accreditation(org_id);
CREATE INDEX idx_hwa_project ON hse_worker_accreditation(project_id);

CREATE TABLE hse_licenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accreditation_id UUID NOT NULL REFERENCES hse_worker_accreditation(id) ON DELETE CASCADE,
  license_type VARCHAR(50) NOT NULL, -- driver_A|driver_B|crane_operator|forklift|scaffold|electrical|explosive
  license_number VARCHAR(50),
  issued_by    VARCHAR(200),
  issued_date  DATE,
  expiry_date  DATE,
  status       VARCHAR(20) DEFAULT 'active', -- active|expiring|expired
  doc_url      TEXT
);
CREATE INDEX idx_hl_acc ON hse_licenses(accreditation_id);

CREATE TABLE hse_medical_exams (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accreditation_id UUID NOT NULL REFERENCES hse_worker_accreditation(id) ON DELETE CASCADE,
  exam_type    VARCHAR(30) NOT NULL, -- preoccupational|periodic|return|exit|surveillance
  exam_date    DATE NOT NULL,
  next_due_date DATE,
  result       VARCHAR(20) DEFAULT 'fit', -- fit|fit_restricted|unfit|pending
  restrictions TEXT,
  medical_center VARCHAR(200),
  doc_url      TEXT
);

-- ─── M-HSE-04: Permisos de Trabajo ──────────────────────────────────
CREATE TABLE hse_work_permits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  permit_type  VARCHAR(30) NOT NULL, -- height|confined_space|hot_work|electrical|excavation|general
  permit_number VARCHAR(30),
  title        TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  status       VARCHAR(20) DEFAULT 'requested', -- requested|approved|active|completed|cancelled|rejected
  risk_level   VARCHAR(20) DEFAULT 'high',
  workers_count INT DEFAULT 1,
  ppe_required TEXT[],
  emergency_contacts JSONB DEFAULT '[]',
  approved_at  TIMESTAMPTZ,
  closed_at    TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hwp_org ON hse_work_permits(org_id);

CREATE TABLE hse_permit_checkpoints (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id    UUID NOT NULL REFERENCES hse_work_permits(id) ON DELETE CASCADE,
  checkpoint   TEXT NOT NULL,
  category     VARCHAR(30), -- pre_work|safety_conditions|ppe|measurements|rescue|post_work
  is_required  BOOLEAN DEFAULT true,
  completed    BOOLEAN DEFAULT false,
  value        TEXT,         -- measurement value if applicable
  limit_value  TEXT,         -- regulatory limit for comparison
  checked_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at   TIMESTAMPTZ,
  notes        TEXT
);

-- ─── M-HSE-05: Higiene Ocupacional ──────────────────────────────────
CREATE TABLE hse_hygiene_monitoring (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_type   VARCHAR(30) NOT NULL, -- noise|vibration|temperature|illuminance|dust|chemical|biological
  agent_name   VARCHAR(200),
  sampling_date DATE NOT NULL,
  location     TEXT,
  measured_value DECIMAL(10,3),
  unit         VARCHAR(20),
  legal_limit  DECIMAL(10,3),
  status       VARCHAR(20) GENERATED ALWAYS AS (
    CASE WHEN measured_value IS NULL THEN 'pending'
         WHEN measured_value <= legal_limit THEN 'compliant'
         WHEN measured_value <= legal_limit * 1.2 THEN 'warning'
         ELSE 'non_compliant' END
  ) STORED,
  standard_ref VARCHAR(50), -- DS594|NCh432|NCh434
  sampled_by   VARCHAR(200),
  actions_taken TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_hhm_org ON hse_hygiene_monitoring(org_id);

CREATE TABLE hse_chemical_inventory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  cas_number   VARCHAR(20),
  hazard_class VARCHAR(50),  -- GHS classification
  physical_state VARCHAR(20),
  quantity_kg  DECIMAL(10,2),
  storage_location TEXT,
  sds_url      TEXT,          -- Safety Data Sheet URL
  is_respel    BOOLEAN DEFAULT false, -- Residuo Peligroso (DS 148)
  emergency_contact TEXT,
  last_reviewed DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hse_epp_assignments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accreditation_id UUID NOT NULL REFERENCES hse_worker_accreditation(id) ON DELETE CASCADE,
  epp_type       VARCHAR(50) NOT NULL, -- helmet|boots|gloves|glasses|harness|respirator|vest|hearing
  epp_description TEXT,
  quantity       INT DEFAULT 1,
  delivery_date  DATE NOT NULL,
  expiry_date    DATE,
  condition      VARCHAR(20) DEFAULT 'good',
  returned       BOOLEAN DEFAULT false,
  returned_date  DATE,
  notes          TEXT
);

-- ─── M-AMB-01: Gestión Ambiental ────────────────────────────────────
CREATE TABLE environmental_rca_conditions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  rca_number   VARCHAR(50),
  condition_number VARCHAR(20) NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date     DATE,
  frequency    VARCHAR(30), -- once|monthly|quarterly|annual|continuous
  status       VARCHAR(20) DEFAULT 'pending', -- pending|in_progress|compliant|overdue|exempt
  evidence_url TEXT,
  last_review  DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_erc_project ON environmental_rca_conditions(project_id);

CREATE TABLE environmental_monitoring (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  rca_condition_id UUID REFERENCES environmental_rca_conditions(id) ON DELETE SET NULL,
  indicator    TEXT NOT NULL,
  indicator_type VARCHAR(30), -- air|water|soil|noise|vegetation|wildlife|social
  monitoring_date DATE NOT NULL,
  value        DECIMAL(12,4),
  unit         VARCHAR(30),
  limit_value  DECIMAL(12,4),
  station      TEXT,
  compliant    BOOLEAN,
  report_url   TEXT,
  reported_to_sea BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_em_project ON environmental_monitoring(project_id);

CREATE TABLE environmental_waste (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  waste_type   VARCHAR(30) NOT NULL, -- respel|rcd|organic|inert|special
  waste_name   TEXT NOT NULL,
  quantity_kg  DECIMAL(12,2),
  generation_date DATE NOT NULL,
  treatment_method VARCHAR(50), -- landfill|recycle|incinerate|bioremediate|reuse
  authorized_handler VARCHAR(200), -- Gestor autorizado DS 148
  manifest_number VARCHAR(50),
  disposal_site TEXT,
  manifest_url TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ew_org ON environmental_waste(org_id);

CREATE TABLE environmental_incidents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  incident_date DATE NOT NULL,
  incident_type VARCHAR(30), -- spill|emission|discharge|waste_improper|flora|fauna
  description  TEXT NOT NULL,
  affected_media TEXT[], -- air|water|soil|flora|fauna
  affected_area_m2 DECIMAL(10,2),
  immediate_actions TEXT,
  corrective_plan TEXT,
  sma_notified BOOLEAN DEFAULT false,
  sma_notified_at TIMESTAMPTZ,
  status       VARCHAR(20) DEFAULT 'open', -- open|remediation|closed
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- UNIQUE constraints for data integrity (H-02)
ALTER TABLE hse_stats_snapshots ADD CONSTRAINT uq_hse_stats_snap
  UNIQUE (org_id, period_start, period_end, period_type);

-- H-09: UNIQUE on hse_cphs_sessions to prevent duplicate sessions
ALTER TABLE hse_cphs_sessions ADD CONSTRAINT uq_cphs_session_date
  UNIQUE (cphs_id, session_date);

-- M-04: CHECK constraint on risk_level
ALTER TABLE hse_risk_items ADD CONSTRAINT chk_risk_level
  CHECK (risk_level IN ('critical','high','medium','low'));

-- M-03: Fix NULL handling in environmental_monitoring status
-- (drop & recreate the computed column with fixed CASE)
ALTER TABLE environmental_monitoring DROP COLUMN IF EXISTS status;
ALTER TABLE environmental_monitoring ADD COLUMN status VARCHAR(20)
  GENERATED ALWAYS AS (
    CASE
      WHEN measured_value IS NULL OR legal_limit IS NULL THEN 'pending'
      WHEN measured_value <= legal_limit THEN 'compliant'
      WHEN measured_value <= legal_limit * 1.2 THEN 'warning'
      ELSE 'non_compliant'
    END
  ) STORED;

-- M-05: Composite indexes on hse_worker_accreditation
CREATE INDEX IF NOT EXISTS idx_hwa_org_project
  ON hse_worker_accreditation(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_hwa_status
  ON hse_worker_accreditation(org_id, accreditation_status);

-- L-04: Index on hse_incidents severity
CREATE INDEX IF NOT EXISTS idx_hi_sev
  ON hse_incidents(org_id, severity, incident_date DESC);

-- hse_health_surveillance (needed by M-HSE-05 hygiene route)
CREATE TABLE IF NOT EXISTS hse_health_surveillance (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id             UUID NOT NULL REFERENCES hse_worker_accreditation(id) ON DELETE CASCADE,
  agent_type            VARCHAR(50) NOT NULL,
  risk_level            VARCHAR(20) DEFAULT 'medium',
  exam_frequency_months INT DEFAULT 12,
  last_exam_date        DATE,
  next_exam_date        DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, agent_type)
);
CREATE INDEX IF NOT EXISTS idx_hhs_worker ON hse_health_surveillance(worker_id);
