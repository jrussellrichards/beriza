'use strict';
const router=require('express').Router();
const bcrypt=require('bcryptjs'),crypto=require('crypto');
const{query}=require('../db/pool');
const{requireAdmin}=require('../middleware/auth');
router.get('/',async(req,res,next)=>{try{const{rows}=await query('SELECT id,name,key_prefix,permissions,rate_limit,calls_today,calls_total,last_used_at,expires_at,is_active,created_at FROM api_keys WHERE org_id=$1 ORDER BY created_at DESC',[req.org.id]);res.json(rows);}catch(err){next(err);}});
router.post('/',requireAdmin,async(req,res,next)=>{
  try{
    const{name,permissions=['read'],rate_limit=1000,expires_at}=req.body;
    if(!name) return res.status(400).json({error:'Nombre requerido'});
    const{rows:[cnt]}=await query('SELECT COUNT(*) FROM api_keys WHERE org_id=$1 AND is_active=true',[req.org.id]);
    if(parseInt(cnt.count)>=10) return res.status(400).json({error:'Máximo 10 API keys activas'});
    const raw='brs_'+crypto.randomBytes(28).toString('hex');
    const prefix=raw.slice(0,8);
    const hash=await bcrypt.hash(raw,10);
    const{rows:[k]}=await query('INSERT INTO api_keys(org_id,user_id,name,key_prefix,key_hash,permissions,rate_limit,expires_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id,name,key_prefix,permissions,rate_limit,created_at',
      [req.org.id,req.user.id,name,prefix,hash,JSON.stringify(permissions),rate_limit,expires_at||null]);
    await query('UPDATE onboarding_progress SET step_api_key=true WHERE org_id=$1',[req.org.id]);
    res.status(201).json({...k,apiKey:raw,warning:'Guarde esta clave ahora. No se mostrará nuevamente.'});
  }catch(err){next(err);}
});
router.delete('/:id',requireAdmin,async(req,res,next)=>{try{await query('UPDATE api_keys SET is_active=false WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);res.json({revoked:true});}catch(err){next(err);}});
module.exports=router;
