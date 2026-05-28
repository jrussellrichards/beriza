'use strict';
const axios=require('axios'),cheerio=require('cheerio');
const{query,withTransaction}=require('../db/pool');
const{scoreProject,computeOppWindow}=require('./scoring');
const geocoder=require('./geocoder');

async function runScraper(source){
  const{rows:[job]}=await query("INSERT INTO scraper_jobs(source,status,started_at)VALUES($1,'running',NOW())RETURNING id",[source]);
  const stats={found:0,new:0,updated:0,errors:[]};
  try{
    const fn={seia:scrapeSEIA,mop:scrapeMOP,cbc:scrapeCBC,mercado_publico:scrapeMercadoPublico}[source];
    if(!fn)throw new Error('Unknown source: '+source);
    const raw=await fn();stats.found=raw.length;
    for(const p of raw){try{await upsertProject(source,p,stats);}catch(e){stats.errors.push({error:e.message});}}
    await query("UPDATE scraper_jobs SET status='completed',completed_at=NOW(),projects_found=$1,projects_new=$2,projects_updated=$3,errors=$4,duration_secs=EXTRACT(EPOCH FROM NOW()-started_at) WHERE id=$5",
      [stats.found,stats.new,stats.updated,JSON.stringify(stats.errors),job.id]);
  }catch(e){
    await query("UPDATE scraper_jobs SET status='failed',completed_at=NOW(),errors=$1 WHERE id=$2",[JSON.stringify([{fatal:e.message}]),job.id]);
    throw e;
  }
  return stats;
}

async function scrapeSEIA(){
  const projects=[];
  try{
    const r=await axios.get(`${process.env.SEIA_BASE_URL||'https://www.sea.gob.cl'}/sea/servicios/expedientesEia.php`,{params:{tipo:'eia',estado:'en_evaluacion,aprobado',pagina:1,por_pagina:50},timeout:30000,headers:{'User-Agent':'BerISA/2.0'}});
    const $=cheerio.load(r.data);
    $('table.expedientes tr:not(:first-child)').each((_,row)=>{
      const c=$(row).find('td');if(c.length<5)return;
      projects.push({name:$(c[1]).text().trim(),owner_name:$(c[2]).text().trim(),region:$(c[3]).text().trim(),status:$(c[4]).text().trim(),country:'CL',sector:inferSector($(c[1]).text())});
    });
  }catch(e){console.error('[SEIA]',e.message);}
  return projects;
}
async function scrapeMOP(){return [];}  // implement similarly
async function scrapeCBC(){return [];}
async function scrapeMercadoPublico(){
  const projects=[];
  try{
    const r=await axios.get('https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json',{params:{fecha:new Date().toISOString().split('T')[0],pagina:1,ticket:process.env.MERCADO_PUBLICO_TICKET||''},timeout:20000});
    for(const it of r.data?.Listado||[]){
      if(!it.Nombre)continue;
      projects.push({sourceId:it.CodigoExterno,name:it.Nombre,owner_name:it.Comprador?.NombreOrganismo||'',sector:inferSector(it.Nombre),country:'CL',region:it.Comprador?.Region||'',capex_usd_m:parseFloat((Number(it.MontoEstimado||0)/800000000).toFixed(1))||null,status:'en_licitacion'});
    }
  }catch(e){console.error('[MP]',e.message);}
  return projects;
}

async function upsertProject(source,raw,stats){
  const n={source_id:raw.sourceId?String(raw.sourceId):null,name:(raw.name||'').trim().slice(0,500),sector:normSector(raw.sector||''),status:raw.status||'prefactibilidad',country:raw.country||'CL',region:normRegion(raw.region||''),capex_usd_m:raw.capex_usd_m||null,start_date:parseDate(raw.start_date),owner_name:(raw.owner_name||'').trim().slice(0,300),lat:raw.lat?parseFloat(raw.lat):null,lon:raw.lon?parseFloat(raw.lon):null};
  if(!n.lat||!n.lon){const g=await geocoder.geocode(`${n.name}, ${n.region}, Chile`);if(g){n.lat=g.lat;n.lon=g.lon;}await new Promise(r=>setTimeout(r,200));}
  const opp=computeOppWindow(n);n.opp_window=opp.window;n.opp_label=opp.label;
  let ex=null;
  if(n.source_id){const{rows}=await query('SELECT id,score FROM projects WHERE source=$1 AND source_id=$2',[source,n.source_id]);ex=rows[0]||null;}
  if(ex){
    await query('UPDATE projects SET name=$1,status=$2,capex_usd_m=$3,region=$4,opp_window=$5,opp_label=$6,scraped_at=NOW(),lat=COALESCE($7,lat),lon=COALESCE($8,lon),updated_at=NOW() WHERE id=$9',
      [n.name,n.status,n.capex_usd_m,n.region,n.opp_window,n.opp_label,n.lat,n.lon,ex.id]);
    const sc=scoreProject({...ex,...n});await query('UPDATE projects SET score=$1,score_breakdown=$2 WHERE id=$3',[sc.score,JSON.stringify(sc.breakdown),ex.id]);
    stats.updated++;
  }else{
    const{rows:[ins]}=await query('INSERT INTO projects(source,source_id,name,sector,status,country,region,capex_usd_m,start_date,owner_name,opp_window,opp_label,lat,lon,scraped_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())RETURNING id',
      [source,n.source_id,n.name,n.sector,n.status,n.country,n.region,n.capex_usd_m,n.start_date,n.owner_name,n.opp_window,n.opp_label,n.lat,n.lon]);
    const sc=scoreProject({...n,id:ins.id});await query('UPDATE projects SET score=$1,score_breakdown=$2 WHERE id=$3',[sc.score,JSON.stringify(sc.breakdown),ins.id]);
    stats.new++;
  }
}

const SM={'energia':'Energía','solar':'Energía','eólico':'Energía','gnl':'Energía','hidro':'Energía','mineria':'Minería','cobre':'Minería','oro':'Minería','inmobiliario':'Inmobiliario','edificio':'Inmobiliario','vial':'Infraestructura','puente':'Infraestructura','infraestructura':'Infraestructura','hospital':'Salud','salud':'Salud','agua':'Agua y Sanitaria','desalad':'Agua y Sanitaria','celulosa':'Industrial','industrial':'Industrial','metro':'Transporte','aeropuerto':'Transporte','transporte':'Transporte','educacion':'Educación','universidad':'Educación'};
function normSector(raw){const k=(raw||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');for(const[kw,v]of Object.entries(SM))if(k.includes(kw))return v;return 'Infraestructura';}
function inferSector(name){return normSector(name);}
const RM={'arica':'Arica y Parinacota','tarapaca':'Tarapacá','antofagasta':'Antofagasta','atacama':'Atacama','coquimbo':'Coquimbo','valparaiso':'Valparaíso','metropolitana':'Metropolitana','santiago':'Metropolitana','ohiggins':"O'Higgins",'maule':'Maule','nuble':'Ñuble','biobio':'Biobío','araucania':'La Araucanía','los rios':'Los Ríos','los lagos':'Los Lagos','aysen':'Aysén','magallanes':'Magallanes'};
function normRegion(raw){if(!raw)return null;const k=raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');for(const[kw,v]of Object.entries(RM))if(k.includes(kw))return v;return raw.trim().slice(0,100)||null;}
function parseDate(d){if(!d)return null;const p=new Date(d);return isNaN(p)?null:p.toISOString().split('T')[0];}
const SOURCES={seia:{name:'SEIA',fn:scrapeSEIA},mop:{name:'MOP',fn:scrapeMOP},cbc:{name:'CBC',fn:scrapeCBC},mercado_publico:{name:'Mercado Público',fn:scrapeMercadoPublico}};
module.exports={runScraper,SOURCES};
