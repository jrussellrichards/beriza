'use strict';
try{const cron=require('node-cron');
  if(process.env.SCRAPER_ENABLED!=='true'){console.log('[Scheduler] Scraper disabled');module.exports={};return;}
  const{query}=require('../db/pool');
  const run=async src=>{try{const r=await require('../services/scraper').runScraper(src);console.log(`[Sched] ${src}:`,r);}catch(e){console.error(`[Sched] ${src}:`,e.message);}};
  cron.schedule(process.env.SCRAPER_CRON_SEIA||'0 6 * * *',()=>run('seia'),{timezone:'America/Santiago'});
  cron.schedule(process.env.SCRAPER_CRON_MOP||'0 7 * * *',()=>run('mop'),{timezone:'America/Santiago'});
  cron.schedule(process.env.SCRAPER_CRON_CBC||'0 8 * * *',()=>run('cbc'),{timezone:'America/Santiago'});
  cron.schedule('0 9 * * *',async()=>{try{await require('../services/scoring').batchScoreProjects(query);}catch(e){console.error('[Sched] scoring:',e.message);}},{timezone:'America/Santiago'});
  cron.schedule('0 10 * * *',async()=>{try{await query("UPDATE supplier_documents SET status='expiring' WHERE status='valid' AND expires_at<NOW()+INTERVAL'30 days' AND expires_at>NOW()");await query("UPDATE supplier_documents SET status='expired' WHERE status IN('valid','expiring') AND expires_at<NOW()");;}catch(e){console.error('[Sched] expiry:',e.message);}},{timezone:'America/Santiago'});
  cron.schedule('0 0 * * *',async()=>{try{await query('UPDATE api_keys SET calls_today=0');}catch{}},{timezone:'UTC'});
  console.log('[Scheduler] All jobs registered');
}catch(e){console.warn('[Scheduler] Failed to load:',e.message);}
module.exports={};
