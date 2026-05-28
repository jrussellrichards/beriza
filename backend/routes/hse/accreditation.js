'use strict';
/** M-HSE-03: Acreditación de Personal en Faena (DS 76 · DS 44) */
const r = require('express').Router();
const { query } = require('../../db/pool');

r.get('/', async (req, res, next) => {
  try {
    const { project_id, supplier_id, status } = req.query;
    const c=['w.org_id=$1'], v=[req.org.id]; let i=2;
    if(project_id){c.push(`w.project_id=$${i++}`);v.push(project_id);}
    if(supplier_id){c.push(`w.supplier_id=$${i++}`);v.push(supplier_id);}
    if(status){c.push(`w.accreditation_status=$${i++}`);v.push(status);}
    const { rows } = await query(
      `SELECT w.*,s.company_name,
              (SELECT COUNT(*) FROM hse_licenses WHERE accreditation_id=w.id AND expiry_date < NOW()) as expired_licenses,
              (SELECT COUNT(*) FROM hse_medical_exams WHERE accreditation_id=w.id AND result='fit' ORDER BY exam_date DESC LIMIT 1) as has_medical
       FROM hse_worker_accreditation w LEFT JOIN suppliers s ON s.id=w.supplier_id
       WHERE ${c.join(' AND ')} ORDER BY w.worker_name LIMIT 200`, v
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/', async (req, res, next) => {
  try {
    const { worker_name, worker_rut, worker_role, supplier_id, project_id } = req.body;
    if(!worker_name) return res.status(400).json({error:'Nombre trabajador requerido'});
    const { rows:[w] } = await query(
      'INSERT INTO hse_worker_accreditation(org_id,supplier_id,project_id,worker_name,worker_rut,worker_role) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.org.id,supplier_id||null,project_id||null,worker_name,worker_rut||null,worker_role||null]
    );
    res.status(201).json(w);
  } catch(err){ next(err); }
});

r.post('/:id/induction', async (req, res, next) => {
  try {
    const { valid_days=90, notes } = req.body;
    const validUntil = new Date(Date.now() + valid_days*864e5);
    const { rows } = await query(
      "UPDATE hse_worker_accreditation SET induction_at=NOW(),induction_valid_until=$1,accreditation_status='active',site_access=true,updated_at=NOW() WHERE id=$2 AND org_id=$3 RETURNING *",
      [validUntil, req.params.id, req.org.id]
    );
    if(!rows.length) return res.status(404).json({error:'Trabajador no encontrado'});
    res.json({ ...rows[0], message: `Inducción registrada. Válida hasta ${validUntil.toISOString().split('T')[0]}` });
  } catch(err){ next(err); }
});

r.post('/:id/licenses', async (req, res, next) => {
  try {
    const { license_type, license_number, issued_by, issued_date, expiry_date, doc_url } = req.body;
    if(!license_type) return res.status(400).json({error:'Tipo de licencia requerido'});
    const today = new Date();
    const exp = expiry_date ? new Date(expiry_date) : null;
    const status = !exp ? 'active' : exp < today ? 'expired' : exp < new Date(today.getTime() + 30*864e5) ? 'expiring' : 'active';
    const { rows:[l] } = await query(
      'INSERT INTO hse_licenses(accreditation_id,license_type,license_number,issued_by,issued_date,expiry_date,status,doc_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.params.id,license_type,license_number||null,issued_by||null,issued_date||null,expiry_date||null,status,doc_url||null]
    );
    res.status(201).json(l);
  } catch(err){ next(err); }
});

r.post('/:id/medical', async (req, res, next) => {
  try {
    const { exam_type, exam_date, next_due_date, result='fit', restrictions, medical_center, doc_url } = req.body;
    if(!exam_type||!exam_date) return res.status(400).json({error:'Tipo y fecha de examen requeridos'});
    const { rows:[m] } = await query(
      'INSERT INTO hse_medical_exams(accreditation_id,exam_type,exam_date,next_due_date,result,restrictions,medical_center,doc_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.params.id,exam_type,exam_date,next_due_date||null,result,restrictions||null,medical_center||null,doc_url||null]
    );
    if(result==='unfit') await query("UPDATE hse_worker_accreditation SET site_access=false,accreditation_status='suspended',updated_at=NOW() WHERE id=$1",[req.params.id]);
    res.status(201).json(m);
  } catch(err){ next(err); }
});

r.get('/expiring', async (req, res, next) => {
  try {
    const { days=30 } = req.query;
    const { rows } = await query(
      `SELECT l.*,w.worker_name,w.worker_rut,w.project_id,s.company_name
       FROM hse_licenses l JOIN hse_worker_accreditation w ON w.id=l.accreditation_id
       LEFT JOIN suppliers s ON s.id=w.supplier_id
       WHERE w.org_id=$1 AND l.expiry_date BETWEEN NOW() AND NOW()+INTERVAL '${parseInt(days)} days'
       ORDER BY l.expiry_date ASC LIMIT 100`, [req.org.id]
    );
    res.json(rows);
  } catch(err){ next(err); }
});

module.exports = r;
