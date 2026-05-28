import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { hashToken } from "../security.js";

export const enterpriseRouter = express.Router();

async function requireApiKey(req, res, next) {
  const raw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.headers["x-api-key"];
  if (!raw) return res.status(401).json({ error: "API key requerida." });
  const keyHash = hashToken(raw);
  const { rows } = await query(
    `SELECT ak.*, t.status AS tenant_status, tl.api_enabled
     FROM api_keys ak
     JOIN tenants t ON t.id=ak.tenant_id
     LEFT JOIN tenant_limits tl ON tl.tenant_id=t.id
     WHERE ak.key_hash=$1 AND ak.status='active' AND (ak.expires_at IS NULL OR ak.expires_at > now())`,
    [keyHash]
  );
  const apiKey = rows[0];
  if (!apiKey || apiKey.tenant_status !== "active" || !apiKey.api_enabled) return res.status(403).json({ error: "API key no autorizada." });
  req.apiKey = apiKey;
  req.tenant = { id: apiKey.tenant_id };
  await query("UPDATE api_keys SET last_used_at=now() WHERE id=$1", [apiKey.id]);
  next();
}

function hasScope(req, scope) {
  const scopes = Array.isArray(req.apiKey.scopes) ? req.apiKey.scopes : [];
  return scopes.includes(scope) || scopes.includes("*");
}

enterpriseRouter.use(requireApiKey);

enterpriseRouter.get("/projects", async (req, res) => {
  if (!hasScope(req, "projects:read")) return res.status(403).json({ error: "Scope projects:read requerido." });
  const input = z.object({ sector: z.string().optional(), country: z.string().optional(), minScore: z.coerce.number().int().min(1).max(5).optional(), limit: z.coerce.number().int().min(1).max(500).default(100), cursor: z.coerce.number().int().min(0).default(0) }).parse(req.query);
  const params = [];
  const where = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  if (input.sector) add("sector=?", input.sector);
  if (input.country) add("country=?", input.country);
  if (input.minScore) add("score>=?", input.minScore);
  params.push(input.limit, input.cursor);
  const { rows } = await query(
    `SELECT id, name, owner_name, sector, country, region, status, investment_musd, start_date, end_date, score, opportunity_status, opportunity_label
     FROM projects ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  await query("INSERT INTO api_usage_events(tenant_id, api_key_id, endpoint, method, status_code, rows_returned) VALUES($1,$2,$3,$4,$5,$6)", [req.apiKey.tenant_id, req.apiKey.id, "/api/v1/projects", "GET", 200, rows.length]);
  res.json({ data: rows, nextCursor: rows.length === input.limit ? input.cursor + input.limit : null });
});

enterpriseRouter.get("/projects/:id", async (req, res) => {
  if (!hasScope(req, "projects:read")) return res.status(403).json({ error: "Scope projects:read requerido." });
  const { rows } = await query("SELECT id, name, owner_name, sector, country, region, status, investment_musd, start_date, end_date, score, opportunity_status, opportunity_label, description FROM projects WHERE id=$1", [req.params.id]);
  await query("INSERT INTO api_usage_events(tenant_id, api_key_id, endpoint, method, status_code, rows_returned) VALUES($1,$2,$3,$4,$5,$6)", [req.apiKey.tenant_id, req.apiKey.id, "/api/v1/projects/:id", "GET", rows[0] ? 200 : 404, rows[0] ? 1 : 0]);
  if (!rows[0]) return res.status(404).json({ error: "Proyecto no encontrado." });
  res.json({ data: rows[0] });
});
