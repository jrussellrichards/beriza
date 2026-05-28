'use strict';
require('dotenv').config();
const express=require('express'),helmet=require('helmet'),cors=require('cors'),
  compression=require('compression');
const{notFound,errorHandler}=require('./middleware/errors');
const rateLimits=require('./middleware/rateLimit');
const authMw=require('./middleware/auth');
const tenantMw=require('./middleware/tenant');
const auditMw=require('./middleware/audit');

const app=express();
app.use(helmet({contentSecurityPolicy:false}));
const origins=(process.env.CORS_ALLOWED_ORIGINS||process.env.CORS_ORIGIN||'').split(',').map(s=>s.trim());
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  const host=req.headers.host;
  const getHost=s=>s?s.replace(/^https?:\/\//,'').split(':')[0]:'';
  const isSameOrigin=origin&&host&&getHost(origin)===getHost(host);
  if(!origin||isSameOrigin||origins.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin||'*');
    res.setHeader('Access-Control-Allow-Credentials','true');
    res.setHeader('Access-Control-Allow-Methods','GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers']||'Content-Type,Authorization,X-Berisa-Tenant-ID');
    if(req.method==='OPTIONS') return res.sendStatus(204);
    next();
  }else{
    console.warn(`[CORS] Blocked origin: ${origin} (Host: ${host})`);
    res.status(403).json({error:'CORS Origin Not Allowed'});
  }
});
app.use('/api/v1/billing/webhook',express.raw({type:'application/json'}),require('./routes/billing-webhook'));
app.use(express.json({limit:'2mb'}));
app.use(compression());
app.use((req,_res,next)=>{req.requestId=require('uuid').v4();next();});

// Rate limits
app.use('/api/',rateLimits.global);
app.use('/api/v1/auth/',rateLimits.auth);

// Health
app.get('/health',async(_req,res)=>{
  try{const{pool}=require('./db/pool');await pool.query('SELECT 1');res.json({status:'ok',version:'2.0.0',ts:new Date().toISOString()});}
  catch{res.status(503).json({status:'unhealthy',db:'down'});}
});

// Public auth
app.use('/api/v1/auth',require('./routes/auth'));

// Public API (API key auth)
app.use('/api/v1/public',rateLimits.apiKey,require('./middleware/apiKeyAuth'),auditMw,require('./routes/public-api'));

// Protected routes
const r=express.Router();
r.use(authMw);
r.use(tenantMw);
r.use(auditMw);
const tier=require('./middleware/tier');
r.use('/projects',    tier(['starter','profesional','business','enterprise']), require('./routes/projects'));
r.use('/alerts',      require('./routes/alerts'));
r.use('/crm',         tier(['profesional','business','enterprise']),           require('./routes/crm'));
r.use('/suppliers',   require('./routes/suppliers'));
r.use('/rfq',         tier(['profesional','business','enterprise']),           require('./routes/rfq'));
r.use('/reports',     tier(['profesional','business','enterprise']),           require('./routes/reports'));
r.use('/api-keys',    tier(['business','enterprise']),                         require('./routes/api-keys'));
r.use('/users',       require('./routes/users'));
r.use('/organizations',require('./routes/organizations'));
r.use('/billing',     require('./routes/billing'));
r.use('/onboarding',  require('./routes/onboarding'));
r.use('/analytics',   require('./routes/analytics'));
r.use('/hse/incidents',   require('./routes/hse/incidents'));
r.use('/hse/prevention',  require('./routes/hse/prevention'));
r.use('/hse/accreditation',require('./routes/hse/accreditation'));
r.use('/hse/work-permits',require('./routes/hse/work_permits'));
r.use('/hse/hygiene',     require('./routes/hse/hygiene'));
r.use('/environmental',   require('./routes/environmental'));

r.use('/privacy',     require('./routes/privacy'));
r.use('/admin',       require('./routes/admin'));
r.use('/roi',         require('./routes/roi'));
r.use('/capabilities',require('./routes/capabilities'));
r.use('/demand',      require('./middleware/tier')(['profesional','business','enterprise']), require('./routes/demand'));
r.use('/commercial',  require('./routes/commercial'));
r.use('/procurement/full', require('./middleware/tier')(['profesional','business','enterprise']), require('./routes/procurement_full'));
r.use('/integrations',require('./middleware/tier')(['business','enterprise']), require('./routes/integrations'));
app.use('/api/v1',r);

app.use(notFound);
app.use(errorHandler);

// Swagger docs
try{
  const swaggerJsdoc=require('swagger-jsdoc'),swaggerUi=require('swagger-ui-express');
  const spec=swaggerJsdoc({definition:{openapi:'3.0.0',info:{title:'BERISA API',version:'2.0.0'},servers:[{url:'/api/v1'}],components:{securitySchemes:{BearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'},ApiKey:{type:'apiKey',in:'header',name:'X-API-Key'}}}},apis:['./routes/*.js']});
  app.use('/api/docs',swaggerUi.serve,swaggerUi.setup(spec));
  app.get('/api/openapi.json',(_,res)=>res.json(spec));
}catch{}

// Start
const PORT=process.env.PORT||4000;
const server=require('http').createServer(app);
server.listen(PORT,()=>console.log(`BERISA Backend v2.0 on :${PORT} [${process.env.NODE_ENV}] — docs: http://localhost:${PORT}/api/docs`));
const shutdown=async sig=>{console.log(sig);server.close(async()=>{await require('./db/pool').pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000);};
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
try{require('./jobs/scheduler');}catch(e){console.warn('[Scheduler] Not loaded:',e.message);}
module.exports={app,server};
