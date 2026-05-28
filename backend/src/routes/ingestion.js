import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { requireAuth, requireCommercialAccess, requireTenantAdmin } from "../middleware/auth.js";
import { runDueIngestions, runIngestion } from "../services/ingestion.js";

export const ingestionRouter = express.Router();
ingestionRouter.use(requireAuth);

ingestionRouter.get("/sources", async (req, res) => {
  const { rows } = await query(
    `SELECT s.*,
            (SELECT count(*)::int FROM source_records sr WHERE sr.source_id=s.id) AS records,
            (SELECT max(started_at) FROM ingestion_runs ir WHERE ir.source_id=s.id) AS last_run_at
     FROM ingestion_sources s
     ORDER BY s.source_key`
  );
  res.json({ sources: rows });
});

ingestionRouter.get("/runs", async (req, res) => {
  const input = z.object({ sourceKey: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
  const params = [];
  const where = [];
  if (input.sourceKey) {
    params.push(input.sourceKey);
    where.push(`s.source_key=$${params.length}`);
  }
  params.push(input.limit);
  const { rows } = await query(
    `SELECT ir.*, s.source_key, s.name AS source_name, s.license_status
     FROM ingestion_runs ir
     JOIN ingestion_sources s ON s.id=ir.source_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ir.started_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json({ runs: rows });
});

ingestionRouter.post("/run", requireTenantAdmin, async (req, res) => {
  const body = z.object({
    sourceKey: z.string().min(2).max(80),
    mode: z.enum(["manual", "scheduled", "api"]).default("manual")
  }).parse(req.body);

  const result = await runIngestion({ sourceKey: body.sourceKey, mode: body.mode, actorId: req.user.id });
  await audit({ actorId: req.user.id, action: "ingestion_run", entity: "ingestion_source", entityId: body.sourceKey, metadata: result, ip: req.ip });
  res.status(result.status === "skipped" ? 202 : 201).json({ result });
});

ingestionRouter.post("/run-due", requireTenantAdmin, async (req, res) => {
  const results = await runDueIngestions({ actorId: req.user.id });
  await audit({ actorId: req.user.id, action: "ingestion_due_run", entity: "ingestion", metadata: { results }, ip: req.ip });
  res.json({ results });
});

ingestionRouter.get("/lineage/project/:id", async (req, res) => {
  const { rows } = await query(
    `SELECT ps.project_id, ps.confidence, ps.is_primary, ps.field_coverage, ps.linked_at,
            sr.external_id, sr.record_hash, sr.source_updated_at, sr.valid_from, sr.valid_until,
            sr.license_status AS record_license_status, sr.data_quality_score,
            s.source_key, s.name AS source_name, s.source_type, s.base_url, s.license_name, s.license_status AS source_license_status, s.allowed_use
     FROM project_sources ps
     JOIN source_records sr ON sr.id=ps.source_record_id
     JOIN ingestion_sources s ON s.id=ps.source_id
     WHERE ps.project_id=$1
     ORDER BY ps.is_primary DESC, ps.linked_at DESC`,
    [req.params.id]
  );
  res.json({ lineage: rows });
});
