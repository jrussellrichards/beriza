'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
router.get('/summary',async(req,res,next)=>{
  try{
    const id=req.org.id;
    const[o,p,a,ac]=await Promise.all([
      query("SELECT COUNT(*) FILTER(WHERE stage NOT IN('won','lost')) as active_opps,COUNT(*) FILTER(WHERE stage='won') as won_opps,SUM(value_usd_m) FILTER(WHERE stage NOT IN('won','lost')) as pipeline_value,SUM(value_usd_m*probability/100) FILTER(WHERE stage NOT IN('won','lost')) as weighted_value,SUM(value_usd_m) FILTER(WHERE stage='won') as won_value,CASE WHEN COUNT(*) FILTER(WHERE stage IN('won','lost'))>0 THEN ROUND(COUNT(*) FILTER(WHERE stage='won')::numeric/COUNT(*) FILTER(WHERE stage IN('won','lost'))*100,1) ELSE 0 END as win_rate FROM opportunities WHERE org_id=$1",[id]),
      query("SELECT COUNT(*) as saved_projects,COUNT(*) FILTER(WHERE opp_window='green') as green_projects FROM org_project_saves ops JOIN projects p ON p.id=ops.project_id WHERE ops.org_id=$1",[id]),
      query('SELECT COUNT(*) as rules,COUNT(*) FILTER(WHERE is_active=true) as active_rules,(SELECT COUNT(*) FROM alert_events WHERE org_id=$1 AND read_at IS NULL) as unread FROM alert_rules WHERE org_id=$1',[id]),
      query("SELECT COUNT(*) as total,COUNT(*) FILTER(WHERE type='meeting') as meetings,COUNT(*) FILTER(WHERE type='call') as calls FROM crm_activities WHERE org_id=$1 AND created_at>NOW()-INTERVAL'30 days'",[id]),
    ]);
    res.json({pipeline:o.rows[0],projects:p.rows[0],alerts:a.rows[0],activities:ac.rows[0]});
  }catch(err){next(err);}
});
router.get('/stage-funnel',async(req,res,next)=>{
  try{
    const{rows}=await query("SELECT stage,COUNT(*) as count,SUM(value_usd_m) as total_value FROM opportunities WHERE org_id=$1 AND stage NOT IN('won','lost') GROUP BY stage",[req.org.id]);
    res.json(rows);
  }catch(err){next(err);}
});
router.get('/team-performance',async(req,res,next)=>{
  try{
    const{rows}=await query("SELECT u.id,u.name,u.role,COUNT(o.id) as total_opps,COUNT(o.id) FILTER(WHERE o.stage='won') as won,SUM(o.value_usd_m) FILTER(WHERE o.stage='won') as won_value FROM users u LEFT JOIN opportunities o ON o.assigned_to=u.id AND o.org_id=$1 WHERE u.org_id=$1 AND u.is_active=true GROUP BY u.id,u.name,u.role ORDER BY won_value DESC NULLS LAST",[req.org.id]);
    res.json(rows);
  }catch(err){next(err);}
});
module.exports=router;
