'use strict';
module.exports.notFound=(req,res)=>res.status(404).json({error:`Ruta no encontrada: ${req.method} ${req.path}`,code:'NOT_FOUND'});
module.exports.errorHandler=(err,req,res,_n)=>{
  const s=err.status||err.statusCode||500;
  if(s>=500)console.error(err);
  res.status(s).json({error:err.message||'Error interno',code:err.code||'INTERNAL_ERROR',...(process.env.NODE_ENV!=='production'?{stack:err.stack}:{})});
};
