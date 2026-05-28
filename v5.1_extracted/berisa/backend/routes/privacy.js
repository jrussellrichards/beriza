'use strict';
/** Privacy module — Ley 19.628 / GDPR */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// GET /privacy/policy
router.get('/policy', (_req, res) => {
  res.json({
    version: '1.0', effective: '2026-05-26',
    controller: { name: 'BERISA', email: 'privacidad@berisa.com', country: 'CL' },
    lawBasis: 'Ley 19.628 (Chile) / GDPR (cuando aplique)',
    dataTypes: ['contactos_comerciales','documentos_tributarios','datos_laborales','documentos_homologacion'],
    rights: ['acceso','rectificacion','cancelacion','oposicion','portabilidad'],
    retention: { audit_logs: '365 days', contacts: 'duration of contract + 1 year', documents: '5 years (legal)' },
    contact: 'privacidad@berisa.com',
  });
});

// POST /privacy/requests — submit a privacy request
router.post('/requests', async (req, res, next) => {
  try {
    const { requester_email, request_type, description } = req.body;
    const TYPES = ['access','rectification','deletion','portability','objection'];
    if (!requester_email || !request_type) return res.status(400).json({ error: 'Email y tipo requeridos' });
    if (!TYPES.includes(request_type)) return res.status(400).json({ error: `Tipo inválido. Opciones: ${TYPES.join(', ')}` });
    const { rows: [r] } = await query(
      'INSERT INTO privacy_requests(org_id,requester_email,request_type,description) VALUES($1,$2,$3,$4) RETURNING *',
      [req.org?.id || null, requester_email.toLowerCase(), request_type, description || null]
    );
    res.status(201).json({ ...r, message: 'Solicitud registrada. Responderemos en 30 días hábiles según la ley.' });
  } catch(err) { next(err); }
});

// GET /privacy/requests (admin)
router.get('/requests', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const conds = ['org_id=$1'], vals = [req.org.id];
    if (status) { conds.push(`status=$2`); vals.push(status); }
    const { rows } = await query(`SELECT * FROM privacy_requests WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`, vals);
    res.json(rows);
  } catch(err) { next(err); }
});

// PATCH /privacy/requests/:id (admin)
router.patch('/requests/:id', requireAdmin, async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    const VALID = ['pending','in_review','resolved','rejected'];
    if (!VALID.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    const resolved_at = ['resolved','rejected'].includes(status) ? new Date() : null;
    const { rows } = await query(
      'UPDATE privacy_requests SET status=$1,resolution=$2,resolved_at=$3,assigned_to=$4 WHERE id=$5 AND org_id=$6 RETURNING *',
      [status, resolution || null, resolved_at, req.user.id, req.params.id, req.org.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// POST /privacy/contact-hash — hash PII before storing
router.post('/contact-hash', async (req, res, next) => {
  try {
    const { value, salt } = req.body;
    if (!value) return res.status(400).json({ error: 'Valor requerido' });
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(value.toLowerCase().trim(), s, 100000, 32, 'sha256').toString('hex');
    res.json({ hash, salt: s, algorithm: 'pbkdf2-sha256-100k' });
  } catch(err) { next(err); }
});

module.exports = router;
