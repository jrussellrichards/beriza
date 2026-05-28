import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { requireAuth, requireCommercialAccess } from "../middleware/auth.js";
import { safeText } from "../security.js";
import { evaluateAlerts } from "../services/alerts.js";
import { processPendingDeliveries } from "../services/alertDelivery.js";

export const alertsRouter = express.Router();
alertsRouter.use(requireAuth);

alertsRouter.get("/rules", async (req, res) => {
  const { rows } = await query("SELECT * FROM alert_rules WHERE tenant_id=$1 ORDER BY created_at DESC", [req.tenant.id]);
  res.json({ rules: rows });
});

alertsRouter.post("/rules", requireCommercialAccess, async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(140), description: z.string().max(500).optional().nullable(), sector: z.string().max(120).optional().nullable(), country: z.string().max(80).optional().nullable(), region: z.string().max(160).optional().nullable(), opportunityStatus: z.string().max(40).optional().nullable(), minScore: z.coerce.number().int().min(1).max(5).optional().nullable(), minInvestmentMusd: z.coerce.number().nonnegative().optional().nullable(), latitude: z.coerce.number().optional().nullable(), longitude: z.coerce.number().optional().nullable(), radiusKm: z.coerce.number().positive().optional().nullable(), frequency: z.enum(["realtime", "daily", "weekly"]).default("daily"), channel: z.enum(["in_app", "email", "webhook"]).default("in_app"), emailTo: z.string().email().optional().nullable(), webhookUrl: z.string().url().optional().nullable(), enabled: z.boolean().default(true)
  }).parse(req.body);
  if (body.channel === "email" && !body.emailTo) return res.status(400).json({ error: "emailTo requerido para canal email." });
  if (body.channel === "webhook" && !body.webhookUrl) return res.status(400).json({ error: "webhookUrl requerido para canal webhook." });
  const current = await query("SELECT count(*)::int AS count FROM alert_rules WHERE tenant_id=$1", [req.tenant.id]);
  if (current.rows[0].count >= req.tenant.limits.maxSavedAlerts) return res.status(403).json({ error: "Límite de alertas guardadas alcanzado para el plan actual." });
  const { rows } = await query(
    `INSERT INTO alert_rules(tenant_id, name, description, sector, country, region, opportunity_status, min_score, min_investment_musd, latitude, longitude, radius_km, frequency, channel, email_to, webhook_url, enabled, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [req.tenant.id, safeText(body.name, 140), safeText(body.description, 500), body.sector ?? null, body.country ?? null, body.region ?? null, body.opportunityStatus ?? null, body.minScore ?? null, body.minInvestmentMusd ?? null, body.latitude ?? null, body.longitude ?? null, body.radiusKm ?? null, body.frequency, body.channel, body.emailTo ?? null, body.webhookUrl ?? null, body.enabled, req.user.id]
  );
  await audit({ actorId: req.user.id, action: "alert_rule_created", entity: "alert_rule", entityId: rows[0].id, metadata: { tenantId: req.tenant.id }, ip: req.ip });
  res.status(201).json({ rule: rows[0] });
});

alertsRouter.patch("/rules/:id", requireCommercialAccess, async (req, res) => {
  const body = z.object({ enabled: z.boolean().optional(), name: z.string().min(2).max(140).optional() }).parse(req.body);
  const { rows: currentRows } = await query("SELECT * FROM alert_rules WHERE id=$1 AND tenant_id=$2", [req.params.id, req.tenant.id]);
  if (!currentRows[0]) return res.status(404).json({ error: "Alerta no encontrada." });
  const current = currentRows[0];
  const { rows } = await query(`UPDATE alert_rules SET enabled=$3, name=$4 WHERE id=$1 AND tenant_id=$2 RETURNING *`, [req.params.id, req.tenant.id, body.enabled ?? current.enabled, body.name ?? current.name]);
  res.json({ rule: rows[0] });
});

alertsRouter.post("/evaluate", requireCommercialAccess, async (req, res) => {
  const result = await evaluateAlerts({ tenantId: req.tenant.id });
  const deliveries = await processPendingDeliveries({ limit: 100 });
  await audit({ actorId: req.user.id, action: "alerts_evaluated", entity: "tenant", entityId: req.tenant.id, metadata: { ...result, deliveries }, ip: req.ip });
  res.json({ result: { ...result, deliveriesProcessed: deliveries.length } });
});

alertsRouter.post("/deliveries/process", requireCommercialAccess, async (req, res) => {
  const result = await processPendingDeliveries({ limit: 100 });
  res.json({ deliveries: result });
});

alertsRouter.get("/events", async (req, res) => {
  const input = z.object({ unreadOnly: z.coerce.boolean().default(false), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
  const params = [req.tenant.id];
  const where = ["ae.tenant_id=$1"];
  if (input.unreadOnly) where.push("ae.read_at IS NULL");
  params.push(input.limit);
  const { rows } = await query(
    `SELECT ae.*, p.name AS project_name, p.owner_name, p.sector, p.region, p.country, ar.name AS rule_name, ar.channel
     FROM alert_events ae JOIN projects p ON p.id=ae.project_id JOIN alert_rules ar ON ar.id=ae.rule_id
     WHERE ${where.join(" AND ")} ORDER BY ae.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ events: rows });
});

alertsRouter.patch("/events/:id/read", async (req, res) => {
  const { rows } = await query("UPDATE alert_events SET read_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *", [req.params.id, req.tenant.id]);
  if (!rows[0]) return res.status(404).json({ error: "Evento no encontrado." });
  res.json({ event: rows[0] });
});
