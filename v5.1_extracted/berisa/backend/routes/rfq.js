'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireManager}=require('../middleware/auth');
router.get('/',async(req,res,next)=>{try{const{rows}=await query('SELECT r.*,COUNT(ri.id) as invited_count,COUNT(rp.id) as proposal_count FROM rfq_requests r LEFT JOIN rfq_invitations ri ON ri.rfq_id=r.id LEFT JOIN rfq_proposals rp ON rp.rfq_id=r.id WHERE r.org_id=$1 GROUP BY r.id ORDER BY r.created_at DESC',[req.org.id]);res.json(rows);}catch(err){next(err);}});
router.post('/',requireManager,async(req,res,next)=>{
  try{
    const{project_id,title,description,sector,budget_usd_m,required_level='nivel_1',regions,specialties,due_date}=req.body;
    if(!title) return res.status(400).json({error:'Título requerido'});
    const{rows:[r]}=await query('INSERT INTO rfq_requests(org_id,project_id,title,description,sector,budget_usd_m,required_level,regions,specialties,due_date,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)RETURNING *',
      [req.org.id,project_id||null,title,description,sector,budget_usd_m||null,required_level,regions||[],specialties||[],due_date||null,req.user.id]);
    res.status(201).json(r);
  }catch(err){next(err);}
});
router.post('/:id/publish',requireManager,async(req,res,next)=>{
  try{
    const{rows:[rfq]}=await query('SELECT * FROM rfq_requests WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rfq) return res.status(404).json({error:'RFQ no encontrado'});
    const c=[`s.homolog_level>='${rfq.required_level}'`,'s.is_active=true'],v=[];let i=1;
    if(rfq.sector){c.push(`$${i++}=ANY(s.sectors)`);v.push(rfq.sector);}
    const{rows:m}=await query(`SELECT id,company_name FROM suppliers s WHERE ${c.join(' AND ')} ORDER BY s.homolog_level DESC,s.rating DESC NULLS LAST LIMIT 20`,v);
    for(const s of m) await query('INSERT INTO rfq_invitations(rfq_id,supplier_id)VALUES($1,$2)ON CONFLICT DO NOTHING',[rfq.id,s.id]);
    await query("UPDATE rfq_requests SET status='published',published_at=NOW() WHERE id=$1",[rfq.id]);
    res.json({published:true,invitedCount:m.length,suppliers:m});
  }catch(err){next(err);}
});
router.get('/:id/proposals',async(req,res,next)=>{try{const{rows}=await query('SELECT rp.*,s.company_name,s.homolog_level,s.rating FROM rfq_proposals rp JOIN suppliers s ON s.id=rp.supplier_id WHERE rp.rfq_id=$1 ORDER BY rp.score DESC NULLS LAST',[req.params.id]);res.json(rows);}catch(err){next(err);}});
router.post('/:id/award',requireManager,async(req,res,next)=>{try{await query('UPDATE rfq_requests SET status='awarded',awarded_to=$1,awarded_at=NOW(),award_notes=$2 WHERE id=$3 AND org_id=$4',[req.body.supplier_id,req.body.notes||null,req.params.id,req.org.id]);res.json({awarded:true});}catch(err){next(err);}});
module.exports=router;
