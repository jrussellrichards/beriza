'use strict';
/**
 * M-HSE-05: Higiene Ocupacional (DS 594/1999 · NCh 432 · NCh 434)
 * Monitoreo agentes físico-químicos, inventario RESPEL, vigilancia epidemiológica, EPP
 */
const r = require('express').Router();
const { query } = require('../../db/pool');
const { requireManager } = require('../../middleware/auth');

// DS 594 Legal limits reference
const DS594_LIMITS = {
  noise: { limit: 85, unit: 'dB(A)', description: 'Ruido en jornada completa 8h' },
  vibration_arm: { limit: 5, unit: 'm/s²', description: 'Vibración mano-brazo (8h)' },
  vibration_body: { limit: 1.15, unit: 'm/s²', description: 'Vibración cuerpo completo (8h)' },
  illuminance_office: { limit: 300, unit: 'lux', description: 'Oficinas y trabajo fino' },
  illuminance_general: { limit: 100, unit: 'lux', description: 'Áreas generales' },
  temperature_wet: { limit: 25, unit: '°C TGBH', description: 'Estrés térmico trabajo moderado' },
  co: { limit: 29, unit: 'ppm', description: 'Monóxido de carbono CMP-PPT' },
  co2: { limit: 5000, unit: 'ppm', description: 'Dióxido de carbono CMP-PPT' },
  silica: { limit: 0.1, unit: 'mg/m³', description: 'Sílice libre cristalizada' },
  dust_total: { limit: 10, unit: 'mg/m³', description: 'Polvo total inerte' },
};

// ── Monitoring ──────────────────────────────────────────────────────
r.get('/monitoring', async (req, res, next) => {
  try {
    const { project_id, agent_type, status } = req.query;
    const c = ['m.org_id=$1'], v = [req.org.id]; let i = 2;
    if (project_id) { c.push(`m.project_id=$${i++}`); v.push(project_id); }
    if (agent_type) { c.push(`m.agent_type=$${i++}`); v.push(agent_type); }
    const { rows } = await query(
      `SELECT m.*, p.name as project_name
       FROM hse_hygiene_monitoring m
       LEFT JOIN projects p ON p.id=m.project_id
       WHERE ${c.join(' AND ')} ORDER BY m.sampling_date DESC LIMIT 100`, v
    );
    // Mark status based on DS 594 limits if not stored
    const enriched = rows.map(r => ({
      ...r,
      ds594_limit: DS594_LIMITS[r.agent_type]?.limit || null,
      ds594_unit: DS594_LIMITS[r.agent_type]?.unit || r.unit,
    }));
    if (status) {
      res.json(enriched.filter(r => r.status === status));
    } else {
      res.json(enriched);
    }
  } catch (err) { next(err); }
});

r.post('/monitoring', requireManager, async (req, res, next) => {
  try {
    const { project_id, agent_type, agent_name, sampling_date, location,
            measured_value, unit, legal_limit, standard_ref, sampled_by, actions_taken } = req.body;
    if (!agent_type || !sampling_date) return res.status(400).json({ error: 'Tipo de agente y fecha requeridos' });
    // Use DS 594 limit if not provided
    const lim = legal_limit || DS594_LIMITS[agent_type]?.limit || null;
    const u = unit || DS594_LIMITS[agent_type]?.unit || null;
    const { rows: [m] } = await query(
      `INSERT INTO hse_hygiene_monitoring(org_id,project_id,agent_type,agent_name,sampling_date,location,measured_value,unit,legal_limit,standard_ref,sampled_by,actions_taken)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.org.id, project_id||null, agent_type, agent_name||null, sampling_date,
       location||null, measured_value||null, u, lim, standard_ref||'DS594',
       sampled_by||null, actions_taken||null]
    );
    res.status(201).json({ ...m, ds594_limit: lim, ds594_description: DS594_LIMITS[agent_type]?.description });
  } catch (err) { next(err); }
});

r.get('/monitoring/alerts', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.*, p.name as project_name
       FROM hse_hygiene_monitoring m
       LEFT JOIN projects p ON p.id=m.project_id
       WHERE m.org_id=$1 AND m.status='non_compliant'
       ORDER BY m.sampling_date DESC LIMIT 50`,
      [req.org.id]
    );
    res.json({ alerts: rows, count: rows.length });
  } catch (err) { next(err); }
});

r.get('/monitoring/limits', (_req, res) => res.json(DS594_LIMITS));

// ── Chemical Inventory ──────────────────────────────────────────────
r.get('/chemicals', async (req, res, next) => {
  try {
    const { is_respel } = req.query;
    const c = ['org_id=$1'], v = [req.org.id]; let i = 2;
    if (is_respel !== undefined) { c.push(`is_respel=$${i++}`); v.push(is_respel === 'true'); }
    const { rows } = await query(`SELECT * FROM hse_chemical_inventory WHERE ${c.join(' AND ')} ORDER BY hazard_class, product_name`, v);
    res.json(rows);
  } catch (err) { next(err); }
});

r.post('/chemicals', requireManager, async (req, res, next) => {
  try {
    const { product_name, cas_number, hazard_class, physical_state, quantity_kg,
            storage_location, sds_url, is_respel, emergency_contact } = req.body;
    if (!product_name) return res.status(400).json({ error: 'Nombre del producto requerido' });
    const { rows: [c] } = await query(
      `INSERT INTO hse_chemical_inventory(org_id,product_name,cas_number,hazard_class,physical_state,quantity_kg,storage_location,sds_url,is_respel,emergency_contact,last_reviewed)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE) RETURNING *`,
      [req.org.id, product_name, cas_number||null, hazard_class||null, physical_state||null,
       quantity_kg||null, storage_location||null, sds_url||null, is_respel||false, emergency_contact||null]
    );
    res.status(201).json(c);
  } catch (err) { next(err); }
});

// ── Health Surveillance ─────────────────────────────────────────────
r.get('/surveillance', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, w.worker_name, w.worker_role, w.project_id
       FROM hse_health_surveillance s
       JOIN hse_worker_accreditation w ON w.id=s.worker_id
       WHERE w.org_id=$1 ORDER BY s.next_exam_date ASC NULLS LAST LIMIT 100`,
      [req.org.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

r.post('/surveillance', requireManager, async (req, res, next) => {
  try {
    const { worker_id, agent_type, risk_level, exam_frequency_months, next_exam_date } = req.body;
    if (!worker_id || !agent_type) return res.status(400).json({ error: 'worker_id y tipo de agente requeridos' });
    const { rows: [s] } = await query(
      `INSERT INTO hse_health_surveillance(worker_id,agent_type,risk_level,exam_frequency_months,next_exam_date)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(worker_id,agent_type) DO UPDATE
         SET risk_level=$3, exam_frequency_months=$4, next_exam_date=$5
       RETURNING *`,
      [worker_id, agent_type, risk_level||'medium', exam_frequency_months||12, next_exam_date||null]
    );
    res.status(201).json(s);
  } catch (err) { next(err); }
});

r.get('/surveillance/due', async (req, res, next) => {
  try {
    const { days = 60 } = req.query;
    const { rows } = await query(
      `SELECT s.*, w.worker_name, w.worker_rut, w.project_id, w.org_id
       FROM hse_health_surveillance s
       JOIN hse_worker_accreditation w ON w.id=s.worker_id
       WHERE w.org_id=$1 AND s.next_exam_date BETWEEN NOW() AND NOW()+INTERVAL '${parseInt(days)} days'
       ORDER BY s.next_exam_date ASC LIMIT 100`,
      [req.org.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── EPP Management ──────────────────────────────────────────────────
r.get('/epp', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, w.worker_name, w.project_id
       FROM hse_epp_assignments e
       JOIN hse_worker_accreditation w ON w.id=e.accreditation_id
       WHERE w.org_id=$1 AND e.returned=false
       ORDER BY e.expiry_date ASC NULLS LAST LIMIT 200`,
      [req.org.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

r.post('/epp/:workerId', requireManager, async (req, res, next) => {
  try {
    const { epp_type, epp_description, quantity=1, delivery_date, expiry_date } = req.body;
    if (!epp_type || !delivery_date) return res.status(400).json({ error: 'Tipo de EPP y fecha de entrega requeridos' });
    const { rows: [e] } = await query(
      `INSERT INTO hse_epp_assignments(accreditation_id,epp_type,epp_description,quantity,delivery_date,expiry_date)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.workerId, epp_type, epp_description||null, quantity, delivery_date, expiry_date||null]
    );
    res.status(201).json(e);
  } catch (err) { next(err); }
});

r.patch('/epp/:eppId/return', requireManager, async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE hse_epp_assignments SET returned=true,returned_date=CURRENT_DATE,condition=$1 WHERE id=$2 RETURNING *",
      [req.body.condition||'returned', req.params.eppId]
    );
    if (!rows.length) return res.status(404).json({ error: 'EPP no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

r.get('/epp/expiring', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const { rows } = await query(
      `SELECT e.*, w.worker_name, w.project_id
       FROM hse_epp_assignments e
       JOIN hse_worker_accreditation w ON w.id=e.accreditation_id
       WHERE w.org_id=$1 AND e.returned=false
         AND e.expiry_date BETWEEN NOW() AND NOW()+INTERVAL '${parseInt(days)} days'
       ORDER BY e.expiry_date ASC LIMIT 100`,
      [req.org.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Summary ──────────────────────────────────────────────────────────
r.get('/summary', async (req, res, next) => {
  try {
    const [mon, chem, epp] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE status='non_compliant') as non_compliant,
             COUNT(*) FILTER(WHERE status='warning') as warning
             FROM hse_hygiene_monitoring WHERE org_id=$1 AND sampling_date>=NOW()-INTERVAL '90 days'`, [req.org.id]),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_respel=true) as respel FROM hse_chemical_inventory WHERE org_id=$1`, [req.org.id]),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE expiry_date<NOW() AND returned=false) as expired
             FROM hse_epp_assignments e JOIN hse_worker_accreditation w ON w.id=e.accreditation_id WHERE w.org_id=$1`, [req.org.id]),
    ]);
    res.json({
      monitoring: { ...mon.rows[0] },
      chemicals: { ...chem.rows[0] },
      epp: { ...epp.rows[0] },
    });
  } catch (err) { next(err); }
});

module.exports = r;
