'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
router.get('/projects',async(req,res,next)=>{
  try{
    const{sector,region,country,score_min,opp_window,limit=20,page=1}=req.query;
    const c=['is_active=true'],v=[];let i=1;
    if(sector){c.push(`sector=$${i++}`);v.push(sector);}
    if(region){c.push(`region=$${i++}`);v.push(region);}
    if(country){c.push(`country=$${i++}`);v.push(country);}
    if(score_min){c.push(`score>=$${i++}`);v.push(parseInt(score_min));}
    if(opp_window){c.push(`opp_window=$${i++}`);v.push(opp_window);}
    const lim=Math.min(parseInt(limit)||20,100);
    const off=(Math.max(parseInt(page)||1,1)-1)*lim;
    const{rows}=await query(`SELECT id,name,sector,status,country,region,capex_usd_m,score,opp_window,start_date,owner_name,typology,lat,lon,updated_at FROM projects WHERE ${c.join(' AND ')} ORDER BY score DESC,capex_usd_m DESC NULLS LAST LIMIT ${lim} OFFSET ${off}`,v);
    const{rows:[cnt]}=await query(`SELECT COUNT(*) FROM projects WHERE ${c.join(' AND ')}`,v);
    res.json({data:rows,meta:{total:parseInt(cnt.count),page:parseInt(page)||1,limit:lim}});
  }catch(err){next(err);}
});
router.get('/projects/:id',async(req,res,next)=>{try{const{rows}=await query('SELECT id,name,sector,status,country,region,capex_usd_m,score,opp_window,start_date,end_date,owner_name,typology,description,lat,lon,updated_at FROM projects WHERE id=$1 AND is_active=true',[req.params.id]);if(!rows.length)return res.status(404).json({error:'Proyecto no encontrado'});res.json(rows[0]);}catch(err){next(err);}});
router.get('/stats',async(_req,res,next)=>{try{const{rows:[s]}=await query('SELECT COUNT(*) as total_projects,COUNT(*) FILTER(WHERE opp_window='green') as actionable,SUM(capex_usd_m) as total_capex_usd_m,COUNT(DISTINCT sector) as sectors,COUNT(DISTINCT country) as countries FROM projects WHERE is_active=true');res.json(s);}catch(err){next(err);}});
module.exports=router;
