'use strict';
const{query}=require('../db/pool');
module.exports=function(req,res,next){
  const start=Date.now();const orig=res.json.bind(res);
  res.json=function(body){
    const dur=Date.now()-start;
    setImmediate(async()=>{try{
      const act=req.method==='GET'?'api_call':req.method==='POST'?'create':req.method==='DELETE'?'delete':'update';
      await query('INSERT INTO audit_logs(org_id,user_id,action,request_path,request_method,status_code,duration_ms,ip_address)VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.org?.id||null,req.user?.id||null,act,req.path,req.method,res.statusCode,dur,req.ip]);
    }catch{}});
    return orig(body);
  };
  next();
};
