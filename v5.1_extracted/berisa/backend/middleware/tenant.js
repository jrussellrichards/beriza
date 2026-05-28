'use strict';
const{query}=require('../db/pool');
module.exports=async function(req,res,next){
  try{
    const{rows}=await query('SELECT id,name,slug,plan,plan_status,settings,max_users,trial_ends_at FROM organizations WHERE id=$1',[req.user.orgId]);
    if(!rows.length) return res.status(404).json({error:'Organización no encontrada'});
    const o=rows[0];
    if(o.plan_status==='trial'&&o.trial_ends_at&&new Date()>new Date(o.trial_ends_at))
      return res.status(402).json({error:'Período de prueba expirado',code:'TRIAL_EXPIRED',planUrl:'/pricing.html'});
    if(o.plan_status==='cancelled') return res.status(402).json({error:'Suscripción cancelada',code:'SUBSCRIPTION_CANCELLED'});
    req.org=o;next();
  }catch(err){next(err);}
};
