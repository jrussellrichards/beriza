import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "../src/db.js";
import { env } from "../src/env.js";
import { hashPassword, normalizeEmail, sanitizeSourcePayload } from "../src/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../data/projects.berisa.seed.json");

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value.slice(0, 10);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function initialStage(project) {
  if (project.opp === "green") return "contactado";
  if (project.opp === "yellow") return "calificacion";
  if ((project.score || 0) >= 5) return "prospecto";
  return null;
}

function probability(project) {
  if (project.opp === "green") return 45;
  if (project.opp === "yellow") return 30;
  if ((project.score || 0) >= 5) return 20;
  if ((project.score || 0) >= 4) return 15;
  return 10;
}

function nextAction(index) {
  const date = new Date();
  date.setDate(date.getDate() + 3 + (index % 21));
  return date.toISOString().slice(0, 10);
}

function dataQuality(project) {
  let score = 20;
  if (project.n) score += 10;
  if (project.own) score += 10;
  if (project.s) score += 10;
  if (project.c) score += 5;
  if (project.region || project.loc) score += 10;
  if (project.inv !== null && project.inv !== undefined) score += 10;
  if (project.ini) score += 10;
  if (project.lat && project.lng) score += 10;
  if ((project.cts || []).length) score += 5;
  return Math.min(100, score);
}

const projects = JSON.parse(await fs.readFile(dataPath, "utf8"));
const adminEmail = normalizeEmail(env.adminEmail);
const adminHash = await hashPassword(env.adminPassword);

await withTransaction(async (client) => {
  const admin = await client.query(
    `INSERT INTO users(name, email, password_hash, role, status, email_verified_at)
     VALUES($1,$2,$3,'platform_admin','active',now())
     ON CONFLICT(email)
     DO UPDATE SET role='platform_admin', status='active', email_verified_at=coalesce(users.email_verified_at, now())
     RETURNING id`,
    [env.adminName, adminEmail, adminHash]
  );
  const adminId = admin.rows[0].id;

  const tenant = await client.query(
    `INSERT INTO tenants(name, legal_name, plan, status, monthly_price_usd)
     VALUES('Berisa Internal','Berisa Inteligencia Comercial','internal','active',0)
     ON CONFLICT (name) DO UPDATE SET status='active'
     RETURNING id`
  );
  const tenantId = tenant.rows[0].id;

  await client.query(
    `INSERT INTO tenant_memberships(tenant_id, user_id, tenant_role)
     VALUES($1,$2,'owner')
     ON CONFLICT (tenant_id, user_id) DO UPDATE SET tenant_role='owner'`,
    [tenantId, adminId]
  );

  await client.query(
    `INSERT INTO tenant_limits(tenant_id, max_users, max_saved_alerts, max_monthly_exports, api_enabled, contact_visibility, bom_enabled, roi_enabled)
     VALUES($1,50,100,500,true,true,true,true)
     ON CONFLICT (tenant_id) DO UPDATE SET contact_visibility=true, api_enabled=true, bom_enabled=true, roi_enabled=true`,
    [tenantId]
  );

  const source = await client.query(
    `INSERT INTO ingestion_sources(source_key, name, source_type, license_name, license_status, allowed_use, refresh_interval_hours, requires_human_review, last_success_at, next_run_at)
     VALUES('manual_seed','Base inicial sanitizada Berisa','internal','Dataset interno sanitizado','approved','Carga inicial de demostración y piloto.',720,true,now(),now() + interval '720 hours')
     ON CONFLICT (source_key) DO UPDATE SET last_success_at=now(), license_status='approved'
     RETURNING id`,
  );
  const sourceId = source.rows[0].id;

  const run = await client.query(
    `INSERT INTO ingestion_runs(source_id, status, mode, records_seen, started_at, created_by)
     VALUES($1,'running','seed',$2,now(),$3)
     RETURNING id`,
    [sourceId, projects.length, adminId]
  );
  const runId = run.rows[0].id;

  let upserted = 0;
  for (const p of projects) {
    const contacts = [];
    const externalId = String(p.id);
    const recordHash = sha256(p);
    const record = await client.query(
      `INSERT INTO source_records(source_id, external_id, record_hash, payload, source_updated_at, valid_from, valid_until, license_status, data_quality_score)
       VALUES($1,$2,$3,$4,now(),CURRENT_DATE,CURRENT_DATE + interval '24 months','approved',$5)
       ON CONFLICT(source_id, external_id) DO UPDATE SET
         record_hash=excluded.record_hash,
         payload=excluded.payload,
         source_updated_at=excluded.source_updated_at,
         valid_until=excluded.valid_until,
         license_status=excluded.license_status,
         data_quality_score=excluded.data_quality_score
       RETURNING id`,
      [sourceId, externalId, recordHash, JSON.stringify(sanitizeSourcePayload({ ...p, cts: undefined, contacts: undefined })), dataQuality(p)]
    );
    const sourceRecordId = record.rows[0].id;

    await client.query(
      `INSERT INTO projects(id, name, owner_name, sector, country, region, status, investment_musd,
        start_date, end_date, latitude, longitude, score, opportunity_status, opportunity_label, description,
        contact_count, contacts, source_payload)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        owner_name=excluded.owner_name,
        sector=excluded.sector,
        country=excluded.country,
        region=excluded.region,
        status=excluded.status,
        investment_musd=excluded.investment_musd,
        start_date=excluded.start_date,
        end_date=excluded.end_date,
        latitude=excluded.latitude,
        longitude=excluded.longitude,
        score=excluded.score,
        opportunity_status=excluded.opportunity_status,
        opportunity_label=excluded.opportunity_label,
        description=excluded.description,
        contact_count=excluded.contact_count,
        contacts=excluded.contacts,
        source_payload=excluded.source_payload`,
      [
        p.id,
        p.n,
        p.own ?? null,
        p.s ?? null,
        p.c ?? null,
        p.region ?? p.loc ?? null,
        p.st ?? null,
        p.inv ?? null,
        asDate(p.ini),
        asDate(p.fin),
        p.lat ?? null,
        p.lng ?? null,
        p.score ?? null,
        p.opp ?? null,
        p.opp_lbl ?? null,
        p.desc ?? null,
        0,
        JSON.stringify([]),
        JSON.stringify({ source: "manual_seed", originalId: p.id })
      ]
    );

    await client.query(
      `INSERT INTO project_sources(project_id, source_record_id, source_id, field_coverage, confidence, is_primary)
       VALUES($1,$2,$3,$4,$5,true)
       ON CONFLICT(project_id, source_record_id) DO UPDATE SET confidence=excluded.confidence, field_coverage=excluded.field_coverage, is_primary=true`,
      [p.id, sourceRecordId, sourceId, JSON.stringify({ name: true, owner: Boolean(p.own), investment: p.inv !== null && p.inv !== undefined, geo: Boolean(p.lat && p.lng), contacts: false }), dataQuality(p)]
    );
    upserted += 1;
  }

  const candidates = projects
    .filter((p) => initialStage(p))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.inv || 0) - (a.inv || 0))
    .slice(0, 350);

  let i = 0;
  for (const p of candidates) {
    await client.query(
      `INSERT INTO opportunities(project_id, tenant_id, stage, value_musd, probability, next_action_date, account_owner_id, created_by, notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8)
       ON CONFLICT(project_id, tenant_id) DO NOTHING`,
      [
        p.id,
        tenantId,
        initialStage(p),
        p.inv ?? null,
        probability(p),
        nextAction(i),
        adminId,
        "Oportunidad generada desde priorización inicial. Validar información antes de gestión comercial."
      ]
    );
    i += 1;
  }

  await client.query(
    `INSERT INTO alert_rules(tenant_id, name, description, sector, opportunity_status, min_score, frequency, channel, enabled, created_by)
     VALUES
       ($1,'Oportunidades accionables de alta relevancia','Proyectos con ventana comercial activa y score alto.',NULL,'green',4,'daily','in_app',true,$2),
       ($1,'Energía en preparación','Seguimiento de proyectos de energía en etapa de preparación.', 'Energía','yellow',3,'weekly','in_app',true,$2)
     ON CONFLICT DO NOTHING`,
    [tenantId, adminId]
  );

  await client.query(
    `INSERT INTO commercial_targets(tenant_id, period_start, period_end, target_pipeline_musd, target_won_musd, target_new_opportunities)
     VALUES($1, date_trunc('month', CURRENT_DATE)::date, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date, 1000, 25, 20)
     ON CONFLICT(tenant_id, period_start, period_end) DO NOTHING`,
    [tenantId]
  );

  await client.query(
    `UPDATE ingestion_runs
     SET status='success', records_upserted=$2, completed_at=now(), metadata=$3
     WHERE id=$1`,
    [runId, upserted, JSON.stringify({ note: "Seed con trazabilidad por fuente y licencia." })]
  );
});

await pool.end();
console.log(`Seed completed: ${projects.length} projects loaded with tenant, source lineage and default alert rules`);
