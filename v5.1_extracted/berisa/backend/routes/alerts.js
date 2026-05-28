'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const notify=require('../services/notifications');

router.get('/',async(req,res,next)=>{try{const{rows}=await query('SELECT * FROM alert_rules WHERE org_id=$1 ORDER BY created_at DESC',[req.org.id]);res.json(rows);}catch(err){next(err);}});

router.post('/',async(req,res,next)=>{
  try{
    const{name,type='new_project',filters={},channels=['email'],channel_config={},frequency='immediate'}=req.body;
    if(!name) return res.status(400).json({error:'Nombre requerido'});
    const{rows:[r]}=await query('INSERT INTO alert_rules(org_id,user_id,name,type,filters,channels,channel_config,frequency)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *',
      [req.org.id,req.user.id,name,type,JSON.stringify(filters),channels,JSON.stringify(channel_config),frequency]);
    await query('UPDATE onboarding_progress SET step_first_alert=true WHERE org_id=$1',[req.org.id]);
    res.status(201).json(r);
  }catch(err){next(err);}
});

router.patch('/:id',async(req,res,next)=>{
  try{
    const al=['name','filters','channels','channel_config','frequency','is_active'];
    const f=[],v=[];let i=1;
    for(const k of al)if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(typeof req.body[k]==='object'?JSON.stringify(req.body[k]):req.body[k]);}
    v.push(req.params.id,req.org.id);
    const{rows}=await query(`UPDATE alert_rules SET ${f.join(',')} WHERE id=$${i} AND org_id=$${i+1} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({error:'Regla no encontrada'});
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.delete('/:id',async(req,res,next)=>{try{await query('DELETE FROM alert_rules WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);res.json({deleted:true});}catch(err){next(err);}});

router.get('/events',async(req,res,next)=>{
  try{
    const{unread,page=1}=req.query;const limit=30;const offset=(parseInt(page)-1)*limit;
    const conds=['ae.org_id=$1'];const vals=[req.org.id];
    if(unread==='true') conds.push('ae.read_at IS NULL');
    const{rows}=await query(`SELECT ae.*,p.name as project_name,p.sector,p.region,p.capex_usd_m FROM alert_events ae LEFT JOIN projects p ON p.id=ae.project_id WHERE ${conds.join(' AND ')} ORDER BY ae.created_at DESC LIMIT ${limit} OFFSET ${offset}`,vals);
    const{rows:[cnt]}=await query('SELECT COUNT(*) FROM alert_events WHERE org_id=$1 AND read_at IS NULL',[req.org.id]);
    res.json({data:rows,unreadCount:parseInt(cnt.count)});
  }catch(err){next(err);}
});

router.post('/events/:id/read',async(req,res,next)=>{try{await query('UPDATE alert_events SET read_at=NOW() WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);res.json({read:true});}catch(err){next(err);}});
router.post('/events/read-all',async(req,res,next)=>{try{await query('UPDATE alert_events SET read_at=NOW() WHERE org_id=$1 AND read_at IS NULL',[req.org.id]);res.json({read:true});}catch(err){next(err);}});

async function evaluateAlerts(projectId){
  try{
    const{rows:[proj]}=await query('SELECT * FROM projects WHERE id=$1',[projectId]);
    if(!proj)return;
    const{rows:rules}=await query('SELECT ar.*,u.email,u.name as user_name FROM alert_rules ar JOIN users u ON u.id=ar.user_id WHERE ar.is_active=true');
    for(const rule of rules){
      const f=rule.filters||{};
      if(f.sector&&proj.sector!==f.sector)continue;
      if(f.region&&proj.region!==f.region)continue;
      if(f.capex_min&&(proj.capex_usd_m||0)<f.capex_min)continue;
      const{rows:[ev]}=await query('INSERT INTO alert_events(rule_id,org_id,project_id,type,payload)VALUES($1,$2,$3,$4,$5)ON CONFLICT DO NOTHING RETURNING id',
        [rule.id,rule.org_id,proj.id,rule.type,JSON.stringify({projectName:proj.name,sector:proj.sector,region:proj.region,capex:proj.capex_usd_m})]);
      if(!ev)continue;
      const alert={projectId:proj.id,projectName:proj.name,sector:proj.sector,region:proj.region,capex:proj.capex_usd_m,status:proj.status,type:rule.type};
      if((rule.channels||[]).includes('email')&&rule.email) notify.sendAlertEmail(rule.email,rule.user_name,alert).catch(()=>{});
      await query('UPDATE alert_rules SET last_fired_at=NOW(),fire_count=fire_count+1 WHERE id=$1',[rule.id]);
    }
  }catch(e){console.error('[Alerts]',e.message);}
}
module.exports=router;
module.exports.evaluateAlerts=evaluateAlerts;
