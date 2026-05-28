import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { env } from "../env.js";

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const idx = item.indexOf("=");
        if (idx === -1) return [item, ""];
        return [decodeURIComponent(item.slice(0, idx)), decodeURIComponent(item.slice(idx + 1))];
      })
  );
}

export function getSessionToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[env.sessionCookieName] || null;
}

export function isPlatformAdmin(user) {
  return user?.role === "platform_admin";
}

export function isTenantAdmin(req) {
  return isPlatformAdmin(req.user) || ["owner", "admin"].includes(req.tenant?.tenantRole);
}

export async function requireAuth(req, res, next) {
  try {
    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ error: "No autorizado." });

    const payload = jwt.verify(token, env.jwtSecret);
    const { rows } = await query(
      "SELECT id, name, email, role, status, email_verified_at FROM users WHERE id = $1",
      [payload.sub]
    );

    const user = rows[0];
    if (!user || user.status !== "active" || !user.email_verified_at) {
      return res.status(401).json({ error: "Usuario no validado." });
    }

    const memberships = await query(
      `SELECT tm.tenant_id AS id, tm.tenant_role, t.name, t.plan, t.status, t.monthly_price_usd,
              tl.api_enabled, tl.contact_visibility, tl.bom_enabled, tl.roi_enabled,
              tl.max_saved_alerts, tl.max_monthly_exports
       FROM tenant_memberships tm
       JOIN tenants t ON t.id = tm.tenant_id
       LEFT JOIN tenant_limits tl ON tl.tenant_id = t.id
       WHERE tm.user_id = $1 AND t.status IN ('active','trial')
       ORDER BY CASE tm.tenant_role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,
                t.created_at ASC`,
      [user.id]
    );

    if (!memberships.rows.length) {
      return res.status(403).json({ error: "Usuario sin empresa/tenant asociado." });
    }

    const requestedTenantId = req.headers["x-berisa-tenant-id"];
    const tenant = requestedTenantId
      ? memberships.rows.find((item) => item.id === requestedTenantId)
      : memberships.rows[0];

    if (!tenant) return res.status(403).json({ error: "Tenant no autorizado para este usuario." });

    req.user = {
      ...user,
      tenants: memberships.rows.map((item) => ({
        id: item.id,
        name: item.name,
        plan: item.plan,
        status: item.status,
        tenantRole: item.tenant_role
      }))
    };
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      tenantRole: tenant.tenant_role,
      monthlyPriceUsd: tenant.monthly_price_usd === null ? 0 : Number(tenant.monthly_price_usd),
      limits: {
        apiEnabled: Boolean(tenant.api_enabled),
        contactVisibility: Boolean(tenant.contact_visibility),
        bomEnabled: tenant.bom_enabled !== false,
        roiEnabled: tenant.roi_enabled !== false,
        maxSavedAlerts: tenant.max_saved_alerts ?? 0,
        maxMonthlyExports: tenant.max_monthly_exports ?? 0
      }
    };
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permisos insuficientes." });
    }
    next();
  };
}

export function requirePlatformAdmin(req, res, next) {
  if (!isPlatformAdmin(req.user)) return res.status(403).json({ error: "Requiere rol platform_admin." });
  next();
}

export function requireTenantAdmin(req, res, next) {
  if (!isTenantAdmin(req)) return res.status(403).json({ error: "Requiere administración del tenant actual." });
  next();
}

export function requireCommercialAccess(req, res, next) {
  if (isPlatformAdmin(req.user) || ["commercial", "tenant_admin"].includes(req.user.role) || ["owner", "admin"].includes(req.tenant?.tenantRole)) {
    return next();
  }
  return res.status(403).json({ error: "Requiere acceso comercial." });
}

export function requireTenantRole(...roles) {
  return (req, res, next) => {
    if (!req.tenant || !roles.includes(req.tenant.tenantRole)) {
      return res.status(403).json({ error: "Permisos insuficientes en el tenant actual." });
    }
    next();
  };
}
