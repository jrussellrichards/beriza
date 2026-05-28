import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../db.js";
import { env } from "../env.js";
import { audit } from "../audit.js";
import { createTokenValue, hashPassword, hashToken, normalizeEmail, safeText, verifyPassword } from "../security.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });

function cookieOptions() {
  return [
    `${env.sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    env.cookieSecure ? "Secure" : "",
    `Max-Age=${8 * 60 * 60}`
  ].filter(Boolean);
}

function setSessionCookie(res, token) {
  const header = cookieOptions();
  header[0] = `${env.sessionCookieName}=${encodeURIComponent(token)}`;
  res.setHeader("Set-Cookie", header.join("; "));
}

function clearSessionCookie(res) {
  const header = cookieOptions();
  header[0] = `${env.sessionCookieName}=`;
  header[header.length - 1] = "Max-Age=0";
  res.setHeader("Set-Cookie", header.join("; "));
}

async function userTenants(userId) {
  const { rows } = await query(
    `SELECT tm.tenant_id AS id, tm.tenant_role, t.name, t.plan, t.status
     FROM tenant_memberships tm
     JOIN tenants t ON t.id = tm.tenant_id
     WHERE tm.user_id=$1 AND t.status IN ('active','trial')
     ORDER BY CASE tm.tenant_role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END`,
    [userId]
  );
  return rows.map((tenant) => ({ id: tenant.id, name: tenant.name, plan: tenant.plan, status: tenant.status, tenantRole: tenant.tenant_role }));
}

authRouter.post("/register", async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(120), email: z.string().email().max(160), password: z.string().min(12).max(200) }).parse(req.body);
  const email = normalizeEmail(body.email);
  const token = createTokenValue();
  const passwordHash = await hashPassword(body.password);

  let created;
  try {
    const { rows } = await query(
      `INSERT INTO users(name, email, password_hash, role, status, verification_token_hash)
       VALUES($1,$2,$3,'viewer','pending',$4)
       RETURNING id, name, email, role, status, created_at`,
      [safeText(body.name, 120), email, passwordHash, hashToken(token)]
    );
    created = rows[0];
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Email ya registrado." });
    throw error;
  }

  await audit({ action: "user_registered", entity: "user", entityId: created.id, ip: req.ip });
  res.status(201).json({
    user: created,
    message: "Usuario creado. Debe ser validado antes de acceder y asignado a una empresa/tenant.",
    verificationToken: env.nodeEnv === "production" ? undefined : token
  });
});

authRouter.post("/verify-email", async (req, res) => {
  const body = z.object({ email: z.string().email(), token: z.string().min(20) }).parse(req.body);
  const { rows } = await query(
    `UPDATE users
     SET email_verified_at = coalesce(email_verified_at, now()), verification_token_hash = NULL
     WHERE email = $1 AND verification_token_hash = $2
     RETURNING id, email, status, email_verified_at`,
    [normalizeEmail(body.email), hashToken(body.token)]
  );
  if (!rows[0]) return res.status(400).json({ error: "Token inválido." });
  await audit({ action: "email_verified", entity: "user", entityId: rows[0].id, ip: req.ip });
  res.json({ message: "Email verificado. El acceso queda sujeto a validación administrativa.", user: rows[0] });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [normalizeEmail(body.email)]);
  const user = rows[0];
  if (!user || !(await verifyPassword(body.password, user.password_hash))) return res.status(401).json({ error: "Credenciales inválidas." });
  if (user.status !== "active" || !user.email_verified_at) return res.status(403).json({ error: "Usuario pendiente de validación." });

  const tenants = await userTenants(user.id);
  if (!tenants.length) return res.status(403).json({ error: "Usuario sin empresa/tenant asociado." });

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await audit({ actorId: user.id, action: "login", entity: "user", entityId: user.id, ip: req.ip });
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  setSessionCookie(res, token);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, tenants, currentTenant: tenants[0] }
  });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  clearSessionCookie(res);
  await audit({ actorId: req.user.id, action: "logout", entity: "user", entityId: req.user.id, ip: req.ip });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: req.user, tenant: req.tenant }));
