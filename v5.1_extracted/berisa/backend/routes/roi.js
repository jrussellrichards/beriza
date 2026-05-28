'use strict';
/** ROI module — events, targets, measurement */
const router = require('express').Router();
const { query } = require('../db/pool');

router.get('/summary', async (req, res, next) => {
  try {
    const period = req.query.period || new Date().toISOString().slice(0,7);
    const [events, targets] = await Promise.all([
      query("SELECT event_type,COUNT(*) as count,SUM(value_usd_m) as total FROM roi_events WHERE org_id=$1 AND DATE_TRUNC('month',occurred_at)=$2::date GROUP BY event_type",[req.org.id,period+'-01']),
      query("SELECT metric,target FROM roi_targets WHERE org_id=$1 AND period=$2",[req.org.id,period]),
    ]);
    const evMap = {}; events.rows.forEach(e => evMap[e.event_type]={count:parseInt(e.count),total:parseFloat(e.total||0)});
    const tgMap = {}; targets.rows.forEach(t => tgMap[t.metric]=parseFloat(t.target));
    res.json({ period, events: evMap, targets: tgMap });
  } catch(err) { next(err); }
});

router.get('/events', async (req, res, next) => {
  try {
    const { user_id, type, page=1 } = req.query;
    const lim=50, off=(parseInt(page)-1)*lim;
    const c=['e.org_id=$1'],v=[req.org.id]; let i=2;
    if(user_id){c.push(`e.user_id=$${i++}`);v.push(user_id);}
    if(type){c.push(`e.event_type=$${i++}`);v.push(type);}
    const { rows } = await query(
      `SELECT e.*,u.name as user_name,o.name as opp_name FROM roi_events e
       LEFT JOIN users u ON u.id=e.user_id
       LEFT JOIN opportunities o ON o.id=e.opp_id
       WHERE ${c.join(' AND ')} ORDER BY e.occurred_at DESC LIMIT ${lim} OFFSET ${off}`, v
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/events', async (req, res, next) => {
  try {
    const { opp_id, po_id, event_type, value_usd_m, notes, occurred_at } = req.body;
    const TYPES=['quote_sent','quote_won','po_issued','meeting','call','demo','lead_qualified','contract_signed'];
    if(!event_type||!TYPES.includes(event_type)) return res.status(400).json({ error:`Tipo inválido. Opciones: ${TYPES.join(', ')}`});
    const { rows:[e] } = await query(
      'INSERT INTO roi_events(org_id,user_id,opp_id,po_id,event_type,value_usd_m,notes,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.org.id,req.user.id,opp_id||null,po_id||null,event_type,value_usd_m||null,notes||null,occurred_at||new Date()]
    );
    res.status(201).json(e);
  } catch(err) { next(err); }
});

router.post('/targets', async (req, res, next) => {
  try {
    const { period, metric, target, user_id } = req.body;
    if(!period||!metric||target===undefined) return res.status(400).json({ error:'period, metric y target requeridos' });
    const { rows:[t] } = await query(
      'INSERT INTO roi_targets(org_id,user_id,period,metric,target) VALUES($1,$2,$3,$4,$5) ON CONFLICT(org_id,user_id,period,metric) DO UPDATE SET target=$5 RETURNING *',
      [req.org.id,user_id||req.user.id,period,metric,parseFloat(target)]
    );
    res.status(201).json(t);
  } catch(err) { next(err); }
});

module.exports = router;
