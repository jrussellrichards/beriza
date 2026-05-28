'use strict';
/** M-HSE-02: Prevención, Matriz DS 44, CPHS, Programa Anual */
const r = require('express').Router();
const { query } = require('../../db/pool');

// ── Risk Matrix ─────────────────────────────────────────────────────
r.get('/risk-matrix', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_risk_matrix WHERE org_id=$1 ORDER BY created_at DESC',[req.org.id]);
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/risk-matrix', async (req, res, next) => {
  try {
    const { title, project_id, standard='DS44_2024' } = req.body;
    if(!title) return res.status(400).json({error:'Título requerido'});
    const { rows:[m] } = await query(
      'INSERT INTO hse_risk_matrix(org_id,project_id,title,standard) VALUES($1,$2,$3,$4) RETURNING *',
      [req.org.id, project_id||null, title, standard]
    );
    res.status(201).json(m);
  } catch(err){ next(err); }
});

r.get('/risk-matrix/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_risk_matrix WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Matriz no encontrada'});
    const { rows:items } = await query('SELECT * FROM hse_risk_items WHERE matrix_id=$1 ORDER BY sort_order,risk_level DESC',[req.params.id]);
    res.json({ ...rows[0], items });
  } catch(err){ next(err); }
});

r.post('/risk-matrix/:id/items', async (req, res, next) => {
  try {
    const { activity, hazard, risk, probability, consequence, controls, responsible, deadline } = req.body;
    if(!activity||!hazard||!risk||!probability||!consequence) return res.status(400).json({error:'Campos obligatorios faltantes'});
    const { rows:[item] } = await query(
      'INSERT INTO hse_risk_items(matrix_id,activity,hazard,risk,probability,consequence,controls,responsible,deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [req.params.id,activity,hazard,risk,probability,consequence,controls||null,responsible||null,deadline||null]
    );
    res.status(201).json(item);
  } catch(err){ next(err); }
});

// ── CPHS ─────────────────────────────────────────────────────────────
r.get('/cphs', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*,p.name as project_name,
              (SELECT COUNT(*) FROM hse_cphs_sessions WHERE cphs_id=c.id) as session_count
       FROM hse_cphs c LEFT JOIN projects p ON p.id=c.project_id WHERE c.org_id=$1 ORDER BY c.created_at DESC`,
      [req.org.id]
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/cphs', async (req, res, next) => {
  try {
    const { cphs_type='own', project_id, constitution_date, dt_registration, president_name, members=[] } = req.body;
    const { rows:[c] } = await query(
      'INSERT INTO hse_cphs(org_id,project_id,cphs_type,constitution_date,dt_registration,president_name,members) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.org.id,project_id||null,cphs_type,constitution_date||null,dt_registration||null,president_name||null,JSON.stringify(members)]
    );
    res.status(201).json(c);
  } catch(err){ next(err); }
});

r.post('/cphs/:id/sessions', async (req, res, next) => {
  try {
    const { session_date, attendees=[], agenda, minutes, agreements=[] } = req.body;
    if(!session_date) return res.status(400).json({error:'Fecha de sesión requerida'});
    const { rows:[s] } = await query(
      'INSERT INTO hse_cphs_sessions(cphs_id,session_date,attendees,agenda,minutes,agreements) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id,session_date,JSON.stringify(attendees),agenda||null,minutes||null,JSON.stringify(agreements)]
    );
    res.status(201).json(s);
  } catch(err){ next(err); }
});

// ── Prevention Program ─────────────────────────────────────────────────
r.get('/program', async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const { rows } = await query(
      `SELECT pp.*,
              (SELECT COUNT(*) FROM hse_prevention_activities WHERE program_id=pp.id) as total_activities,
              (SELECT COUNT(*) FROM hse_prevention_activities WHERE program_id=pp.id AND status='completed') as completed_activities
       FROM hse_prevention_programs pp WHERE org_id=$1 AND year=$2::smallint ORDER BY created_at DESC`,
      [req.org.id, parseInt(year)]
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/program', async (req, res, next) => {
  try {
    const { year=new Date().getFullYear(), title, objectives } = req.body;
    if(!title) return res.status(400).json({error:'Título requerido'});
    const { rows:[p] } = await query(
      'INSERT INTO hse_prevention_programs(org_id,year,title,objectives) VALUES($1,$2,$3,$4) RETURNING *',
      [req.org.id,parseInt(year),title,objectives||null]
    );
    res.status(201).json(p);
  } catch(err){ next(err); }
});

r.get('/program/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_prevention_programs WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Programa no encontrado'});
    const { rows:acts } = await query('SELECT * FROM hse_prevention_activities WHERE program_id=$1 ORDER BY sort_order,planned_date',[req.params.id]);
    const total=acts.length, done=acts.filter(a=>a.status==='completed').length;
    res.json({ ...rows[0], activities: acts, completion_pct: total>0 ? Math.round(done/total*100) : 0 });
  } catch(err){ next(err); }
});

r.post('/program/:id/activities', async (req, res, next) => {
  try {
    const { title, category, responsible_id, planned_date, notes } = req.body;
    if(!title) return res.status(400).json({error:'Título requerido'});
    const { rows:[a] } = await query(
      'INSERT INTO hse_prevention_activities(program_id,title,category,responsible_id,planned_date,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id,title,category||'other',responsible_id||null,planned_date||null,notes||null]
    );
    res.status(201).json(a);
  } catch(err){ next(err); }
});

r.patch('/program/activities/:actId/complete', async (req, res, next) => {
  try {
    const { evidence_url, notes } = req.body;
    const { rows } = await query("UPDATE hse_prevention_activities SET status='completed',completed_date=CURRENT_DATE,evidence_url=$1,notes=$2 WHERE id=$3 RETURNING *",[evidence_url||null,notes||null,req.params.actId]);
    if(!rows.length) return res.status(404).json({error:'Actividad no encontrada'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

// ── Inspections ─────────────────────────────────────────────────────
r.get('/inspections', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_inspections WHERE org_id=$1 ORDER BY inspection_date DESC LIMIT 50',[req.org.id]);
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/inspections', async (req, res, next) => {
  try {
    const { title, inspection_type='preventive', inspection_date, project_id, area_inspected, findings=[], result } = req.body;
    if(!title||!inspection_date) return res.status(400).json({error:'Título y fecha requeridos'});
    const critical = findings.filter(f=>f.severity==='critical').length;
    const { rows:[ins] } = await query(
      'INSERT INTO hse_inspections(org_id,project_id,title,inspection_type,inspection_date,inspector_id,area_inspected,findings,total_findings,critical_findings,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.org.id,project_id||null,title,inspection_type,inspection_date,req.user.id,area_inspected||null,JSON.stringify(findings),findings.length,critical,result||null]
    );
    res.status(201).json(ins);
  } catch(err){ next(err); }
});

r.get('/summary', async (req, res, next) => {
  try {
    const yr = new Date().getFullYear();
    const [[p],[c],[i],[ins]] = await Promise.all([
      query('SELECT COUNT(*) FROM hse_prevention_programs WHERE org_id=$1 AND year=$2',[req.org.id,yr]),
      query('SELECT COUNT(*) FROM hse_cphs WHERE org_id=$1 AND status=$2',[req.org.id,'active']),
      query('SELECT COUNT(*) FROM hse_capa WHERE org_id=$1 AND status NOT IN($2,$3) AND due_date < NOW()',[req.org.id,'completed','verified']),
      query('SELECT COUNT(*) FROM hse_inspections WHERE org_id=$1 AND EXTRACT(YEAR FROM inspection_date)=$2',[req.org.id,yr]),
    ].map(p=>p.then(r=>r.rows)));
    res.json({ programs_this_year:+p.count, active_cphs:+c.count, overdue_capa:+i.count, inspections_this_year:+ins.count });
  } catch(err){ next(err); }
});

module.exports = r;
