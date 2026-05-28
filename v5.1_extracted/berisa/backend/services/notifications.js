'use strict';
const nodemailer=require('nodemailer');
const axios=require('axios');
const FROM=`"${process.env.EMAIL_FROM_NAME||'BERISA'}" <${process.env.EMAIL_FROM||'noreply@berisa.com'}>`;
function transport(){
  if(process.env.EMAIL_PROVIDER==='sendgrid') return nodemailer.createTransport({host:'smtp.sendgrid.net',port:587,secure:false,auth:{user:'apikey',pass:process.env.SENDGRID_API_KEY}});
  return nodemailer.createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||'587'),secure:false,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
}
async function sendMail(to,subject,html){
  if(process.env.NODE_ENV==='test') return{messageId:'test'};
  return transport().sendMail({from:FROM,to,subject,html});
}
async function sendAlertEmail(to,name,alert){
  const html=`<div style="font-family:Arial;max-width:600px;background:#0A1B34;color:#F6F7F9;padding:28px;border-radius:8px"><h2 style="color:#C9972B">🔔 BERISA — Nueva alerta</h2><p>Hola ${name},</p><div style="background:#152B50;border-left:3px solid #C9972B;padding:14px;margin:14px 0;border-radius:4px"><b>${alert.projectName}</b><br>Sector: ${alert.sector} | Región: ${alert.region}${alert.capex?` | USD ${alert.capex}M`:''}</div><a href="${process.env.FRONTEND_URL}/dashboard.html" style="background:#C9972B;color:#0A1B34;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:700">Ver proyecto →</a></div>`;
  return sendMail(to,`🔔 BERISA: ${alert.projectName}`,html);
}
async function sendVerificationEmail(to,name){
  const html=`<div style="font-family:Arial;max-width:600px"><h2>Verificar cuenta BERISA</h2><p>Hola ${name}, haz clic para verificar tu email.</p></div>`;
  return sendMail(to,'Verificar cuenta BERISA',html);
}
async function sendPasswordReset(to,name,token){
  const url=`${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const html=`<div style="font-family:Arial;max-width:600px"><h2>Recuperar contraseña BERISA</h2><p>Hola ${name},</p><a href="${url}" style="background:#C9972B;color:#0A1B34;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:700;display:inline-block;margin:14px 0">Cambiar contraseña</a><p style="color:#666;font-size:12px">Expira en 1 hora.</p></div>`;
  return sendMail(to,'Recuperar contraseña BERISA',html);
}
async function sendWebhook(url,secret,payload){
  const body=JSON.stringify(payload);
  const sig=require('crypto').createHmac('sha256',secret).update(body).digest('hex');
  return axios.post(url,payload,{headers:{'X-Berisa-Signature':`sha256=${sig}`,'X-Berisa-Event':payload.type},timeout:10000});
}
async function sendSlack(webhookUrl,alert){
  return axios.post(webhookUrl,{text:`🔔 *BERISA*: ${alert.projectName} | ${alert.sector} | ${alert.region}${alert.capex?` | USD ${alert.capex}M`:''}`,timeout:8000});
}
module.exports={sendMail,sendAlertEmail,sendVerificationEmail,sendPasswordReset,sendWebhook,sendSlack};
