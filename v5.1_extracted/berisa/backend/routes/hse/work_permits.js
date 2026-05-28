'use strict';
/** M-HSE-04: Permisos de Trabajo de Alto Riesgo (DS 594 · DS 132) */
const r = require('express').Router();
const { query } = require('../../db/pool');

const CHECKPOINTS = {
  height:        ['Inspección arnés y línea de vida','Anclaje certificado disponible','Plan de rescate conocido','EPP completo (arnés, casco, calzado)','Condiciones climáticas evaluadas (viento <40 km/h)'],
  confined_space:['Medición de gases (O₂, CO, H₂S, LEL)','Sistema de ventilación activo','Comunicación establecida','Vigía externo designado','Equipo de rescate disponible','EPP apropiado'],
  hot_work:      ['Área libre de materiales inflamables (10m)','Extintor disponible y vigente','Permiso del responsable del área','Conexión eléctrica segura','Guardia de fuego post-trabajo (30 min)'],
  electrical:    ['Equipo desenergizado y bloqueado (LOTO)','Ausencia de tensión verificada','EPP dieléctrico vigente','Trabajo acompañado si >1000V','Herramientas aisladas catalogadas'],
  excavation:    ['Tipo de suelo evaluado','Taludes o entibación verificados','Señalización perímetro activa','Drenaje garantizado','Servicios subterráneos identificados'],
  general:       ['Análisis de riesgo previo (ART)','EPP adecuado al riesgo','Área delimitada y señalizada','Responsable designado'],
};

r.get('/', async (req, res, next) => {
  try {
    const { permit_type, status, project_id } = req.query;
    const c=['p.org_id=$1'],v=[req.org.id]; let i=2;
    if(permit_type){c.push(`p.permit_type=$${i++}`);v.push(permit_type);}
    if(status){c.push(`p.status=$${i++}`);v.push(status);}
    if(project_id){c.push(`p.project_id=$${i++}`);v.push(project_id);}
    const { rows } = await query(
      `SELECT p.*,pr.name as project_name,
              u1.name as requested_by_name, u2.name as approved_by_name
       FROM hse_work_permits p
       LEFT JOIN projects pr ON pr.id=p.project_id
       LEFT JOIN users u1 ON u1.id=p.requested_by
       LEFT JOIN users u2 ON u2.id=p.approved_by
       WHERE ${c.join(' AND ')} ORDER BY p.start_datetime DESC LIMIT 100`, v
    );
    res.json(rows);
  } catch(err){ next(err); }
});

r.post('/', async (req, res, next) => {
  try {
    const { permit_type, title, description, location, start_datetime, end_datetime, project_id, workers_count=1, ppe_required=[] } = req.body;
    if(!permit_type||!title||!start_datetime||!end_datetime) return res.status(400).json({error:'Tipo, título y fechas requeridos'});
    const num = `PT-${permit_type.toUpperCase().slice(0,2)}-${Date.now().toString(36).toUpperCase()}`;
    const { rows:[p] } = await query(
      'INSERT INTO hse_work_permits(org_id,project_id,permit_type,permit_number,title,description,location,start_datetime,end_datetime,requested_by,workers_count,ppe_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [req.org.id,project_id||null,permit_type,num,title,description||null,location||null,start_datetime,end_datetime,req.user.id,workers_count,ppe_required]
    );
    // Auto-create checkpoints for the permit type
    const cks = CHECKPOINTS[permit_type] || CHECKPOINTS.general;
    for(const [idx,ck] of cks.entries()){
      const cat = permit_type==='height'?'safety_conditions':permit_type==='confined_space'?'measurements':'pre_work';
      await query('INSERT INTO hse_permit_checkpoints(permit_id,checkpoint,category,is_required) VALUES($1,$2,$3,true)',[p.id,ck,cat]);
    }
    res.status(201).json({ ...p, checkpoints_created: cks.length });
  } catch(err){ next(err); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_work_permits WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Permiso no encontrado'});
    const { rows:cks } = await query('SELECT * FROM hse_permit_checkpoints WHERE permit_id=$1 ORDER BY category,id',[req.params.id]);
    const total=cks.length, done=cks.filter(c=>c.completed).length;
    const ready = done===total;
    res.json({ ...rows[0], checkpoints: cks, ready_to_start: ready, completion_pct: total>0?Math.round(done/total*100):0 });
  } catch(err){ next(err); }
});

r.patch('/:id/checkpoints/:ckId', async (req, res, next) => {
  try {
    const { completed, value, notes } = req.body;
    const { rows } = await query(
      'UPDATE hse_permit_checkpoints SET completed=$1,value=$2,notes=$3,checked_by=$4,checked_at=NOW() WHERE id=$5 AND permit_id=$6 RETURNING *',
      [completed,value||null,notes||null,req.user.id,req.params.ckId,req.params.id]
    );
    if(!rows.length) return res.status(404).json({error:'Checkpoint no encontrado'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

r.patch('/:id/approve', async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE hse_work_permits SET status='approved',approved_by=$1,approved_at=NOW() WHERE id=$2 AND org_id=$3 RETURNING *",[req.user.id,req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Permiso no encontrado'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

r.patch('/:id/close', async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE hse_work_permits SET status='completed',closed_at=NOW() WHERE id=$1 AND org_id=$2 RETURNING *",[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Permiso no encontrado'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

r.patch('/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { rows } = await query("UPDATE hse_work_permits SET status='cancelled',cancellation_reason=$1,closed_at=NOW() WHERE id=$2 AND org_id=$3 RETURNING *",[reason||null,req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Permiso no encontrado'});
    res.json(rows[0]);
  } catch(err){ next(err); }
});

r.get('/stats', async (req, res, next) => {
  try {
    const yr = new Date().getFullYear();
    const { rows:[s] } = await query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER(WHERE status='completed') as completed,
              COUNT(*) FILTER(WHERE status='active') as active,
              COUNT(*) FILTER(WHERE status='requested') as pending_approval
       FROM hse_work_permits WHERE org_id=$1 AND EXTRACT(YEAR FROM start_datetime)=$2`,
      [req.org.id, yr]
    );
    res.json(s);
  } catch(err){ next(err); }
});

module.exports = r;
