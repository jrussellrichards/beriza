'use strict';
const router=require('express').Router();
const bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto');
const{v4:uuid}=require('uuid');
const{body,validationResult}=require('express-validator');
const{query,withTransaction}=require('../db/pool');
const authMw=require('../middleware/auth');

const SECRET=process.env.JWT_SECRET,ROUNDS=parseInt(process.env.BCRYPT_ROUNDS||'12');
const SIGN={algorithm:'HS256',issuer:'berisa',audience:'berisa-client'};

if (!process.env.JWT_REFRESH_SECRET) {
  console.warn('[Auth] WARNING: JWT_REFRESH_SECRET not set — falling back to JWT_SECRET. Set JWT_REFRESH_SECRET for production security.');
}
const makeAccess=u=>jwt.sign({sub:u.id,role:u.role,org:u.orgId},SECRET,{...SIGN,expiresIn:process.env.JWT_EXPIRES_IN||'8h'});
const makeRefresh=id=>jwt.sign({sub:id,type:'refresh'},process.env.JWT_REFRESH_SECRET||SECRET,{...SIGN,expiresIn:'30d'});
const valid=checks=>[...checks,(req,res,next)=>{const e=validationResult(req);if(!e.isEmpty())return res.status(400).json({error:'Datos inválidos',fields:e.array()});next();}];

async function saveRT(userId,token,req){
  const h=crypto.createHash('sha256').update(token).digest('hex');
  const exp=new Date(Date.now()+30*864e5);
  await query('INSERT INTO refresh_tokens(user_id,token_hash,ip_address,user_agent,expires_at)VALUES($1,$2,$3,$4,$5)',
    [userId,h,req.ip,(req.headers['user-agent']||'').slice(0,200),exp]);
}

router.post('/register',valid([
  body('orgName').trim().isLength({min:2,max:200}),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({min:8}).matches(/[A-Z]/).matches(/[0-9]/),
  body('name').trim().isLength({min:2,max:200}),
]),async(req,res,next)=>{
  try{
    const{orgName,email,password,name}=req.body;
    if((await query('SELECT id FROM users WHERE email=$1',[email])).rows.length)
      return res.status(409).json({error:'Email ya registrado',code:'EMAIL_EXISTS'});
    const hash=await bcrypt.hash(password,ROUNDS);
    const trialEnd=new Date(Date.now()+14*864e5);
    const slug=orgName.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60)+'-'+uuid().slice(0,6);
    const result=await withTransaction(async c=>{
      const o=await c.query('INSERT INTO organizations(name,slug,plan,plan_status,trial_ends_at)VALUES($1,$2,'starter','trial',$3)RETURNING id',[orgName,slug,trialEnd]);
      const u=await c.query('INSERT INTO users(org_id,email,password_hash,name,role)VALUES($1,$2,$3,$4,'admin')RETURNING id,name,email,role',[o.rows[0].id,email,hash,name]);
      await c.query('INSERT INTO onboarding_progress(org_id)VALUES($1)',[o.rows[0].id]);
      return{orgId:o.rows[0].id,user:u.rows[0]};
    });
    const u={id:result.user.id,orgId:result.orgId,role:'admin'};
    const at=makeAccess(u),rt=makeRefresh(u.id);
    await saveRT(u.id,rt,req);
    res.status(201).json({accessToken:at,refreshToken:rt,user:{id:u.id,name:result.user.name,email,role:'admin'},org:{id:result.orgId,plan:'starter',planStatus:'trial',trialEndsAt:trialEnd}});
  }catch(err){next(err);}
});

router.post('/login',valid([body('email').isEmail().normalizeEmail(),body('password').notEmpty()]),async(req,res,next)=>{
  try{
    const{email,password}=req.body;
    const{rows}=await query('SELECT u.*,o.plan,o.plan_status,o.trial_ends_at FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.email=$1',[email]);
    if(!rows.length){await bcrypt.hash('dummy',ROUNDS);return res.status(401).json({error:'Credenciales incorrectas'});}
    const u=rows[0];
    if(u.locked_until&&new Date()<new Date(u.locked_until)){
      const min=Math.ceil((new Date(u.locked_until)-Date.now())/60000);
      return res.status(423).json({error:`Cuenta bloqueada por ${min} minutos`,code:'ACCOUNT_LOCKED'});
    }
    if(!u.is_active) return res.status(403).json({error:'Cuenta desactivada'});
    if(!await bcrypt.compare(password,u.password_hash)){
      const att=(u.failed_attempts||0)+1;
      await query('UPDATE users SET failed_attempts=$1,locked_until=$2 WHERE id=$3',[att,att>=5?new Date(Date.now()+15*60000):null,u.id]);
      return res.status(401).json({error:`Credenciales incorrectas. ${Math.max(0,5-att)} intento(s) restante(s).`});
    }
    await query('UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=NOW(),last_login_ip=$1,login_count=login_count+1 WHERE id=$2',[req.ip,u.id]);
    const payload={id:u.id,orgId:u.org_id,role:u.role};
    const at=makeAccess(payload),rt=makeRefresh(u.id);
    await saveRT(u.id,rt,req);
    res.json({accessToken:at,refreshToken:rt,user:{id:u.id,name:u.name,email:u.email,role:u.role,avatarUrl:u.avatar_url},org:{id:u.org_id,plan:u.plan,planStatus:u.plan_status,trialEndsAt:u.trial_ends_at}});
  }catch(err){next(err);}
});

router.post('/refresh',async(req,res,next)=>{
  try{
    const{refreshToken}=req.body;
    if(!refreshToken) return res.status(400).json({error:'Refresh token requerido'});
    let p;try{p=jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET||SECRET,SIGN);}catch{return res.status(401).json({error:'Token inválido'});}
    const h=crypto.createHash('sha256').update(refreshToken).digest('hex');
    const{rows}=await query('SELECT * FROM refresh_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>NOW()',[h]);
    if(!rows.length) return res.status(401).json({error:'Token revocado o expirado'});
    const{rows:ur}=await query('SELECT id,org_id,role FROM users WHERE id=$1 AND is_active=true',[p.sub]);
    if(!ur.length) return res.status(401).json({error:'Usuario inactivo'});
    const at=makeAccess({id:ur[0].id,orgId:ur[0].org_id,role:ur[0].role});
    const nr=makeRefresh(ur[0].id);
    await query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=$1',[rows[0].id]);
    await saveRT(ur[0].id,nr,req);
    res.json({accessToken:at,refreshToken:nr});
  }catch(err){next(err);}
});

router.post('/logout',authMw,async(req,res,next)=>{
  try{
    const{refreshToken}=req.body;
    if(refreshToken){const h=crypto.createHash('sha256').update(refreshToken).digest('hex');await query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1',[h]);}
    if(req.query.all==='true') await query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',[req.user.id]);
    res.json({message:'Sesión cerrada'});
  }catch(err){next(err);}
});

router.get('/me',authMw,async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT u.id,u.name,u.email,u.role,u.avatar_url,u.totp_enabled,u.last_login_at,o.id as org_id,o.name as org_name,o.slug,o.plan,o.plan_status,o.trial_ends_at,o.settings FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.id=$1',[req.user.id]);
    if(!rows.length) return res.status(404).json({error:'Usuario no encontrado'});
    const r=rows[0];
    res.json({user:{id:r.id,name:r.name,email:r.email,role:r.role,avatarUrl:r.avatar_url,totpEnabled:r.totp_enabled,lastLoginAt:r.last_login_at},org:{id:r.org_id,name:r.org_name,slug:r.slug,plan:r.plan,planStatus:r.plan_status,trialEndsAt:r.trial_ends_at,settings:r.settings}});
  }catch(err){next(err);}
});

router.post('/forgot-password',valid([body('email').isEmail().normalizeEmail()]),async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT id,name FROM users WHERE email=$1 AND is_active=true',[req.body.email]);
    if(rows.length){
      const token=crypto.randomBytes(32).toString('hex');
      const exp=new Date(Date.now()+3600000);
      await query('UPDATE users SET settings=settings||$1 WHERE id=$2',[JSON.stringify({resetToken:token,resetExpiry:exp}),rows[0].id]);
    }
    res.json({message:'Si el email existe, recibirá instrucciones de recuperación'});
  }catch(err){next(err);}
});

router.post('/reset-password',valid([body('token').notEmpty(),body('password').isLength({min:8}).matches(/[A-Z]/).matches(/[0-9]/)]),async(req,res,next)=>{
  try{
    const{token,password}=req.body;
    const{rows}=await query("SELECT id FROM users WHERE settings->>'resetToken'=$1 AND (settings->>'resetExpiry')::timestamptz>NOW()",[token]);
    if(!rows.length) return res.status(400).json({error:'Token inválido o expirado'});
    await query("UPDATE users SET password_hash=$1,failed_attempts=0,locked_until=NULL,settings=settings-'resetToken'-'resetExpiry',password_changed_at=NOW() WHERE id=$2",[await bcrypt.hash(password,ROUNDS),rows[0].id]);
    await query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1',[rows[0].id]);
    res.json({message:'Contraseña actualizada correctamente'});
  }catch(err){next(err);}
});

module.exports=router;
