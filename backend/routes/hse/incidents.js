'use strict';
/** M-HSE-01: Registro de incidentes, accidentes y CAPA (Ley 16.744 · DS 44/2024) */
const r = require('express').Router();
const { query } = require('../../db/pool');

// ── Incidents ──────────────────────────────────────────────────────────
r.get('/', async (req, res, next) => {
  try {
    const { supplier_id, project_id, severity, status, from, to, page=1 } = req.query;
    const lim=50, off=(parseInt(page)-1)*lim;
    const c=['i.org_id=$1'], v=[req.org.id]; let idx=2;
    if(supplier_id){c.push(`i.supplier_id=$${idx++}`);v.push(supplier_id);}
    if(project_id){c.push(`i.project_id=$${idx++}`);v.push(project_id);}
    if(severity){c.push(`i.severity=$${idx++}`);v.push(severity);}
    if(status){c.push(`i.status=$${idx++}`);v.push(status);}
    if(from){c.push(`i.incident_date>=$${idx++}`);v.push(from);}
    if(to){c.push(`i.incident_date<=$${idx++}`);v.push(to);}
    const { rows } = await query(
      `SELECT i.*,s.company_name,p.name as project_name,u.name as created_by_name,
              (SELECT COUNT(*) FROM hse_capa WHERE incident_id=i.id) as capa_count,
              (SELECT COUNT(*) FROM hse_capa WHERE incident_id=i.id AND status NOT IN('completed','verified')) as capa_open
       FROM hse_incidents i
       LEFT JOIN suppliers s ON s.id=i.supplier_id
       LEFT JOIN projects p ON p.id=i.project_id
       LEFT JOIN users u ON u.id=i.created_by
       WHERE ${c.join(' AND ')} ORDER BY i.incident_date DESC LIMIT ${lim} OFFSET ${off}`, v
    );
    res.json({ data: rows, page: parseInt(page), limit: lim });
  } catch(err) { next(err); }
});

r.get('/stats', async (req, res, next) => {
  try {
    const { year = new Date().getFullYear(), supplier_id } = req.query;
    const c=['org_id=$1'], v=[req.org.id]; let idx=2;
    if(supplier_id){c.push(`supplier_id=$${idx++}`);v.push(supplier_id);}
    c.push(`EXTRACT(YEAR FROM incident_date)=$${idx++}`); v.push(year);
    const { rows:[s] } = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER(WHERE severity='fatal') as fatal,
        COUNT(*) FILTER(WHERE severity='serious') as serious,
        COUNT(*) FILTER(WHERE severity='minor') as minor,
        COUNT(*) FILTER(WHERE incident_type='near_miss') as near_misses,
        SUM(lost_days) as total_lost_days,
        COUNT(*) FILTER(WHERE status='open' OR status='investigating') as open_count,
        COUNT(DISTINCT supplier_id) as suppliers_with_incidents
       FROM hse_incidents WHERE ${c.join(' AND ')}`, v
    );
    res.json({ ...s, year: parseInt(year) });
  } catch(err) { next(err); }
});

r.get('/kpis', async (req, res, next) => {
  try {
    const { period_start, period_end, supplier_id } = req.query;
    const ps = period_start || `${new Date().getFullYear()}-01-01`;
    const pe = period_end || new Date().toISOString().split('T')[0];
    const c=['org_id=$1','incident_date BETWEEN $2 AND $3'], v=[req.org.id, ps, pe]; let idx=4;
    if(supplier_id){c.push(`supplier_id=$${idx++}`);v.push(supplier_id);}
    const { rows:[s] } = await query(`SELECT COUNT(*) as accidents, SUM(lost_days) as lost_days FROM hse_incidents WHERE ${c.join(' AND ')}`,v);
    // Get workers + hours from stats snapshot or estimate
    const { rows:[snap] } = await query(
      `SELECT workers_avg, hours_worked FROM hse_stats_snapshots WHERE org_id=$1 AND period_start<=$2 AND period_end>=$3 ORDER BY period_end DESC LIMIT 1`,
      [req.org.id, pe, ps]
    );
    const workers = snap?.workers_avg || 100;
    const hours = snap?.hours_worked || workers * 2000;
    const acc = parseInt(s.accidents||0), ld = parseInt(s.lost_days||0);
    res.json({
      period: { from: ps, to: pe },
      accidents: acc, lost_days: ld, workers_avg: workers, hours_worked: hours,
      ta:   (workers > 0 && hours > 0) ? +(acc / workers * 100).toFixed(3) : 0,
      if_:  hours > 0 ? +(acc * 1e6 / hours).toFixed(3) : 0,
      ig:   hours > 0 ? +(ld  * 1e6 / hours).toFixed(3) : 0,
      sector_avg_ta: 3.5, sector_avg_if: 12.4,  // Promedio sector construcción Chile 2024
    });
  } catch(err) { next(err); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM hse_incidents WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Incidente no encontrado'});
    const [inv,capa] = await Promise.all([
      query('SELECT * FROM hse_investigations WHERE incident_id=$1',[req.params.id]),
      query('SELECT * FROM hse_capa WHERE incident_id=$1 ORDER BY created_at',[req.params.id]),
    ]);
    res.json({ ...rows[0], investigation: inv.rows[0]||null, capa: capa.rows });
  } catch(err) { next(err); }
});

r.post('/', async (req, res, next) => {
  try {
    const { incident_date,incident_time,incident_type,severity,title,description,location,
            workers_involved=1,lost_days=0,supplier_id,project_id } = req.body;
    if(!incident_date||!incident_type||!severity||!title)
      return res.status(400).json({error:'Fecha, tipo, severidad y título son requeridos'});
    const { rows:[i] } = await query(
      'INSERT INTO hse_incidents(org_id,supplier_id,project_id,incident_date,incident_time,incident_type,severity,title,description,location,workers_involved,lost_days,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
      [req.org.id,supplier_id||null,project_id||null,incident_date,incident_time||null,incident_type,severity,title,description,location,workers_involved,lost_days,req.user.id]
    );
    // Auto-update supplier score_hse if supplier_id provided
    if(supplier_id) await updateSupplierHseScore(supplier_id);
    res.status(201).json(i);
  } catch(err) { next(err); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const al=['incident_date','incident_type','severity','title','description','location','workers_involved','lost_days','status','diat_number','diep_number','oa_reported'];
    const f=[],v=[]; let i=1;
    for(const k of al) if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    v.push(req.params.id,req.org.id);
    const { rows } = await query(`UPDATE hse_incidents SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} AND org_id=$${i+1} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({error:'No encontrado'});
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// ── Investigations ──────────────────────────────────────────────────
r.post('/:id/investigation', async (req, res, next) => {
  try {
    const { method='five_whys', root_causes=[], contributing_factors=[], immediate_causes=[], findings } = req.body;
    const { rows:[inv] } = await query(
      'INSERT INTO hse_investigations(incident_id,method,root_causes,contributing_factors,immediate_causes,findings,responsible) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(incident_id) DO UPDATE SET method=$2,root_causes=$3,contributing_factors=$4,immediate_causes=$5,findings=$6,responsible=$7,completed_at=NOW() RETURNING *',
      [req.params.id,method,JSON.stringify(root_causes),JSON.stringify(contributing_factors),JSON.stringify(immediate_causes),findings||null,req.user.id]
    );
    await query("UPDATE hse_incidents SET status='capa_open',updated_at=NOW() WHERE id=$1",[req.params.id]);
    res.status(201).json(inv);
  } catch(err) { next(err); }
});

// ── CAPA ─────────────────────────────────────────────────────────────
r.post('/:id/capa', async (req, res, next) => {
  try {
    const { capa_type='corrective', title, description, responsible_id, due_date } = req.body;
    if(!title) return res.status(400).json({error:'Título CAPA requerido'});
    const { rows:[c] } = await query(
      'INSERT INTO hse_capa(org_id,incident_id,capa_type,title,description,responsible_id,due_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.org.id,req.params.id,capa_type,title,description,responsible_id||req.user.id,due_date||null]
    );
    res.status(201).json(c);
  } catch(err) { next(err); }
});

r.patch('/capa/:capaId', async (req, res, next) => {
  try {
    const { status, evidence_url } = req.body;
    const completed_at = status==='completed' ? new Date() : undefined;
    const vals = completed_at
      ? [status, evidence_url||null, completed_at, req.params.capaId, req.org.id]
      : [status, evidence_url||null, null, req.params.capaId, req.org.id];
    const { rows } = await query('UPDATE hse_capa SET status=$1,evidence_url=$2,completed_at=$3 WHERE id=$4 AND org_id=$5 RETURNING *', vals);
    if(!rows.length) return res.status(404).json({error:'CAPA no encontrada'});
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// Stats snapshots upsert
r.post('/snapshots', async (req, res, next) => {
  try {
    const { period_start, period_end, period_type='monthly', workers_avg, hours_worked, supplier_id } = req.body;
    // Auto-calculate IF, IG, TA from incidents in period
    const { rows:[s] } = await query(
      'SELECT COUNT(*) as acc, SUM(lost_days) as ld FROM hse_incidents WHERE org_id=$1 AND incident_date BETWEEN $2 AND $3',
      [req.org.id, period_start, period_end]
    );
    const acc=parseInt(s.acc||0), ld=parseInt(s.ld||0), h=parseInt(hours_worked||0), w=parseInt(workers_avg||1);
    const ta= w>0 ? +(acc/w*100).toFixed(3) : 0;
    const if_=h>0 ? +(acc*1e6/h).toFixed(3) : 0;
    const ig=h>0 ? +(ld*1e6/h).toFixed(3) : 0;
    await query(
      `INSERT INTO hse_stats_snapshots(org_id,supplier_id,period_start,period_end,period_type,workers_avg,hours_worked,accidents_total,lost_days,ta,if_index,ig_index)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
      [req.org.id,supplier_id||null,period_start,period_end,period_type,w,h,acc,ld,ta,if_,ig]
    );
    res.json({ ta, if_index: if_, ig_index: ig, accidents_total: acc, lost_days: ld });
  } catch(err) { next(err); }
});

async function updateSupplierHseScore(supplierId) {
  try {
    // Calculate score_hse based on recent siniestralidad (1-year window)
    const { rows:[s] } = await require('../../db/pool').query(
      `SELECT COUNT(*) FILTER(WHERE severity='fatal') as fatal,
              COUNT(*) FILTER(WHERE severity='serious') as serious,
              COUNT(*) as total
       FROM hse_incidents WHERE supplier_id=$1 AND incident_date >= NOW() - INTERVAL '1 year'`,
      [supplierId]
    );
    // Score 0-5 inversely proportional to severity incidents
    let score = 5.0;
    score -= parseInt(s.fatal||0) * 2.5;
    score -= parseInt(s.serious||0) * 0.5;
    score -= parseInt(s.total||0) * 0.1;
    score = Math.max(0, Math.min(5, score));
    await require('../../db/pool').query(
      `INSERT INTO supplier_scores(supplier_id, score_hse)
       VALUES($1, $2)
       ON CONFLICT(supplier_id) DO UPDATE SET score_hse=$2, updated_at=NOW()`,
      [supplierId, parseFloat(score.toFixed(2))]
    );
  } catch {}
}

module.exports = r;
