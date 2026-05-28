'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireManager}=require('../middleware/auth');

router.get('/opportunities',async(req,res,next)=>{
  try{
    const{stage,assigned_to,page=1}=req.query;
    const lim=50,offset=(parseInt(page)-1)*lim;
    const c=['o.org_id=$1'],v=[req.org.id];let i=2;
    if(stage){c.push(`o.stage=$${i++}`);v.push(stage);}
    if(assigned_to){c.push(`o.assigned_to=$${i++}`);v.push(assigned_to);}
    const{rows}=await query(`SELECT o.*,u.name as assignee_name,p.name as project_name FROM opportunities o LEFT JOIN users u ON u.id=o.assigned_to LEFT JOIN projects p ON p.id=o.project_id WHERE ${c.join(' AND ')} ORDER BY o.created_at DESC LIMIT ${lim} OFFSET ${offset}`,v);
    const{rows:sum}=await query("SELECT stage,COUNT(*) as count,SUM(value_usd_m) as total_value,SUM(value_usd_m*probability/100) as weighted_value FROM opportunities WHERE org_id=$1 AND stage NOT IN('won','lost') GROUP BY stage",[req.org.id]);
    res.json({data:rows,pipeline:sum});
  }catch(err){next(err);}
});

router.post('/opportunities',async(req,res,next)=>{
  try{
    const{project_id,contact_id,name,company,value_usd_m,stage='prospecting',probability,sector,assigned_to,due_date,notes}=req.body;
    if(!name) return res.status(400).json({error:'Nombre requerido'});
    const{rows:[o]}=await query('INSERT INTO opportunities(org_id,project_id,contact_id,name,company,value_usd_m,stage,probability,sector,assigned_to,due_date,notes,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)RETURNING *',
      [req.org.id,project_id||null,contact_id||null,name,company,value_usd_m,stage,probability||10,sector,assigned_to||req.user.id,due_date||null,notes||null,req.user.id]);
    await query('UPDATE onboarding_progress SET step_first_opp=true WHERE org_id=$1',[req.org.id]);
    res.status(201).json(o);
  }catch(err){next(err);}
});

router.patch('/opportunities/:id',async(req,res,next)=>{
  try{
    const al=['name','company','value_usd_m','stage','probability','sector','assigned_to','due_date','notes','lost_reason'];
    const f=[],v=[];let i=1;
    for(const k of al)if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    if(req.body.stage==='won'){f.push(`won_at=$${i++}`);v.push(new Date());}
    v.push(req.params.id,req.org.id);
    const{rows}=await query(`UPDATE opportunities SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} AND org_id=$${i+1} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({error:'Oportunidad no encontrada'});
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.delete('/opportunities/:id',requireManager,async(req,res,next)=>{try{await query('DELETE FROM opportunities WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);res.json({deleted:true});}catch(err){next(err);}});

router.get('/contacts',async(req,res,next)=>{
  try{
    const{project_id,search}=req.query;const c=['org_id=$1'],v=[req.org.id];let i=2;
    if(project_id){c.push(`project_id=$${i++}`);v.push(project_id);}
    if(search){c.push(`(name ILIKE $${i} OR company ILIKE $${i})`);v.push('%'+search+'%');i++;}
    const{rows}=await query(`SELECT * FROM contacts WHERE ${c.join(' AND ')} ORDER BY name`,v);
    res.json(rows);
  }catch(err){next(err);}
});

router.post('/contacts',async(req,res,next)=>{
  try{
    const{project_id,name,title,company,email,phone,linkedin_url,category,tag,notes}=req.body;
    if(!name) return res.status(400).json({error:'Nombre requerido'});
    const{rows:[ct]}=await query('INSERT INTO contacts(org_id,project_id,name,title,company,email,phone,linkedin_url,category,tag,notes,assigned_to,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)RETURNING *',
      [req.org.id,project_id||null,name,title,company,email,phone,linkedin_url,category,tag,notes,req.user.id,req.user.id]);
    res.status(201).json(ct);
  }catch(err){next(err);}
});

router.get('/activities',async(req,res,next)=>{
  try{
    const{opp_id}=req.query;const c=['org_id=$1'],v=[req.org.id];let i=2;
    if(opp_id){c.push(`opp_id=$${i++}`);v.push(opp_id);}
    const{rows}=await query(`SELECT a.*,u.name as user_name FROM crm_activities a LEFT JOIN users u ON u.id=a.user_id WHERE ${c.join(' AND ')} ORDER BY a.created_at DESC LIMIT 100`,v);
    res.json(rows);
  }catch(err){next(err);}
});

router.post('/activities',async(req,res,next)=>{
  try{
    const{opp_id,contact_id,type,subject,body,outcome,due_at,completed_at}=req.body;
    if(!type) return res.status(400).json({error:'Tipo requerido'});
    const{rows:[a]}=await query('INSERT INTO crm_activities(org_id,opp_id,contact_id,type,subject,body,outcome,due_at,completed_at,user_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)RETURNING *',
      [req.org.id,opp_id||null,contact_id||null,type,subject,body,outcome,due_at||null,completed_at||null,req.user.id]);
    res.status(201).json(a);
  }catch(err){next(err);}
});

module.exports=router;
