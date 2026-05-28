import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { requireAuth, requireCommercialAccess, requireTenantAdmin } from "../middleware/auth.js";
import { estimateProjectBom } from "../services/bom.js";

export const bomRouter = express.Router();
bomRouter.use(requireAuth);

bomRouter.get("/assumptions", async (req, res) => {
  const { rows } = await query("SELECT * FROM bom_assumptions ORDER BY sector, item_code");
  res.json({ assumptions: rows });
});

bomRouter.post("/assumptions", requireTenantAdmin, async (req, res) => {
  const body = z.object({
    sector: z.string().min(1).max(120),
    itemCode: z.string().min(2).max(60),
    itemName: z.string().min(2).max(180),
    unit: z.string().min(1).max(30),
    factorPerMusd: z.coerce.number().nonnegative(),
    minQuantity: z.coerce.number().nonnegative().default(0),
    maxQuantity: z.coerce.number().nonnegative().nullable().optional(),
    confidence: z.coerce.number().int().min(0).max(100).default(50),
    sourceNote: z.string().min(5).max(1000),
    status: z.enum(["draft", "active", "retired"]).default("draft")
  }).parse(req.body);

  const { rows } = await query(
    `INSERT INTO bom_assumptions(sector, item_code, item_name, unit, factor_per_musd, min_quantity, max_quantity, confidence, source_note, status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT(sector, item_code) DO UPDATE SET
       item_name=excluded.item_name,
       unit=excluded.unit,
       factor_per_musd=excluded.factor_per_musd,
       min_quantity=excluded.min_quantity,
       max_quantity=excluded.max_quantity,
       confidence=excluded.confidence,
       source_note=excluded.source_note,
       status=excluded.status
     RETURNING *`,
    [body.sector, body.itemCode, body.itemName, body.unit, body.factorPerMusd, body.minQuantity, body.maxQuantity ?? null, body.confidence, body.sourceNote, body.status]
  );
  await audit({ actorId: req.user.id, action: "bom_assumption_upserted", entity: "bom_assumption", entityId: rows[0].id, ip: req.ip });
  res.status(201).json({ assumption: rows[0] });
});

bomRouter.post("/projects/:id/estimate", requireCommercialAccess, async (req, res) => {
  if (!req.tenant.limits.bomEnabled) return res.status(403).json({ error: "BOM no habilitado para el plan del tenant." });
  const estimate = await estimateProjectBom({ projectId: req.params.id, tenantId: req.tenant.id, userId: req.user.id });
  await audit({ actorId: req.user.id, action: "bom_estimated", entity: "project", entityId: String(req.params.id), metadata: { estimateId: estimate.id, tenantId: req.tenant.id }, ip: req.ip });
  res.status(201).json({ estimate });
});

bomRouter.get("/projects/:id/estimates", async (req, res) => {
  const input = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);
  const { rows } = await query(
    `SELECT * FROM project_bom_estimates
     WHERE project_id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)
     ORDER BY created_at DESC
     LIMIT $3`,
    [req.params.id, req.tenant.id, input.limit]
  );
  res.json({ estimates: rows });
});
