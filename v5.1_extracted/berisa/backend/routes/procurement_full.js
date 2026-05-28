'use strict';
/** Full procurement module — OC, milestones, invoices, compliance */
const router = require('express').Router();
const { query } = require('../db/pool');
const { requireManager } = require('../middleware/auth');

// ── Purchase Orders ──────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const { supplier_id, status, project_id } = req.query;
    const c=['po.org_id=$1'],v=[req.org.id]; let i=2;
    if(supplier_id){c.push(`po.supplier_id=$${i++}`);v.push(supplier_id);}
    if(status){c.push(`po.status=$${i++}`);v.push(status);}
    if(project_id){c.push(`po.project_id=$${i++}`);v.push(project_id);}
    const { rows } = await query(
      `SELECT po.*,s.company_name,p.name as project_name,
              COUNT(pm.id) as milestone_count,
              COUNT(pm.id) FILTER(WHERE pm.status='completed') as milestones_done
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id=po.supplier_id
       LEFT JOIN projects p ON p.id=po.project_id
       LEFT JOIN po_milestones pm ON pm.po_id=po.id
       WHERE ${c.join(' AND ')} GROUP BY po.id,s.company_name,p.name ORDER BY po.created_at DESC`, v
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/orders', requireManager, async (req, res, next) => {
  try {
    const { rfq_id,supplier_id,project_id,po_number,title,description,amount_usd,payment_terms,due_date } = req.body;
    if(!title||!supplier_id) return res.status(400).json({ error: 'Título y proveedor requeridos' });
    const { rows:[po] } = await query(
      'INSERT INTO purchase_orders(org_id,rfq_id,supplier_id,project_id,po_number,title,description,amount_usd,payment_terms,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.org.id,rfq_id||null,supplier_id,project_id||null,po_number||null,title,description,amount_usd||null,payment_terms||null,due_date||null,req.user.id]
    );
    res.status(201).json(po);
  } catch(err) { next(err); }
});

router.patch('/orders/:id/status', requireManager, async (req, res, next) => {
  try {
    const VALID=['draft','issued','accepted','in_progress','completed','cancelled'];
    if(!VALID.includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
    const setClauses = ['status=$1'];
    const vals = [req.body.status];
    if (req.body.status === 'issued') { setClauses.push(`issued_at=$${vals.length+1}`); vals.push(new Date()); }
    setClauses.push('updated_at=NOW()');
    vals.push(req.params.id, req.org.id);
    const idxId = vals.length - 1, idxOrg = vals.length;
    const { rows } = await query(`UPDATE purchase_orders SET ${setClauses.join(',')} WHERE id=$${idxId} AND org_id=$${idxOrg} RETURNING *`, vals);
    if(!rows.length) return res.status(404).json({ error: 'OC no encontrada' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// ── Milestones ───────────────────────────────────────────
router.get('/orders/:id/milestones', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM po_milestones WHERE po_id=$1 ORDER BY sort_order,due_date',[req.params.id]);
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/orders/:id/milestones', requireManager, async (req, res, next) => {
  try {
    const { title,amount_usd,due_date,sort_order } = req.body;
    if(!title) return res.status(400).json({ error: 'Título requerido' });
    const { rows:[m] } = await query(
      'INSERT INTO po_milestones(po_id,title,amount_usd,due_date,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id,title,amount_usd||null,due_date||null,sort_order||0]
    );
    res.status(201).json(m);
  } catch(err) { next(err); }
});

router.patch('/milestones/:id/complete', requireManager, async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE po_milestones SET status='completed',completed_at=NOW(),notes=$1 WHERE id=$2 RETURNING *",[req.body.notes||null,req.params.id]);
    if(!rows.length) return res.status(404).json({ error: 'Hito no encontrado' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// ── Invoices ─────────────────────────────────────────────
router.get('/orders/:id/invoices', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM po_invoices WHERE po_id=$1 ORDER BY created_at DESC',[req.params.id]);
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/orders/:id/invoices', requireManager, async (req, res, next) => {
  try {
    const { milestone_id,invoice_num,amount_usd,issued_date,due_date } = req.body;
    const { rows:[inv] } = await query(
      'INSERT INTO po_invoices(po_id,milestone_id,invoice_num,amount_usd,issued_date,due_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id,milestone_id||null,invoice_num||null,amount_usd,issued_date||null,due_date||null]
    );
    res.status(201).json(inv);
  } catch(err) { next(err); }
});

// ── Subcontracting ────────────────────────────────────────
router.get('/subcontracts', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sp.*,s.company_name,p.name as project_name,
              COUNT(sc.id) as checklist_total,
              COUNT(sc.id) FILTER(WHERE sc.completed=true) as checklist_done
       FROM subcontracting_packages sp
       LEFT JOIN suppliers s ON s.id=sp.supplier_id
       LEFT JOIN projects p ON p.id=sp.project_id
       LEFT JOIN subcontracting_checklist sc ON sc.package_id=sp.id
       WHERE sp.org_id=$1 GROUP BY sp.id,s.company_name,p.name ORDER BY sp.created_at DESC`,
      [req.org.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.post('/subcontracts', requireManager, async (req, res, next) => {
  try {
    const { po_id,supplier_id,project_id,contract_num,title,amount_usd,start_date,end_date } = req.body;
    if(!title||!supplier_id) return res.status(400).json({ error: 'Título y proveedor requeridos' });
    const { rows:[sp] } = await query(
      'INSERT INTO subcontracting_packages(org_id,po_id,supplier_id,project_id,contract_num,title,amount_usd,start_date,end_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.org.id,po_id||null,supplier_id,project_id||null,contract_num||null,title,amount_usd||null,start_date||null,end_date||null,req.user.id]
    );
    await initSubcontractChecklist(sp.id);
    res.status(201).json(sp);
  } catch(err) { next(err); }
});

router.get('/subcontracts/:id/compliance', async (req, res, next) => {
  try {
    const { stage } = req.query;
    const c=['package_id=$1'],v=[req.params.id]; if(stage){c.push('stage=$2');v.push(stage);}
    const { rows } = await query(`SELECT * FROM subcontracting_checklist WHERE ${c.join(' AND ')} ORDER BY stage,dimension,item_key`,v);
    const byStage = {};
    rows.forEach(r => { if(!byStage[r.stage]) byStage[r.stage]={}; if(!byStage[r.stage][r.dimension]) byStage[r.stage][r.dimension]=[]; byStage[r.stage][r.dimension].push(r); });
    res.json({ items: rows, byStage, summary: { total:rows.length, completed:rows.filter(r=>r.completed).length } });
  } catch(err) { next(err); }
});

router.patch('/subcontracts/:id/compliance/:itemId', requireManager, async (req, res, next) => {
  try {
    const { completed, doc_url, notes } = req.body;
    const { rows } = await query(
      'UPDATE subcontracting_checklist SET completed=$1,doc_url=$2,notes=$3,reviewed_by=$4,completed_at=$5 WHERE id=$6 AND package_id=$7 RETURNING *',
      [completed,doc_url||null,notes||null,req.user.id,completed?new Date():null,req.params.itemId,req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error: 'Ítem no encontrado' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// Summary
router.get('/summary', async (req, res, next) => {
  try {
    const { rows:[s] } = await query(
      `SELECT
        COUNT(DISTINCT po.id) as total_pos,
        COUNT(DISTINCT po.id) FILTER(WHERE po.status='in_progress') as active_pos,
        SUM(po.amount_usd) FILTER(WHERE po.status NOT IN('cancelled')) as total_committed,
        COUNT(DISTINCT sp.id) as total_subcontracts,
        COUNT(DISTINCT sp.id) FILTER(WHERE sp.status='execution') as active_subcontracts
       FROM purchase_orders po, subcontracting_packages sp
       WHERE po.org_id=$1 AND sp.org_id=$1`, [req.org.id]
    );
    res.json(s);
  } catch(err) { next(err); }
});

async function initSubcontractChecklist(packageId) {
  const ITEMS = {
    onboarding: { legal:['contrato_firmado','vigencia_legal','rut'], hse:['plan_hse','acreditacion_personal'], insurance:['seguro_rc','seguro_mutual'] },
    monthly:    { labor:['liquidaciones','prevision','asistencia'], hse:['registro_accidentes','inspecciones'], financial:['estado_pago_anterior'] },
    payment:    { financial:['factura_emitida','oc_vigente'], labor:['cumplimiento_laboral_mes'], hse:['sin_accidentes_graves'] },
    closure:    { legal:['finiquitos','devolucion_garantias'], hse:['informe_hse_final'], quality:['lista_observaciones'] },
  };
  const vals = [];
  for(const [stage, dims] of Object.entries(ITEMS))
    for(const [dim, items] of Object.entries(dims))
      for(const key of items)
        vals.push(`('${packageId}','${stage}','${dim}','${key}','${key.replace(/_/g,' ')}')`);
  if(vals.length) await require('../../db/pool').query(
    `INSERT INTO subcontracting_checklist(package_id,stage,dimension,item_key,item_label) VALUES ${vals.join(',')} ON CONFLICT DO NOTHING`
  );
}

module.exports = router;
