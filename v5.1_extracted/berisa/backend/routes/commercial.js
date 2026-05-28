'use strict';
/** Commercial accounts — separate from pipeline */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireManager } = require('../middleware/auth');

router.get('/accounts', async (req, res, next) => {
  try {
    const { type, assigned_to, search } = req.query;
    const c=['ca.org_id=$1'],v=[req.org.id]; let i=2;
    if(type){c.push(`ca.type=$${i++}`);v.push(type);}
    if(assigned_to){c.push(`ca.assigned_to=$${i++}`);v.push(assigned_to);}
    if(search){c.push(`ca.name ILIKE $${i++}`);v.push('%'+search+'%');}
    const { rows } = await query(
      `SELECT ca.*,u.name as assignee_name,
              COUNT(o.id) as opp_count,
              COUNT(o.id) FILTER(WHERE o.stage='won') as won_count
       FROM commercial_accounts ca
       LEFT JOIN users u ON u.id=ca.assigned_to
       LEFT JOIN opportunities o ON o.org_id=ca.org_id AND o.company=ca.name
       WHERE ${c.join(' AND ')} GROUP BY ca.id,u.name ORDER BY ca.score DESC,ca.created_at DESC`, v
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/accounts', requireManager, async (req, res, next) => {
  try {
    const { name,type='prospect',sector,region,website,assigned_to,annual_value_usd_m,notes } = req.body;
    if(!name) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows:[a] } = await query(
      'INSERT INTO commercial_accounts(org_id,name,type,sector,region,website,assigned_to,annual_value_usd_m,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.org.id,name,type,sector,region,website,assigned_to||req.user.id,annual_value_usd_m||null,notes||null,req.user.id]
    );
    res.status(201).json(a);
  } catch(err) { next(err); }
});

router.patch('/accounts/:id', requireManager, async (req, res, next) => {
  try {
    const al=['name','type','sector','region','website','assigned_to','annual_value_usd_m','notes','score'];
    const f=[],v=[]; let i=1;
    for(const k of al) if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    v.push(req.params.id,req.org.id);
    const { rows } = await query(`UPDATE commercial_accounts SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} AND org_id=$${i+1} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const { rows:[s] } = await query(
      `SELECT COUNT(*) FILTER(WHERE type='prospect') as prospects,
              COUNT(*) FILTER(WHERE type='customer') as customers,
              COUNT(*) FILTER(WHERE type='lost') as lost,
              SUM(annual_value_usd_m) as total_annual_value
       FROM commercial_accounts WHERE org_id=$1`, [req.org.id]
    );
    res.json(s);
  } catch(err) { next(err); }
});

// Activities
router.get('/activities', async (req, res, next) => {
  try {
    const { account_id, overdue } = req.query;
    const c=['a.org_id=$1'],v=[req.org.id]; let i=2;
    if(overdue==='true') c.push('a.completed_at IS NULL AND a.due_at < NOW()');
    const { rows } = await query(
      `SELECT a.*,u.name as user_name FROM crm_activities a LEFT JOIN users u ON u.id=a.user_id
       WHERE ${c.join(' AND ')} ORDER BY a.due_at ASC NULLS LAST LIMIT 100`, v
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/activities', async (req, res, next) => {
  try {
    const { type,subject,body,outcome,due_at } = req.body;
    if(!type) return res.status(400).json({ error: 'Tipo requerido' });
    const { rows:[a] } = await query(
      'INSERT INTO crm_activities(org_id,type,subject,body,outcome,due_at,user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.org.id,type,subject,body,outcome,due_at||null,req.user.id]
    );
    res.status(201).json(a);
  } catch(err) { next(err); }
});

router.patch('/activities/:id/complete', async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE crm_activities SET completed_at=NOW(),outcome=$1 WHERE id=$2 AND org_id=$3 RETURNING *",[req.body.outcome||null,req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({ error: 'Actividad no encontrada' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

module.exports = router;
