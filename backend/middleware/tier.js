'use strict';
const R={starter:1,profesional:2,business:3,enterprise:4};
module.exports=tiers=>(req,res,next)=>{
  if(!req.org) return res.status(401).json({error:'Sin contexto org'});
  if((R[req.org.plan]||0)<Math.min(...tiers.map(t=>R[t]||99)))
    return res.status(403).json({error:`Requiere plan ${tiers[0]}+`,code:'PLAN_UPGRADE_REQUIRED',currentPlan:req.org.plan,upgradeUrl:'/pricing.html'});
  next();
};
