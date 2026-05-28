'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const STEPS=['step_profile','step_first_alert','step_first_project','step_first_opp','step_invite_user','step_api_key','step_billing'];
router.get('/',async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT * FROM onboarding_progress WHERE org_id=$1',[req.org.id]);
    if(!rows.length){await query('INSERT INTO onboarding_progress(org_id)VALUES($1)',[req.org.id]);return res.json({org_id:req.org.id,dismissed:false,progressPct:0});}
    const p=rows[0];const done=STEPS.filter(s=>p[s]).length;
    res.json({...p,completedCount:done,totalSteps:STEPS.length,progressPct:Math.round(done/STEPS.length*100)});
  }catch(err){next(err);}
});
router.post('/step/:step',async(req,res,next)=>{
  try{
    const{step}=req.params;
    if(!STEPS.includes(step)) return res.status(400).json({error:'Paso inválido'});
    await query(`UPDATE onboarding_progress SET ${step}=true,updated_at=NOW() WHERE org_id=$1`,[req.org.id]);
    const{rows}=await query('SELECT * FROM onboarding_progress WHERE org_id=$1',[req.org.id]);
    const allDone=STEPS.every(s=>rows[0][s]);
    if(allDone&&!rows[0].completed_at) await query('UPDATE onboarding_progress SET completed_at=NOW() WHERE org_id=$1',[req.org.id]);
    res.json({step,completed:true,allDone});
  }catch(err){next(err);}
});
router.post('/dismiss',async(req,res,next)=>{try{await query('UPDATE onboarding_progress SET dismissed=true WHERE org_id=$1',[req.org.id]);res.json({dismissed:true});}catch(err){next(err);}});
module.exports=router;
