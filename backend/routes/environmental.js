'use strict';
/** M-AMB-01: Gestión Ambiental (Ley 19.300 · DS 148 · DS 8/2021 · SMA) */
const r = require('express').Router();
const { query } = require('../db/pool');

// ── RCA Conditions ────────────────────────────────────────────────────
r.get('/rca', async (req, res, next) => {
  try {
    const { project_id, status } = req.query;
    const c=['c.org_id=$1'],v=[req.org.id]; let i=2;
    if(project_id){c.push(`c.project_id=$${i++}`);v.push(project_id);}
    if(status){c.push(`c.status=$${i++}`);v.push(status);}
    const { rows } = await query(
      `SELECT c.*,p.name as project_name,u.name as responsible_name
       FROM environmental_rca_conditions c
       LEFT JOIN projects p ON p.id=c.project_id
       LEFT JOIN users u ON u.id=c.responsible_id
       WHERE ${c.join(' AND ')} ORDER BY c.due_date ASC NULLS LAST`, v
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/rca', async (req, res, next) => {
  try {
    const { project_id, rca_number, condition_number, title, description, responsible_id, due_date, frequency } = req.body;
    if(!condition_number||!title) return res.status(400).json({error:'Número de condición y título son requeridos'});
    const { rows:[c] } = await query(
      'INSERT INTO environmental_rca_conditions(org_id,project_id,rca_number,condition_number,title,description,responsible_id,due_date,frequency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [req.org.id,project_id,rca_number||null,condition_number,title,description||null,responsible_id||null,due_date||null,frequency||null]
    );
    res.status(201).json(c);
  } catch(err){ next(err); }
});

r.patch('/rca/:id/evidence', async (req, res, next) => {
  try {
    const { status, evidence_url, notes } = req.body;
    const { rows } = await query(
      'UPDATE environmental_rca_conditions SET status=$1,evidence_url=$2,notes=$3,last_review=CURRENT_DATE,updated_at=NOW() WHERE id=$4 AND org_id=$5 RETURNING *',
      [status||'compliant', evidence_url||null, notes||null, req.params.id, req.org.id]
    );
    if(!rows.length) return res.status(404).json({error:'Condición no encontrada'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

// ── Environmental Monitoring ─────────────────────────────────────────
r.get('/monitoring', async (req, res, next) => {
  try {
    const { project_id, indicator_type, from } = req.query;
    const c=['m.org_id=$1'],v=[req.org.id]; let i=2;
    if(project_id){c.push(`m.project_id=$${i++}`);v.push(project_id);}
    if(indicator_type){c.push(`m.indicator_type=$${i++}`);v.push(indicator_type);}
    if(from){c.push(`m.monitoring_date>=$${i++}`);v.push(from);}
    const { rows } = await query(
      `SELECT m.*,p.name as project_name FROM environmental_monitoring m
       LEFT JOIN projects p ON p.id=m.project_id
       WHERE ${c.join(' AND ')} ORDER BY m.monitoring_date DESC LIMIT 200`, v
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/monitoring', async (req, res, next) => {
  try {
    const { project_id, rca_condition_id, indicator, indicator_type, monitoring_date, value, unit, limit_value, station, report_url } = req.body;
    if(!indicator||!monitoring_date) return res.status(400).json({error:'Indicador y fecha requeridos'});
    const compliant = value && limit_value ? parseFloat(value) <= parseFloat(limit_value) : null;
    const { rows:[m] } = await query(
      'INSERT INTO environmental_monitoring(org_id,project_id,rca_condition_id,indicator,indicator_type,monitoring_date,value,unit,limit_value,station,compliant,report_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [req.org.id,project_id||null,rca_condition_id||null,indicator,indicator_type||null,monitoring_date,value||null,unit||null,limit_value||null,station||null,compliant,report_url||null]
    );
    res.status(201).json(m);
  } catch(err){ next(err); }
});

// ── Waste Management ────────────────────────────────────────────────
r.get('/waste', async (req, res, next) => {
  try {
    const { project_id, waste_type, from } = req.query;
    const c=['w.org_id=$1'],v=[req.org.id]; let i=2;
    if(project_id){c.push(`w.project_id=$${i++}`);v.push(project_id);}
    if(waste_type){c.push(`w.waste_type=$${i++}`);v.push(waste_type);}
    if(from){c.push(`w.generation_date>=$${i++}`);v.push(from);}
    const { rows } = await query(
      `SELECT w.*,p.name as project_name FROM environmental_waste w
       LEFT JOIN projects p ON p.id=w.project_id
       WHERE ${c.join(' AND ')} ORDER BY w.generation_date DESC LIMIT 200`, v
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/waste', async (req, res, next) => {
  try {
    const { project_id, waste_type, waste_name, quantity_kg, generation_date, treatment_method, authorized_handler, manifest_number, manifest_url } = req.body;
    if(!waste_type||!waste_name||!generation_date) return res.status(400).json({error:'Tipo, nombre y fecha requeridos'});
    const { rows:[w] } = await query(
      'INSERT INTO environmental_waste(org_id,project_id,waste_type,waste_name,quantity_kg,generation_date,treatment_method,authorized_handler,manifest_number,manifest_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.org.id,project_id||null,waste_type,waste_name,quantity_kg||null,generation_date,treatment_method||null,authorized_handler||null,manifest_number||null,manifest_url||null]
    );
    res.status(201).json(w);
  } catch(err){ next(err); }
});

r.get('/waste/summary', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT waste_type, COUNT(*) as records, SUM(quantity_kg) as total_kg
       FROM environmental_waste WHERE org_id=$1 GROUP BY waste_type ORDER BY total_kg DESC`,
      [req.org.id]
    );
    res.json(rows);
  } catch(err){ next(err); }
});

// ── Environmental Incidents ──────────────────────────────────────────
r.get('/incidents', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM environmental_incidents WHERE org_id=$1 ORDER BY incident_date DESC LIMIT 50',[req.org.id]);
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/incidents', async (req, res, next) => {
  try {
    const { project_id, incident_date, incident_type, description, affected_media=[], immediate_actions, corrective_plan } = req.body;
    if(!incident_date||!description) return res.status(400).json({error:'Fecha y descripción requeridos'});
    const { rows:[inc] } = await query(
      'INSERT INTO environmental_incidents(org_id,project_id,incident_date,incident_type,description,affected_media,immediate_actions,corrective_plan) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.org.id,project_id||null,incident_date,incident_type||null,description,affected_media,immediate_actions||null,corrective_plan||null]
    );
    res.status(201).json(inc);
  } catch(err){ next(err); }
});

// ── Compliance Summary ────────────────────────────────────────────────
r.get('/summary', async (req, res, next) => {
  try {
    const [ {rows:[r]}, {rows:[m]}, {rows:[w]}, {rows:[inc]} ] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE status='compliant') as compliant, COUNT(*) FILTER(WHERE status='overdue') as overdue FROM environmental_rca_conditions WHERE org_id=$1`,[req.org.id]),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE compliant=false) as non_compliant FROM environmental_monitoring WHERE org_id=$1 AND monitoring_date >= NOW() - INTERVAL '90 days'`,[req.org.id]),
      query(`SELECT COUNT(*) as records, SUM(quantity_kg) as total_kg FROM environmental_waste WHERE org_id=$1 AND generation_date >= NOW() - INTERVAL '365 days'`,[req.org.id]),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE status='open') as open FROM environmental_incidents WHERE org_id=$1`,[req.org.id]),
    ]);
    const total_rca=+r.total, comp_rca=+r.compliant;
    res.json({
      rca: { total: total_rca, compliant: comp_rca, overdue: +r.overdue, compliance_pct: total_rca>0 ? Math.round(comp_rca/total_rca*100) : 100 },
      monitoring: { total: +m.total, non_compliant: +m.non_compliant },
      waste: { records: +w.records, total_kg: parseFloat(w.total_kg||0) },
      incidents: { total: +inc.total, open: +inc.open },
    });
  } catch(err){ next(err); }
});

module.exports = r;
