'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireAdmin}=require('../middleware/auth');
const PRICES={starter_monthly:process.env.STRIPE_PRICE_STARTER,profesional_monthly:process.env.STRIPE_PRICE_PROFESIONAL,business_monthly:process.env.STRIPE_PRICE_BUSINESS,enterprise_monthly:process.env.STRIPE_PRICE_ENTERPRISE};

router.get('/status',async(req,res,next)=>{
  try{
    const{rows:[o]}=await query('SELECT plan,plan_status,trial_ends_at,stripe_customer_id,stripe_sub_id FROM organizations WHERE id=$1',[req.org.id]);
    const{rows:inv}=await query('SELECT * FROM invoices WHERE org_id=$1 ORDER BY created_at DESC LIMIT 5',[req.org.id]);
    const{rows:[u]}=await query('SELECT COUNT(DISTINCT u.id) as users,COUNT(DISTINCT o.id) as opps FROM organizations org LEFT JOIN users u ON u.org_id=org.id AND u.is_active=true LEFT JOIN opportunities o ON o.org_id=org.id WHERE org.id=$1',[req.org.id]);
    res.json({...o,usage:u,recentInvoices:inv});
  }catch(err){next(err);}
});

router.post('/checkout',requireAdmin,async(req,res,next)=>{
  try{
    if(!process.env.STRIPE_SECRET_KEY) return res.status(503).json({error:'Stripe no configurado'});
    const{plan,interval='monthly'}=req.body;
    const priceId=PRICES[`${plan}_${interval}`];
    if(!priceId) return res.status(400).json({error:`Plan inválido: ${plan}`});
    const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);
    const{rows:[o]}=await query('SELECT * FROM organizations WHERE id=$1',[req.org.id]);
    let cId=o.stripe_customer_id;
    if(!cId){const c=await stripe.customers.create({email:req.user.email,name:o.name,metadata:{orgId:o.id}});cId=c.id;await query('UPDATE organizations SET stripe_customer_id=$1 WHERE id=$2',[cId,o.id]);}
    const session=await stripe.checkout.sessions.create({customer:cId,mode:'subscription',payment_method_types:['card'],line_items:[{price:priceId,quantity:1}],success_url:`${process.env.FRONTEND_URL}/pricing.html?success=1`,cancel_url:`${process.env.FRONTEND_URL}/pricing.html`,metadata:{orgId:o.id,plan}});
    res.json({checkoutUrl:session.url,sessionId:session.id});
  }catch(err){next(err);}
});

router.post('/portal',requireAdmin,async(req,res,next)=>{
  try{
    if(!process.env.STRIPE_SECRET_KEY) return res.status(503).json({error:'Stripe no configurado'});
    const{rows:[o]}=await query('SELECT stripe_customer_id FROM organizations WHERE id=$1',[req.org.id]);
    if(!o?.stripe_customer_id) return res.status(400).json({error:'Sin suscripción activa'});
    const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);
    const s=await stripe.billingPortal.sessions.create({customer:o.stripe_customer_id,return_url:`${process.env.FRONTEND_URL}/pricing.html`});
    res.json({portalUrl:s.url});
  }catch(err){next(err);}
});

router.get('/invoices',async(req,res,next)=>{try{const{rows}=await query('SELECT * FROM invoices WHERE org_id=$1 ORDER BY created_at DESC LIMIT 24',[req.org.id]);res.json(rows);}catch(err){next(err);}});
module.exports=router;
