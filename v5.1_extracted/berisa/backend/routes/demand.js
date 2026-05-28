'use strict';
/** Project demand needs — buyer declares needs, triggers matching */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireManager } = require('../middleware/auth');
const matchingService = require('../services/matching');

router.get('/', async (req, res, next) => {
  try {
    const { project_id, status } = req.query;
    const c=['n.org_id=$1'],v=[req.org.id]; let i=2;
    if(project_id){c.push(`n.project_id=$${i++}`);v.push(project_id);}
    if(status){c.push(`n.status=$${i++}`);v.push(status);}
    const { rows } = await query(
      `SELECT n.*,p.name as project_name,
              (SELECT COUNT(*) FROM marketplace_matches WHERE need_id=n.id) as match_count
       FROM project_demand_needs n LEFT JOIN projects p ON p.id=n.project_id
       WHERE ${c.join(' AND ')} ORDER BY n.created_at DESC`, v
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM project_demand_needs WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({ error: 'Necesidad no encontrada' });
    const matches = await query(
      `SELECT m.*,s.company_name,s.homolog_level,s.logo_url,ss.score_total
       FROM marketplace_matches m
       JOIN suppliers s ON s.id=m.supplier_id
       LEFT JOIN supplier_scores ss ON ss.supplier_id=m.supplier_id
       WHERE m.need_id=$1 ORDER BY m.match_score DESC NULLS LAST`,
      [req.params.id]
    );
    res.json({ ...rows[0], matches: matches.rows });
  } catch(err) { next(err); }
});

router.post('/', requireManager, async (req, res, next) => {
  try {
    const { project_id, title, description, capability_ids=[], estimated_usd_m, region, required_date, required_level='nivel_1', required_certs=[] } = req.body;
    if(!title) return res.status(400).json({ error: 'Título requerido' });
    const { rows:[n] } = await query(
      'INSERT INTO project_demand_needs(org_id,project_id,title,description,capability_ids,estimated_usd_m,region,required_date,required_level,required_certs,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.org.id,project_id||null,title,description,capability_ids,estimated_usd_m||null,region||null,required_date||null,required_level,required_certs,req.user.id]
    );
    // Auto-generate matches
    const matchResult = await matchingService.generateMatches(n.id);
    res.status(201).json({ ...n, matchesGenerated: matchResult.count });
  } catch(err) { next(err); }
});

router.post('/:id/generate-matches', requireManager, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM project_demand_needs WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({ error: 'Necesidad no encontrada' });
    const result = await matchingService.generateMatches(req.params.id);
    res.json(result);
  } catch(err) { next(err); }
});

router.patch('/:id', requireManager, async (req, res, next) => {
  try {
    const al=['title','description','capability_ids','estimated_usd_m','region','required_date','required_level','status'];
    const f=[],v=[]; let i=1;
    for(const k of al) if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    v.push(req.params.id,req.org.id);
    const { rows } = await query(`UPDATE project_demand_needs SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} AND org_id=$${i+1} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

module.exports = router;
