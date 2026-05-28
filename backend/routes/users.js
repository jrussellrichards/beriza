'use strict';
const router=require('express').Router();
const bcrypt=require('bcryptjs');
const{query}=require('../db/pool');
const{requireAdmin,requireManager}=require('../middleware/auth');
router.get('/',requireManager,async(req,res,next)=>{try{const{rows}=await query('SELECT id,name,email,role,is_active,avatar_url,totp_enabled,last_login_at,login_count,created_at FROM users WHERE org_id=$1 ORDER BY created_at',[req.org.id]);res.json(rows);}catch(err){next(err);}});
router.post('/',requireAdmin,async(req,res,next)=>{
  try{
    const{name,email,role='viewer',password}=req.body;
    if(!name||!email||!password) return res.status(400).json({error:'Nombre, email y contraseña requeridos'});
    const{rows:[c]}=await query('SELECT COUNT(*) FROM users WHERE org_id=$1 AND is_active=true',[req.org.id]);
    if(parseInt(c.count)>=req.org.max_users) return res.status(403).json({error:`Límite de usuarios (${req.org.max_users}) alcanzado`,code:'USER_LIMIT'});
    if((await query('SELECT id FROM users WHERE email=$1',[email.toLowerCase()])).rows.length) return res.status(409).json({error:'Email ya registrado'});
    const hash=await bcrypt.hash(password,parseInt(process.env.BCRYPT_ROUNDS||'12'));
    const{rows:[u]}=await query('INSERT INTO users(org_id,name,email,password_hash,role)VALUES($1,$2,$3,$4,$5)RETURNING id,name,email,role,created_at',[req.org.id,name,email.toLowerCase(),hash,role]);
    await query('UPDATE onboarding_progress SET step_invite_user=true WHERE org_id=$1',[req.org.id]);
    res.status(201).json(u);
  }catch(err){next(err);}
});
router.patch('/:id',requireAdmin,async(req,res,next)=>{
  try{
    if(req.params.id===req.user.id&&req.body.role) return res.status(400).json({error:'No puede cambiar su propio rol'});
    const al=['name','role','is_active','avatar_url'];
    const f=[],v=[];let i=1;
    for(const k of al)if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    if(req.body.password){f.push(`password_hash=$${i++}`);v.push(await bcrypt.hash(req.body.password,12));}
    v.push(req.params.id,req.org.id);
    const{rows}=await query(`UPDATE users SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} AND org_id=$${i+1} RETURNING id,name,email,role,is_active`,v);
    if(!rows.length) return res.status(404).json({error:'Usuario no encontrado'});
    res.json(rows[0]);
  }catch(err){next(err);}
});
router.delete('/:id',requireAdmin,async(req,res,next)=>{
  try{
    if(req.params.id===req.user.id) return res.status(400).json({error:'No puede eliminarse a sí mismo'});
    await query('UPDATE users SET is_active=false WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    await query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1',[req.params.id]);
    res.json({deactivated:true});
  }catch(err){next(err);}
});
router.get('/audit-log',requireAdmin,async(req,res,next)=>{
  try{
    const{page=1,action,user_id}=req.query;const lim=50,off=(parseInt(page)-1)*lim;
    const c=['org_id=$1'],v=[req.org.id];let i=2;
    if(action){c.push(`action=$${i++}`);v.push(action);}
    if(user_id){c.push(`user_id=$${i++}`);v.push(user_id);}
    const{rows}=await query(`SELECT al.*,u.name as user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id WHERE ${c.join(' AND ')} ORDER BY al.created_at DESC LIMIT ${lim} OFFSET ${off}`,v);
    res.json(rows);
  }catch(err){next(err);}
});
module.exports=router;
