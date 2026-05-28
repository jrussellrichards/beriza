import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, withTransaction } from "../db.js";
import { contactHash, encryptJson, publicContactSummary, sanitizeSourcePayload, stableHash } from "../security.js";
import { resolveCanonicalProject } from "./entityResolution.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ingestDir = path.join(__dirname, "../../data/ingestion");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(value).slice(0, 10);
}

function normalizeContacts(input = {}) {
  const contacts = Array.isArray(input.contacts) ? input.contacts : Array.isArray(input.cts) ? input.cts : [];
  return contacts.filter(Boolean).map((contact) => ({
    nombre: contact.nombre || contact.name || null,
    cargo: contact.cargo || contact.role || contact.cat || null,
    empresa: contact.empresa || contact.company || null,
    email: contact.email || null,
    tel: contact.tel || contact.phone || null,
    cat: contact.cat || contact.category || null,
    tag: contact.tag || null,
    rol_empresa: contact.rol_empresa || contact.companyRole || null
  }));
}

function normalizeProject(input = {}) {
  const id = input.id ?? input.project_id ?? input.external_project_id;
  const externalId = String(input.external_id ?? input.id ?? input.project_id ?? stableHash(input).slice(0, 18));
  const investment = input.investment_musd ?? input.inv ?? input.inversion_musd ?? null;
  const contacts = normalizeContacts(input);
  return {
    externalId,
    id: Number.isFinite(Number(id)) ? Number(id) : null,
    name: input.name ?? input.n ?? input.project_name ?? null,
    ownerName: input.owner_name ?? input.own ?? input.mandante ?? null,
    sector: input.sector ?? input.s ?? null,
    country: input.country ?? input.c ?? "Chile",
    region: input.region ?? input.loc ?? input.creg ?? null,
    status: input.status ?? input.st ?? null,
    investmentMusd: investment === null || investment === undefined || investment === "" ? null : Number(investment),
    startDate: asDate(input.start_date ?? input.ini),
    endDate: asDate(input.end_date ?? input.fin),
    latitude: input.latitude ?? input.lat ?? null,
    longitude: input.longitude ?? input.lng ?? null,
    score: input.score ?? null,
    opportunityStatus: input.opportunity_status ?? input.opp ?? null,
    opportunityLabel: input.opportunity_label ?? input.opp_lbl ?? null,
    description: input.description ?? input.desc ?? null,
    contacts,
    raw: sanitizeSourcePayload({ ...input, cts: undefined, contacts: undefined })
  };
}

function dataQuality(project) {
  let score = 15;
  if (project.name) score += 15;
  if (project.ownerName) score += 10;
  if (project.sector) score += 10;
  if (project.country) score += 5;
  if (project.region) score += 10;
  if (project.investmentMusd !== null && !Number.isNaN(project.investmentMusd)) score += 10;
  if (project.startDate) score += 10;
  if (project.latitude && project.longitude) score += 10;
  if (project.contacts.length) score += 5;
  return Math.min(100, score);
}

async function readFileJson(sourceKey) {
  const file = path.join(ingestDir, `${sourceKey}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const payload = JSON.parse(raw);
    return Array.isArray(payload) ? payload : payload.records || [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function fetchHttpJson(source) {
  const config = source.connector_config || {};
  if (!config.url && !source.base_url) throw new Error("http_json requiere connector_config.url o base_url.");
  const url = config.url || source.base_url;
  const headers = { Accept: "application/json", ...(config.headers || {}) };
  if (config.token_env && process.env[config.token_env]) headers.Authorization = `Bearer ${process.env[config.token_env]}`;
  const retries = Number(config.retries ?? 3);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return Array.isArray(payload) ? payload : payload.records || payload.data || [];
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(Math.min(5000, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function readSourceRecords(source) {
  if (source.connector_type === "http_json") return fetchHttpJson(source);
  if (source.connector_type === "file_json") return readFileJson(source.source_key);
  return [];
}

async function storeContacts(client, { projectId, sourceRecordId, contacts }) {
  for (const contact of contacts) {
    const hash = contactHash(contact);
    const summary = publicContactSummary(contact);
    await client.query(
      `INSERT INTO contact_records(project_id, source_record_id, contact_hash, role, company, category, encrypted_payload, lawful_basis, source_note, status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'legitimate_interest_b2b_preliminary','Ingesta trazable; PII cifrada y minimizada.','active')
       ON CONFLICT(project_id, contact_hash) DO UPDATE SET
         source_record_id=excluded.source_record_id,
         role=excluded.role,
         company=excluded.company,
         category=excluded.category,
         encrypted_payload=excluded.encrypted_payload,
         status='active'`,
      [projectId, sourceRecordId, hash, summary.role, summary.company, summary.category, encryptJson(contact)]
    );
  }
}

export async function runIngestion({ sourceKey, mode = "manual", actorId = null }) {
  const sourceResult = await query("SELECT * FROM ingestion_sources WHERE source_key=$1", [sourceKey]);
  const source = sourceResult.rows[0];
  if (!source) throw new Error(`Fuente no registrada: ${sourceKey}`);
  if (!source.enabled) throw new Error(`Fuente deshabilitada: ${sourceKey}`);
  if (["not_allowed", "expired", "restricted"].includes(source.license_status)) throw new Error(`Fuente no habilitada por licencia: ${sourceKey}`);

  const run = await query(
    `INSERT INTO ingestion_runs(source_id, status, mode, connector_type, created_by)
     VALUES($1,'running',$2,$3,$4) RETURNING id`,
    [source.id, mode, source.connector_type, actorId]
  );
  const runId = run.rows[0].id;
  let records = [];
  try {
    records = await readSourceRecords(source);
  } catch (error) {
    await query(`UPDATE ingestion_runs SET status='failed', completed_at=now(), error_message=$2 WHERE id=$1`, [runId, error.message]);
    await query(`UPDATE ingestion_sources SET consecutive_failures=consecutive_failures+1, last_error=$2, next_run_at=now() + interval '6 hours' WHERE id=$1`, [source.id, error.message]);
    throw error;
  }

  if (!records.length) {
    await query(`UPDATE ingestion_runs SET status='skipped', records_seen=0, completed_at=now(), metadata=$2 WHERE id=$1`, [runId, JSON.stringify({ message: "Sin registros disponibles para esta corrida." })]);
    await query(`UPDATE ingestion_sources SET next_run_at=now() + (refresh_interval_hours::text || ' hours')::interval WHERE id=$1`, [source.id]);
    return { runId, sourceKey, status: "skipped", recordsSeen: 0, recordsUpserted: 0, recordsRejected: 0 };
  }

  let upserted = 0;
  let rejected = 0;
  await withTransaction(async (client) => {
    for (const input of records) {
      const p = normalizeProject(input);
      if (!p.name) { rejected += 1; continue; }
      const recordHash = stableHash(p.raw);
      const record = await client.query(
        `INSERT INTO source_records(source_id, external_id, record_hash, payload, source_updated_at, valid_from, valid_until, license_status, data_quality_score)
         VALUES($1,$2,$3,$4,now(),CURRENT_DATE,CURRENT_DATE + ($5::text || ' days')::interval,$6,$7)
         ON CONFLICT(source_id, external_id) DO UPDATE SET record_hash=excluded.record_hash, payload=excluded.payload, source_updated_at=excluded.source_updated_at, valid_until=excluded.valid_until, license_status=excluded.license_status, data_quality_score=excluded.data_quality_score
         RETURNING id`,
        [source.id, p.externalId, recordHash, JSON.stringify(p.raw), source.retention_days, source.license_status, dataQuality(p)]
      );
      const sourceRecordId = record.rows[0].id;
      const resolved = await resolveCanonicalProject({ client, sourceId: source.id, externalId: p.externalId, project: p });
      const projectId = p.id ?? resolved.projectId;
      await client.query(
        `INSERT INTO projects(id, name, owner_name, sector, country, region, status, investment_musd, start_date, end_date, latitude, longitude, score, opportunity_status, opportunity_label, description, contact_count, contacts, source_payload)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,'[]'::jsonb,$17)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, owner_name=coalesce(excluded.owner_name, projects.owner_name), sector=coalesce(excluded.sector, projects.sector), country=coalesce(excluded.country, projects.country), region=coalesce(excluded.region, projects.region), status=coalesce(excluded.status, projects.status), investment_musd=coalesce(excluded.investment_musd, projects.investment_musd), start_date=coalesce(excluded.start_date, projects.start_date), end_date=coalesce(excluded.end_date, projects.end_date), latitude=coalesce(excluded.latitude, projects.latitude), longitude=coalesce(excluded.longitude, projects.longitude), score=coalesce(excluded.score, projects.score), opportunity_status=coalesce(excluded.opportunity_status, projects.opportunity_status), opportunity_label=coalesce(excluded.opportunity_label, projects.opportunity_label), description=coalesce(excluded.description, projects.description), contacts='[]'::jsonb, source_payload=projects.source_payload || excluded.source_payload`,
        [projectId, p.name, p.ownerName, p.sector, p.country, p.region, p.status, Number.isNaN(p.investmentMusd) ? null : p.investmentMusd, p.startDate, p.endDate, p.latitude, p.longitude, p.score, p.opportunityStatus, p.opportunityLabel, p.description, JSON.stringify({ [sourceKey]: { externalId: p.externalId, ingestedAt: new Date().toISOString(), resolution: resolved } })]
      );
      await storeContacts(client, { projectId, sourceRecordId, contacts: p.contacts });
      await client.query(`UPDATE projects SET contact_count=(SELECT count(*)::int FROM contact_records WHERE project_id=$1 AND status='active') WHERE id=$1`, [projectId]);
      await client.query(
        `INSERT INTO project_sources(project_id, source_record_id, source_id, field_coverage, confidence, is_primary)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(project_id, source_record_id) DO UPDATE SET field_coverage=excluded.field_coverage, confidence=excluded.confidence`,
        [projectId, sourceRecordId, source.id, JSON.stringify({ name: true, owner: Boolean(p.ownerName), investment: p.investmentMusd !== null, geo: Boolean(p.latitude && p.longitude), contacts: p.contacts.length > 0 }), dataQuality(p), source.source_key === "manual_seed"]
      );
      upserted += 1;
    }
  });

  const status = rejected > 0 ? "partial" : "success";
  await query(`UPDATE ingestion_runs SET status=$2, records_seen=$3, records_upserted=$4, records_rejected=$5, completed_at=now(), metadata=$6 WHERE id=$1`, [runId, status, records.length, upserted, rejected, JSON.stringify({ sourceKey, licenseStatus: source.license_status })]);
  await query(`UPDATE ingestion_sources SET last_success_at=now(), consecutive_failures=0, last_error=NULL, next_run_at=now() + (refresh_interval_hours::text || ' hours')::interval WHERE id=$1`, [source.id]);
  return { runId, sourceKey, status, recordsSeen: records.length, recordsUpserted: upserted, recordsRejected: rejected };
}

export async function runDueIngestions({ actorId = null } = {}) {
  const { rows } = await query(`SELECT source_key FROM ingestion_sources WHERE enabled=true AND (next_run_at IS NULL OR next_run_at <= now()) AND license_status='approved' ORDER BY next_run_at NULLS FIRST LIMIT 10`);
  const results = [];
  for (const row of rows) {
    try { results.push(await runIngestion({ sourceKey: row.source_key, mode: "scheduled", actorId })); }
    catch (error) { results.push({ sourceKey: row.source_key, status: "failed", error: error.message }); }
  }
  return results;
}
