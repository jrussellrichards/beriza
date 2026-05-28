'use strict';
const rl=require('express-rate-limit');
const make=(max,win,msg)=>rl({windowMs:win,max,standardHeaders:true,legacyHeaders:false,message:{error:msg,code:'RATE_LIMIT_EXCEEDED'}});
module.exports={
  global:make(parseInt(process.env.RATE_LIMIT_MAX||'100'),900000,'Demasiadas solicitudes'),
  auth:  make(parseInt(process.env.AUTH_RATE_LIMIT_MAX||'5'),900000,'Demasiados intentos de autenticación'),
  apiKey:make(parseInt(process.env.API_RATE_LIMIT_MAX||'1000'),86400000,'Límite diario de API alcanzado'),
};
