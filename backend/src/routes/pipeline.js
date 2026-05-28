import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { requireAuth, requireCommercialAccess, requireTenantAdmin } from "../middleware/auth.js";
import { safeText } from "../security.js";

export const pipelineRouter = express.Router();
pipelineRouter.use(requireAuth);

const stages = ["prospecto", "calificacion", "contactado", "propuesta", "negociacion", "ganado", "perdido"];

function shapeOpportunity(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    stage: row.stage,
    valueMusd: row.value_musd === null ? null : Number(row.value_musd),
    probability: row.probability,
    weightedValueMusd: row.value_musd === null ? null : Number(row.value_musd) * row.probability / 100,
    nextActionDate: row.next_action_date,
    notes: row.notes,
    owner: row.account_owner_id ? { id: row.account_owner_id, name: row.account_owner_name } : null,
    project: {
      id: row.project_id,
      name: row.project_name,
      ownerName: row.project_owner,
      sector: row.sector,
      country: row.country,
      region: row.region,
      score: row.score,
      contactCount: row.contact_count
    }
  };
}

pipelineRouter.get("/summary", async (req, res) => {
  const { rows } = await query(
    `SELECT
      stage,
      count(*)::int AS count,
      coalesce(sum(value_musd),0)::float AS value_musd,
      coalesce(sum(value_musd * probability / 100),0)::float AS weighted_value_musd
    FROM opportunities
    WHERE tenant_id=$1
    GROUP BY stage`,
    [req.tenant.id]
  );

  const byStage = Object.fromEntries(stages.map((stage) => [stage, { count: 0, valueMusd: 0, weightedValueMusd: 0 }]));
  for (const row of rows) {
    byStage[row.stage] = {
      count: row.count,
      valueMusd: Number(row.value_musd),
      weightedValueMusd: Number(row.weighted_value_musd)
    };
  }

  res.json({ stages: byStage, tenant: req.tenant });
});

pipelineRouter.get("/opportunities", async (req, res) => {
  const input = z.object({
    stage: z.enum(stages).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(60)
  }).parse(req.query);

  const params = [req.tenant.id];
  const where = ["o.tenant_id = $1"];
  if (input.stage) {
    params.push(input.stage);
    where.push(`o.stage = $${params.length}`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const count = await query(`SELECT count(*)::int AS count FROM opportunities o ${whereSql}`, params);
  const offset = (input.page - 1) * input.pageSize;
  const dataParams = [...params, input.pageSize, offset];

  const { rows } = await query(
    `SELECT o.*,
            u.name AS account_owner_name,
            p.name AS project_name,
            p.owner_name AS project_owner,
            p.sector,
            p.country,
            p.region,
            p.score,
            p.contact_count
     FROM opportunities o
     JOIN projects p ON p.id = o.project_id
     LEFT JOIN users u ON u.id = o.account_owner_id
     ${whereSql}
     ORDER BY
       CASE o.stage
         WHEN 'contactado' THEN 1
         WHEN 'calificacion' THEN 2
         WHEN 'propuesta' THEN 3
         WHEN 'negociacion' THEN 4
         WHEN 'prospecto' THEN 5
         WHEN 'ganado' THEN 6
         WHEN 'perdido' THEN 7
       END,
       o.next_action_date NULLS LAST,
       coalesce(p.score,0) DESC,
       coalesce(o.value_musd,0) DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  res.json({ opportunities: rows.map(shapeOpportunity), page: input.page, pageSize: input.pageSize, total: count.rows[0].count });
});

pipelineRouter.post("/opportunities", requireCommercialAccess, async (req, res) => {
  const body = z.object({
    projectId: z.coerce.number().int(),
    stage: z.enum(stages).default("prospecto"),
    valueMusd: z.coerce.number().nonnegative().nullable().optional(),
    probability: z.coerce.number().int().min(0).max(100).default(10),
    nextActionDate: z.string().date().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  }).parse(req.body);

  const { rows } = await query(
    `INSERT INTO opportunities(project_id, tenant_id, stage, value_musd, probability, next_action_date, notes, created_by, account_owner_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)
     ON CONFLICT(project_id, tenant_id)
     DO UPDATE SET stage=excluded.stage, value_musd=excluded.value_musd, probability=excluded.probability,
                   next_action_date=excluded.next_action_date, notes=excluded.notes
     RETURNING *`,
    [body.projectId, req.tenant.id, body.stage, body.valueMusd ?? null, body.probability, body.nextActionDate ?? null, safeText(body.notes, 2000), req.user.id]
  );

  await audit({ actorId: req.user.id, action: "opportunity_upserted", entity: "opportunity", entityId: rows[0].id, metadata: { tenantId: req.tenant.id }, ip: req.ip });
  res.status(201).json({ opportunity: rows[0] });
});

pipelineRouter.patch("/opportunities/:id", requireCommercialAccess, async (req, res) => {
  const body = z.object({
    stage: z.enum(stages).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    nextActionDate: z.string().date().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  }).parse(req.body);

  const { rows: currentRows } = await query("SELECT * FROM opportunities WHERE id=$1 AND tenant_id=$2", [req.params.id, req.tenant.id]);
  if (!currentRows[0]) return res.status(404).json({ error: "Oportunidad no encontrada." });

  const current = currentRows[0];
  const { rows } = await query(
    `UPDATE opportunities
     SET stage=$2, probability=$3, next_action_date=$4, notes=$5
     WHERE id=$1 AND tenant_id=$6
     RETURNING *`,
    [
      req.params.id,
      body.stage ?? current.stage,
      body.probability ?? current.probability,
      body.nextActionDate === undefined ? current.next_action_date : body.nextActionDate,
      body.notes === undefined ? current.notes : safeText(body.notes, 2000),
      req.tenant.id
    ]
  );

  if (body.stage === "ganado" && current.stage !== "ganado") {
    await query(
      `INSERT INTO roi_events(tenant_id, opportunity_id, project_id, event_type, amount_usd, notes, created_by)
       VALUES($1,$2,$3,'won_revenue',coalesce($4,0) * 1000000,'Oportunidad marcada como ganada desde pipeline.', $5)`,
      [req.tenant.id, rows[0].id, rows[0].project_id, rows[0].value_musd, req.user.id]
    );
  }

  await audit({ actorId: req.user.id, action: "opportunity_updated", entity: "opportunity", entityId: rows[0].id, metadata: { ...body, tenantId: req.tenant.id }, ip: req.ip });
  res.json({ opportunity: rows[0] });
});
