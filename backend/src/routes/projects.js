import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, isPlatformAdmin } from "../middleware/auth.js";
import { decryptJson, publicContactSummary } from "../security.js";

export const projectsRouter = express.Router();
projectsRouter.use(requireAuth);

function canSeeContacts(req) {
  return (isPlatformAdmin(req.user) || ["commercial", "tenant_admin"].includes(req.user.role) || ["owner", "admin"].includes(req.tenant?.tenantRole)) && req.tenant?.limits?.contactVisibility;
}

function shapeProject(row, req, { includeContacts = false, contactsOverride = null, lineage = undefined } = {}) {
  return {
    id: row.id,
    name: row.name,
    ownerName: row.owner_name,
    sector: row.sector,
    country: row.country,
    region: row.region,
    status: row.status,
    investmentMusd: row.investment_musd === null ? null : Number(row.investment_musd),
    startDate: row.start_date,
    endDate: row.end_date,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    score: row.score,
    opportunityStatus: row.opportunity_status,
    opportunityLabel: row.opportunity_label,
    description: row.description,
    contactCount: Number(row.contact_count || 0),
    contacts: includeContacts ? contactsOverride : undefined,
    lineage
  };
}

async function contactsForProject(projectId, req) {
  const { rows } = await query(
    `SELECT cr.id, cr.contact_hash, cr.role, cr.company, cr.category, cr.status, cr.encrypted_payload
     FROM contact_records cr
     LEFT JOIN redacted_contact_hashes rch ON rch.contact_hash = cr.contact_hash
     WHERE cr.project_id=$1 AND cr.status='active' AND rch.contact_hash IS NULL
     ORDER BY cr.company NULLS LAST, cr.role NULLS LAST
     LIMIT 200`,
    [projectId]
  );
  if (!canSeeContacts(req)) return rows.map((r) => ({ contactHash: r.contact_hash, role: r.role, company: r.company, category: r.category, privacyStatus: "protected" }));
  return rows.map((r) => ({ ...publicContactSummary(decryptJson(r.encrypted_payload)), contactHash: r.contact_hash, privacyStatus: "visible" }));
}

projectsRouter.get("/", async (req, res) => {
  const input = z.object({
    q: z.string().optional(), sector: z.string().optional(), status: z.string().optional(), country: z.string().optional(), region: z.string().optional(), opportunity: z.string().optional(), minScore: z.coerce.number().int().min(1).max(5).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25)
  }).parse(req.query);

  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  if (input.q) { params.push(`%${input.q}%`, `%${input.q}%`, `%${input.q}%`); where.push(`(name ILIKE $${params.length - 2} OR owner_name ILIKE $${params.length - 1} OR description ILIKE $${params.length})`); }
  if (input.sector) add("sector = ?", input.sector);
  if (input.status) add("status = ?", input.status);
  if (input.country) add("country = ?", input.country);
  if (input.region) add("region = ?", input.region);
  if (input.opportunity) add("opportunity_status = ?", input.opportunity);
  if (input.minScore) add("score >= ?", input.minScore);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countResult = await query(`SELECT count(*)::int AS count FROM projects ${whereSql}`, params);
  const total = countResult.rows[0].count;
  const offset = (input.page - 1) * input.pageSize;
  const dataParams = [...params, input.pageSize, offset];
  const { rows } = await query(
    `SELECT p.*, (SELECT count(*)::int FROM contact_records cr WHERE cr.project_id=p.id AND cr.status='active') AS contact_count
     FROM projects p ${whereSql}
     ORDER BY coalesce(score,0) DESC, coalesce(investment_musd,0) DESC, id ASC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
  res.json({ projects: rows.map((row) => shapeProject(row, req)), page: input.page, pageSize: input.pageSize, total });
});

projectsRouter.get("/facets", async (req, res) => {
  const [sectors, statuses, countries, regions] = await Promise.all([
    query("SELECT DISTINCT sector AS value FROM projects WHERE sector IS NOT NULL ORDER BY sector"),
    query("SELECT DISTINCT status AS value FROM projects WHERE status IS NOT NULL ORDER BY status"),
    query("SELECT DISTINCT country AS value FROM projects WHERE country IS NOT NULL ORDER BY country"),
    query("SELECT DISTINCT region AS value FROM projects WHERE region IS NOT NULL ORDER BY region")
  ]);
  res.json({ sectors: sectors.rows.map((r) => r.value), statuses: statuses.rows.map((r) => r.value), countries: countries.rows.map((r) => r.value), regions: regions.rows.map((r) => r.value) });
});

projectsRouter.get("/summary", async (req, res) => {
  const { rows } = await query(`
    SELECT count(*)::int AS projects, coalesce(sum(investment_musd),0)::float AS investment_musd,
      count(*) FILTER (WHERE score >= 4)::int AS high_relevance,
      count(*) FILTER (WHERE opportunity_status = 'green')::int AS actionable_now,
      (SELECT count(DISTINCT project_id)::int FROM contact_records WHERE status='active') AS with_contacts,
      count(DISTINCT sector)::int AS sectors, count(DISTINCT country)::int AS countries,
      count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS geolocated
    FROM projects`);
  const lineage = await query(`SELECT count(DISTINCT source_id)::int AS sources, count(*)::int AS source_links, count(*) FILTER (WHERE confidence >= 70)::int AS high_confidence_links FROM project_sources`);
  res.json({ ...rows[0], lineage: lineage.rows[0] });
});

projectsRouter.get("/:id", async (req, res) => {
  const { rows } = await query("SELECT p.*, (SELECT count(*)::int FROM contact_records cr WHERE cr.project_id=p.id AND cr.status='active') AS contact_count FROM projects p WHERE p.id=$1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Proyecto no encontrado." });
  const lineage = await query(
    `SELECT ps.confidence, ps.is_primary, ps.field_coverage, ps.linked_at,
            sr.external_id, sr.valid_from, sr.valid_until, sr.license_status AS record_license_status, sr.data_quality_score,
            s.source_key, s.name AS source_name, s.source_type, s.license_name, s.license_status AS source_license_status, s.allowed_use
     FROM project_sources ps JOIN source_records sr ON sr.id=ps.source_record_id JOIN ingestion_sources s ON s.id=ps.source_id
     WHERE ps.project_id=$1 ORDER BY ps.is_primary DESC, ps.linked_at DESC`,
    [req.params.id]
  );
  const contacts = await contactsForProject(rows[0].id, req);
  res.json({ project: shapeProject(rows[0], req, { includeContacts: true, contactsOverride: contacts, lineage: lineage.rows }) });
});
