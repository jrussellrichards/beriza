'use strict';
const bcrypt=require('bcryptjs');
const{query}=require('../db/pool');
module.exports=async function(req,res,next){
  const k=req.headers['x-api-key'];
  if(!k||!k.startsWith('brs_')) return res.status(401).json({error:'API key requerida (header X-API-Key)',code:'APIKEY_REQUIRED'});
  const{rows}=await query('SELECT ak.*,o.plan,o.plan_status FROM api_keys ak JOIN organizations o ON o.id=ak.org_id WHERE ak.key_prefix=$1 AND ak.is_active=true',[k.slice(0,8)]);
  if(!rows.length||!await bcrypt.compare(k,rows[0].key_hash)) return res.status(401).json({error:'API key inválida',code:'APIKEY_INVALID'});
  if(rows[0].calls_today>=rows[0].rate_limit) return res.status(429).json({error:'Límite diario alcanzado',code:'API_RATE_LIMIT'});
  query('UPDATE api_keys SET calls_today=calls_today+1,calls_total=calls_total+1,last_used_at=NOW() WHERE id=$1',[rows[0].id]);
  req.user={id:null,orgId:rows[0].org_id,role:'analyst'};
  req.org={id:rows[0].org_id,plan:rows[0].plan,plan_status:rows[0].plan_status};
  req.apiKey={id:rows[0].id,permissions:rows[0].permissions};
  next();
};
