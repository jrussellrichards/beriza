import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireTenantAdmin, isPlatformAdmin } from "../middleware/auth.js";
import { contactHash, safeText } from "../security.js";
import { redactContactByHash } from "../services/privacy.js";

export const privacyRouter = express.Router();

privacyRouter.get("/policy", (req, res) => {
  res.json({ policy: { purpose: "Inteligencia comercial B2B sobre proyectos e inversión, con trazabilidad de fuente y controles de acceso.", lawfulBasis: "Debe ser definida por asesoría legal según mercado, fuente y jurisdicción antes de producción.", controls: ["minimización", "PII cifrada", "multi-tenant", "roles", "redacción física/lógica", "solicitudes de titulares", "auditoría"], warning: "La plataforma incluye controles técnicos, pero no reemplaza una revisión legal formal antes de comercializar datos personales." } });
});

privacyRouter.post("/requests", async (req, res) => {
  const body = z.object({ requestType: z.enum(["access", "rectification", "deletion", "objection", "source_information", "consent_review"]), subjectName: z.string().max(160).optional().nullable(), subjectEmail: z.string().email().optional().nullable(), subjectPhone: z.string().max(80).optional().nullable(), projectId: z.coerce.number().int().optional().nullable(), tenantId: z.string().uuid().optional().nullable(), requestBody: z.string().min(10).max(4000) }).parse(req.body);
  const hash = contactHash({ nombre: body.subjectName, email: body.subjectEmail, tel: body.subjectPhone });
  const { rows } = await query(
    `INSERT INTO data_subject_requests(tenant_id, request_type, subject_name, subject_email, subject_phone, contact_hash, project_id, request_body)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, status, received_at`,
    [body.tenantId ?? null, body.requestType, safeText(body.subjectName, 160), body.subjectEmail ?? null, safeText(body.subjectPhone, 80), hash, body.projectId ?? null, safeText(body.requestBody, 4000)]
  );
  res.status(201).json({ request: rows[0], contactHash: hash });
});

privacyRouter.use(requireAuth);

privacyRouter.get("/requests", requireTenantAdmin, async (req, res) => {
  const input = z.object({ status: z.enum(["open", "in_review", "resolved", "rejected"]).optional(), limit: z.coerce.number().int().min(1).max(200).default(50), scope: z.enum(["tenant", "platform"]).default("tenant") }).parse(req.query);
  const params = [];
  const where = [];
  if (!(isPlatformAdmin(req.user) && input.scope === "platform")) { params.push(req.tenant.id); where.push(`tenant_id=$${params.length}`); }
  if (input.status) { params.push(input.status); where.push(`status=$${params.length}`); }
  params.push(input.limit);
  const { rows } = await query(`SELECT * FROM data_subject_requests ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY received_at DESC LIMIT $${params.length}`, params);
  res.json({ requests: rows });
});

privacyRouter.patch("/requests/:id", requireTenantAdmin, async (req, res) => {
  const body = z.object({ status: z.enum(["open", "in_review", "resolved", "rejected"]), resolutionNotes: z.string().max(4000).optional().nullable(), redactContact: z.boolean().default(false), lawfulBasis: z.string().max(300).optional().nullable() }).parse(req.body);
  const params = [req.params.id];
  const where = ["id=$1"];
  if (!isPlatformAdmin(req.user)) { params.push(req.tenant.id); where.push(`tenant_id=$${params.length}`); }
  const { rows: currentRows } = await query(`SELECT * FROM data_subject_requests WHERE ${where.join(" AND ")}`, params);
  if (!currentRows[0]) return res.status(404).json({ error: "Solicitud no encontrada." });
  const current = currentRows[0];
  const { rows } = await query(
    `UPDATE data_subject_requests SET status=$2, resolution_notes=$3, resolved_at=CASE WHEN $2 IN ('resolved','rejected') THEN now() ELSE resolved_at END, handled_by=$4 WHERE id=$1 RETURNING *`,
    [req.params.id, body.status, safeText(body.resolutionNotes, 4000), req.user.id]
  );
  if (body.redactContact && current.contact_hash) {
    await redactContactByHash({ contactHash: current.contact_hash, reason: body.resolutionNotes || "Redacción solicitada por titular de datos.", actorId: req.user.id, tenantId: req.tenant.id });
  }
  await query(
    `INSERT INTO privacy_audit_events(tenant_id, actor_user_id, action, entity, entity_id, lawful_basis, metadata)
     VALUES($1,$2,'data_subject_request_updated','data_subject_request',$3,$4,$5)`,
    [req.tenant.id, req.user.id, req.params.id, safeText(body.lawfulBasis, 300), JSON.stringify({ status: body.status, redactContact: body.redactContact })]
  );
  res.json({ request: rows[0] });
});

privacyRouter.post("/contact-hash", requireTenantAdmin, (req, res) => {
  const body = z.object({ nombre: z.string().optional(), email: z.string().optional(), tel: z.string().optional(), empresa: z.string().optional() }).parse(req.body || {});
  res.json({ contactHash: contactHash(body) });
});
