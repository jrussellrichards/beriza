'use strict';
const jwt=require('jsonwebtoken');
const {query}=require('../db/pool');
async function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    if(!h.startsWith('Bearer ')) return res.status(401).json({error:'Autenticación requerida',code:'AUTH_REQUIRED'});
    let p;
    try{p=jwt.verify(h.slice(7),process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'berisa',audience:'berisa-client'});}
    catch(e){return res.status(401).json({error:'Sesión inválida',code:e.name==='TokenExpiredError'?'TOKEN_EXPIRED':'TOKEN_INVALID'});}
    const{rows}=await query('SELECT id,org_id,email,name,role,is_active FROM users WHERE id=$1',[p.sub]);
    if(!rows.length||!rows[0].is_active) return res.status(401).json({error:'Usuario inactivo',code:'USER_INACTIVE'});
    req.user={id:rows[0].id,orgId:rows[0].org_id,email:rows[0].email,name:rows[0].name,role:rows[0].role};
    next();
  }catch(err){next(err);}
}
function requireRole(...roles){return(req,res,next)=>{if(!req.user)return res.status(401).json({error:'No autenticado'});if(!roles.includes(req.user.role))return res.status(403).json({error:'Permisos insuficientes',required:roles});next();};}
module.exports=auth;
module.exports.requireAdmin=requireRole('admin');
module.exports.requireManager=requireRole('admin','manager');
module.exports.requireAnalyst=requireRole('admin','manager','analyst');
module.exports.requireRole=requireRole;
