import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { requireAuth, requireCommercialAccess, requireTenantAdmin } from "../middleware/auth.js";
import { safeText } from "../security.js";

export const roiRouter = express.Router();
roiRouter.use(requireAuth);

roiRouter.get("/summary", async (req, res) => {
  if (!req.tenant.limits.roiEnabled) return res.status(403).json({ error: "ROI no habilitado para el plan del tenant." });

  const [pipeline, events, targets] = await Promise.all([
    query(
      `SELECT
        count(*)::int AS opportunities,
        coalesce(sum(value_musd),0)::float AS pipeline_musd,
        coalesce(sum(value_musd * probability / 100),0)::float AS weighted_pipeline_musd,
        count(*) FILTER (WHERE stage='ganado')::int AS won_count,
        coalesce(sum(value_musd) FILTER (WHERE stage='ganado'),0)::float AS won_musd
       FROM opportunities
       WHERE tenant_id=$1`,
      [req.tenant.id]
    ),
    query(
      `SELECT
        coalesce(sum(amount_usd) FILTER (WHERE event_type IN ('won_revenue','avoided_cost','manual_adjustment')),0)::float AS value_created_usd,
        coalesce(sum(amount_usd) FILTER (WHERE event_type='subscription_cost'),0)::float AS explicit_cost_usd,
        count(*) FILTER (WHERE event_type='meeting_booked')::int AS meetings,
        count(*) FILTER (WHERE event_type='proposal_sent')::int AS proposals
       FROM roi_events
       WHERE tenant_id=$1`,
      [req.tenant.id]
    ),
    query(
      `SELECT * FROM commercial_targets
       WHERE tenant_id=$1 AND CURRENT_DATE BETWEEN period_start AND period_end
       ORDER BY period_start DESC LIMIT 1`,
      [req.tenant.id]
    )
  ]);

  const monthCost = Number(req.tenant.monthlyPriceUsd || 0);
  const explicitCost = Number(events.rows[0].explicit_cost_usd || 0);
  const valueCreated = Number(events.rows[0].value_created_usd || 0);
  const totalCost = explicitCost + monthCost;
  const roi = totalCost > 0 ? ((valueCreated - totalCost) / totalCost) * 100 : null;

  res.json({
    tenant: req.tenant,
    pipeline: pipeline.rows[0],
    outcomes: events.rows[0],
    currentTarget: targets.rows[0] || null,
    economics: {
      monthlySubscriptionCostUsd: monthCost,
      explicitCostUsd: explicitCost,
      totalMeasuredCostUsd: totalCost,
      measuredValueCreatedUsd: valueCreated,
      roiPercent: roi === null ? null : Number(roi.toFixed(2))
    }
  });
});

roiRouter.get("/events", async (req, res) => {
  const input = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
  const { rows } = await query(
    `SELECT re.*, p.name AS project_name, o.stage AS opportunity_stage
     FROM roi_events re
     LEFT JOIN projects p ON p.id=re.project_id
     LEFT JOIN opportunities o ON o.id=re.opportunity_id
     WHERE re.tenant_id=$1
     ORDER BY re.created_at DESC
     LIMIT $2`,
    [req.tenant.id, input.limit]
  );
  res.json({ events: rows });
});

roiRouter.post("/events", requireCommercialAccess, async (req, res) => {
  const body = z.object({
    opportunityId: z.string().uuid().optional().nullable(),
    projectId: z.coerce.number().int().optional().nullable(),
    eventType: z.enum(["lead_created", "meeting_booked", "proposal_sent", "won_revenue", "avoided_cost", "subscription_cost", "manual_adjustment"]),
    amountUsd: z.coerce.number().default(0),
    grossMarginPercent: z.coerce.number().min(0).max(100).optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
  }).parse(req.body);

  if (body.opportunityId) {
    const { rows } = await query("SELECT id FROM opportunities WHERE id=$1 AND tenant_id=$2", [body.opportunityId, req.tenant.id]);
    if (!rows[0]) return res.status(404).json({ error: "Oportunidad no encontrada para el tenant actual." });
  }

  const { rows } = await query(
    `INSERT INTO roi_events(tenant_id, opportunity_id, project_id, event_type, amount_usd, gross_margin_percent, notes, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [req.tenant.id, body.opportunityId ?? null, body.projectId ?? null, body.eventType, body.amountUsd, body.grossMarginPercent ?? null, safeText(body.notes, 1000), req.user.id]
  );
  await audit({ actorId: req.user.id, action: "roi_event_created", entity: "roi_event", entityId: rows[0].id, metadata: { tenantId: req.tenant.id, eventType: body.eventType }, ip: req.ip });
  res.status(201).json({ event: rows[0] });
});

roiRouter.post("/targets", requireTenantAdmin, async (req, res) => {
  const body = z.object({
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
    targetPipelineMusd: z.coerce.number().nonnegative().default(0),
    targetWonMusd: z.coerce.number().nonnegative().default(0),
    targetNewOpportunities: z.coerce.number().int().nonnegative().default(0)
  }).parse(req.body);
  const { rows } = await query(
    `INSERT INTO commercial_targets(tenant_id, period_start, period_end, target_pipeline_musd, target_won_musd, target_new_opportunities)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(tenant_id, period_start, period_end) DO UPDATE SET
       target_pipeline_musd=excluded.target_pipeline_musd,
       target_won_musd=excluded.target_won_musd,
       target_new_opportunities=excluded.target_new_opportunities
     RETURNING *`,
    [req.tenant.id, body.periodStart, body.periodEnd, body.targetPipelineMusd, body.targetWonMusd, body.targetNewOpportunities]
  );
  res.status(201).json({ target: rows[0] });
});
