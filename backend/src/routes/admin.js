import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { audit } from "../audit.js";
import { createTokenValue, hashToken, safeText } from "../security.js";
import { requireAuth, requireTenantAdmin, requirePlatformAdmin, isPlatformAdmin } from "../middleware/auth.js";

export const adminRouter = express.Router();
adminRouter.use(requireAuth);

adminRouter.get("/tenants", requirePlatformAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT t.id, t.name, t.legal_name, t.plan, t.status, t.monthly_price_usd, t.created_at,
            coalesce(count(tm.user_id),0)::int AS users
     FROM tenants t
     LEFT JOIN tenant_memberships tm ON tm.tenant_id=t.id
     GROUP BY t.id
     ORDER BY t.created_at DESC`
  );
  res.json({ tenants: rows });
});

adminRouter.post("/tenants", requirePlatformAdmin, async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(120),
    legalName: z.string().max(180).optional().nullable(),
    plan: z.enum(["pilot", "starter", "professional", "enterprise", "internal"]).default("pilot"),
    billingEmail: z.string().email().optional().nullable(),
    monthlyPriceUsd: z.coerce.number().nonnegative().default(0)
  }).parse(req.body);

  const { rows } = await query(
    `INSERT INTO tenants(name, legal_name, plan, billing_email, monthly_price_usd)
     VALUES($1,$2,$3,$4,$5)
     RETURNING *`,
    [safeText(body.name, 120), safeText(body.legalName, 180), body.plan, body.billingEmail ?? null, body.monthlyPriceUsd]
  );

  await query(
    `INSERT INTO tenant_limits(tenant_id, max_users, max_saved_alerts, max_monthly_exports, api_enabled, contact_visibility, bom_enabled, roi_enabled)
     VALUES($1,
       CASE WHEN $2='enterprise' THEN 100 WHEN $2='professional' THEN 25 ELSE 8 END,
       CASE WHEN $2='enterprise' THEN 200 WHEN $2='professional' THEN 50 ELSE 10 END,
       CASE WHEN $2='enterprise' THEN 1000 WHEN $2='professional' THEN 200 ELSE 20 END,
       $2='enterprise',
       $2 IN ('professional','enterprise','internal'),
       true,
       true)
     ON CONFLICT(tenant_id) DO NOTHING`,
    [rows[0].id, body.plan]
  );
  await audit({ actorId: req.user.id, action: "tenant_created", entity: "tenant", entityId: rows[0].id, ip: req.ip });
  res.status(201).json({ tenant: rows[0] });
});

adminRouter.get("/users", requireTenantAdmin, async (req, res) => {
  const platformScope = isPlatformAdmin(req.user) && req.query.scope === "platform";
  const params = platformScope ? [] : [req.tenant.id];
  const tenantWhere = platformScope ? "" : "WHERE tm.tenant_id=$1";
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.email_verified_at, u.last_login_at, u.created_at,
            coalesce(json_agg(json_build_object('id', t.id, 'name', t.name, 'tenantRole', tm.tenant_role)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tenants
     FROM users u
     LEFT JOIN tenant_memberships tm ON tm.user_id = u.id
     LEFT JOIN tenants t ON t.id = tm.tenant_id
     ${tenantWhere}
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    params
  );
  res.json({ users: rows });
});

adminRouter.patch("/users/:id/approve", requireTenantAdmin, async (req, res) => {
  const body = z.object({
    role: z.enum(["viewer", "analyst", "commercial", "tenant_admin", "platform_admin"]).default("viewer"),
    tenantId: z.string().uuid().optional(),
    tenantRole: z.enum(["owner", "admin", "member", "viewer"]).default("member")
  }).parse(req.body || {});

  const platform = isPlatformAdmin(req.user);
  if (body.role === "platform_admin" && !platform) return res.status(403).json({ error: "Solo platform_admin puede asignar platform_admin." });
  const tenantId = platform && body.tenantId ? body.tenantId : req.tenant.id;
  const effectiveRole = body.role === "tenant_admin" ? "tenant_admin" : body.role;
  const effectiveTenantRole = body.role === "tenant_admin" && body.tenantRole === "member" ? "admin" : body.tenantRole;

  const { rows } = await query(
    `UPDATE users
     SET status='active', role=$2, email_verified_at = coalesce(email_verified_at, now())
     WHERE id=$1
     RETURNING id, name, email, role, status, email_verified_at`,
    [req.params.id, effectiveRole]
  );
  if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado." });

  await query(
    `INSERT INTO tenant_memberships(tenant_id, user_id, tenant_role)
     VALUES($1,$2,$3)
     ON CONFLICT(tenant_id, user_id) DO UPDATE SET tenant_role=excluded.tenant_role`,
    [tenantId, rows[0].id, effectiveTenantRole]
  );

  await audit({ actorId: req.user.id, action: "user_approved", entity: "user", entityId: rows[0].id, metadata: { role: effectiveRole, tenantId, tenantRole: effectiveTenantRole }, ip: req.ip });
  res.json({ user: rows[0] });
});

adminRouter.patch("/users/:id/block", requireTenantAdmin, async (req, res) => {
  if (!isPlatformAdmin(req.user)) {
    const allowed = await query("SELECT 1 FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2", [req.tenant.id, req.params.id]);
    if (!allowed.rows[0]) return res.status(404).json({ error: "Usuario no encontrado en el tenant actual." });
  }
  const { rows } = await query(`UPDATE users SET status='blocked' WHERE id=$1 RETURNING id, name, email, role, status`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado." });
  await audit({ actorId: req.user.id, action: "user_blocked", entity: "user", entityId: rows[0].id, metadata: { tenantId: req.tenant.id }, ip: req.ip });
  res.json({ user: rows[0] });
});

adminRouter.post("/api-keys", requireTenantAdmin, async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(120), scopes: z.array(z.string().max(80)).default(["projects:read"]), expiresAt: z.string().datetime().optional().nullable() }).parse(req.body || {});
  if (!req.tenant.limits.apiEnabled) return res.status(403).json({ error: "API enterprise no habilitada para este tenant." });
  const raw = `${process.env.API_KEY_PREFIX || "brs_live"}_${createTokenValue(32)}`;
  const { rows } = await query(
    `INSERT INTO api_keys(tenant_id, name, key_hash, scopes, expires_at, created_by)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id, tenant_id, name, scopes, expires_at, created_at`,
    [req.tenant.id, safeText(body.name, 120), hashToken(raw), JSON.stringify(body.scopes), body.expiresAt ?? null, req.user.id]
  );
  await audit({ actorId: req.user.id, action: "api_key_created", entity: "api_key", entityId: rows[0].id, metadata: { tenantId: req.tenant.id, scopes: body.scopes }, ip: req.ip });
  res.status(201).json({ apiKey: rows[0], token: raw, warning: "Guarda este token ahora. No será mostrado nuevamente." });
});
