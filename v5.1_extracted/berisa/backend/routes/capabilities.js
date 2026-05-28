'use strict';
/** Supplier capabilities catalog — coded capabilities matching */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireManager } = require('../middleware/auth');

// GET /capabilities/catalog
router.get('/catalog', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM supplier_capability_catalog WHERE is_active=true ORDER BY category,sort_order,name');
    const grouped = {};
    rows.forEach(r => { if(!grouped[r.category]) grouped[r.category]=[]; grouped[r.category].push(r); });
    res.json({ catalog: rows, grouped });
  } catch(err) { next(err); }
});

// GET /capabilities/suppliers/:id — supplier's capabilities
router.get('/suppliers/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sc.*, c.code, c.name as cap_name, c.category
       FROM supplier_profile_capabilities sc
       JOIN supplier_capability_catalog c ON c.id=sc.capability_id
       WHERE sc.supplier_id=$1 ORDER BY c.category, c.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

// POST /capabilities/suppliers/:id — add capabilities to supplier
router.post('/suppliers/:id', async (req, res, next) => {
  try {
    const { capability_ids, years_exp, notes } = req.body;
    if(!Array.isArray(capability_ids)||!capability_ids.length) return res.status(400).json({ error:'capability_ids array requerido' });
    const inserts = await Promise.all(capability_ids.map(cid =>
      query('INSERT INTO supplier_profile_capabilities(supplier_id,capability_id,years_exp,notes) VALUES($1,$2,$3,$4) ON CONFLICT(supplier_id,capability_id) DO UPDATE SET years_exp=EXCLUDED.years_exp,notes=EXCLUDED.notes RETURNING *',
        [req.params.id, cid, years_exp||null, notes||null])
    ));
    res.status(201).json({ added: inserts.length, capability_ids });
  } catch(err) { next(err); }
});

// DELETE /capabilities/suppliers/:suppId/:capId
router.delete('/suppliers/:suppId/:capId', requireManager, async (req, res, next) => {
  try {
    await query('DELETE FROM supplier_profile_capabilities WHERE supplier_id=$1 AND capability_id=$2',[req.params.suppId,req.params.capId]);
    res.json({ deleted: true });
  } catch(err) { next(err); }
});

// GET /capabilities/scores/:suppId — multi-dim score
router.get('/scores/:suppId', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM supplier_scores WHERE supplier_id=$1',[req.params.suppId]);
    if(!rows.length) return res.json({ supplier_id: req.params.suppId, score_total: 0, message: 'Sin datos de scoring aún' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// POST /capabilities/scores/:suppId — upsert multi-dim score
router.post('/scores/:suppId', requireManager, async (req, res, next) => {
  try {
    const { score_hse=0, score_quality=0, score_env=0, score_finance=0, score_perf=0, score_docs=0 } = req.body;
    const { rows:[s] } = await query(
      `INSERT INTO supplier_scores(supplier_id,score_hse,score_quality,score_env,score_finance,score_perf,score_docs)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(supplier_id) DO UPDATE SET score_hse=$2,score_quality=$3,score_env=$4,score_finance=$5,score_perf=$6,score_docs=$7,updated_at=NOW()
       RETURNING *`,
      [req.params.suppId,score_hse,score_quality,score_env,score_finance,score_perf,score_docs]
    );
    res.status(201).json(s);
  } catch(err) { next(err); }
});

module.exports = router;
