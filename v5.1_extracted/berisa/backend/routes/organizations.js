'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireAdmin}=require('../middleware/auth');
router.get('/',async(req,res,next)=>{try{const{rows}=await query('SELECT id,name,slug,plan,plan_status,trial_ends_at,settings,logo_url,website,sector,country,max_users,created_at FROM organizations WHERE id=$1',[req.org.id]);res.json(rows[0]);}catch(err){next(err);}});
router.patch('/',requireAdmin,async(req,res,next)=>{
  try{
    const al=['name','logo_url','website','sector','settings'];
    const f=[],v=[];let i=1;
    for(const k of al)if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(k==='settings'?JSON.stringify(req.body[k]):req.body[k]);}
    if(!f.length) return res.status(400).json({error:'Sin campos'});
    v.push(req.org.id);
    const{rows}=await query(`UPDATE organizations SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} RETURNING id,name,plan,settings`,v);
    await query('UPDATE onboarding_progress SET step_profile=true WHERE org_id=$1',[req.org.id]);
    res.json(rows[0]);
  }catch(err){next(err);}
});
module.exports=router;
