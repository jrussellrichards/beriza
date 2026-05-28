'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
router.post('/',async(req,res)=>{
  if(!process.env.STRIPE_SECRET_KEY){return res.json({received:true});}
  let event;
  try{const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}
  catch(e){return res.status(400).send(`Webhook Error: ${e.message}`);}
  const d=event.data.object;
  try{
    if(event.type==='checkout.session.completed'&&d.metadata?.orgId)
      await query("UPDATE organizations SET plan=$1,plan_status='active',stripe_sub_id=$2,trial_ends_at=NULL WHERE id=$3",[d.metadata.plan||'starter',d.subscription,d.metadata.orgId]);
    if(event.type==='customer.subscription.deleted'){
      const{rows}=await query('SELECT id FROM organizations WHERE stripe_sub_id=$1',[d.id]);
      if(rows.length) await query("UPDATE organizations SET plan='starter',plan_status='cancelled' WHERE id=$1",[rows[0].id]);
    }
    if(event.type==='invoice.paid'){
      const{rows}=await query('SELECT id FROM organizations WHERE stripe_customer_id=$1',[d.customer]);
      if(rows.length) await query("INSERT INTO invoices(org_id,stripe_invoice_id,amount_usd,status,pdf_url,paid_at)VALUES($1,$2,$3,'paid',$4,NOW())ON CONFLICT(stripe_invoice_id) DO UPDATE SET status='paid',paid_at=NOW()",[rows[0].id,d.id,(d.amount_paid||0)/100,d.invoice_pdf||null]);
    }
    res.json({received:true});
  }catch(e){console.error('[Stripe]',e.message);res.status(500).json({error:e.message});}
});
module.exports=router;
