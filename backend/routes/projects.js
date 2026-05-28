'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireManager}=require('../middleware/auth');
const{scoreProject,computeOppWindow}=require('../services/scoring');
const PS=20;

router.get('/',async(req,res,next)=>{
  try{
    const{page=1,sector,status,country,region,capex_min,capex_max,score_min,opp_window,search,sort='score',dir='desc'}=req.query;
    const SORTS=['score','capex_usd_m','name','start_date','created_at'];
    const DIRS=['asc','desc'];
    const sc=SORTS.includes(sort)?sort:'score';
    const sd=DIRS.includes(dir)?dir:'desc';
    const conds=['p.is_active=true'];const vals=[];let i=1;
    if(sector)   {conds.push(`p.sector=$${i++}`);vals.push(sector);}
    if(status)   {conds.push(`p.status=$${i++}`);vals.push(status);}
    if(country)  {conds.push(`p.country=$${i++}`);vals.push(country);}
    if(region)   {conds.push(`p.region=$${i++}`);vals.push(region);}
    if(capex_min){conds.push(`p.capex_usd_m>=$${i++}`);vals.push(parseFloat(capex_min));}
    if(capex_max){conds.push(`p.capex_usd_m<=$${i++}`);vals.push(parseFloat(capex_max));}
    if(score_min){conds.push(`p.score>=$${i++}`);vals.push(parseInt(score_min));}
    if(opp_window){conds.push(`p.opp_window=$${i++}`);vals.push(opp_window);}
    if(search)   {conds.push(`(p.name ILIKE $${i} OR p.owner_name ILIKE $${i} OR p.region ILIKE $${i})`);vals.push('%'+search+'%');i++;}
    const where='WHERE '+conds.join(' AND ');
    const offset=(Math.max(1,parseInt(page))-1)*PS;
    vals.push(req.org.id);
    const[cnt,data]=await Promise.all([
      query(`SELECT COUNT(*) FROM projects p ${where}`,vals.slice(0,-1)),
      query(`SELECT p.*,COUNT(c.id) AS contact_count FROM projects p LEFT JOIN contacts c ON c.project_id=p.id AND c.org_id=$${i} ${where} GROUP BY p.id ORDER BY p.${sc} ${sd} NULLS LAST LIMIT ${PS} OFFSET ${offset}`,vals),
    ]);
    res.json({data:data.rows,meta:{total:parseInt(cnt.rows[0].count),page:parseInt(page),pageSize:PS,pages:Math.ceil(cnt.rows[0].count/PS)}});
  }catch(err){next(err);}
});

router.get('/meta/filters',async(_req,res,next)=>{
  try{
    const[sc,st,co,re]=await Promise.all([
      query('SELECT DISTINCT sector FROM projects WHERE is_active=true AND sector IS NOT NULL ORDER BY sector'),
      query('SELECT DISTINCT status FROM projects WHERE is_active=true ORDER BY status'),
      query('SELECT DISTINCT country FROM projects WHERE is_active=true AND country IS NOT NULL ORDER BY country'),
      query('SELECT DISTINCT region FROM projects WHERE is_active=true AND region IS NOT NULL ORDER BY region'),
    ]);
    res.json({sectors:sc.rows.map(r=>r.sector),statuses:st.rows.map(r=>r.status),countries:co.rows.map(r=>r.country),regions:re.rows.map(r=>r.region)});
  }catch(err){next(err);}
});

router.get('/:id',async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT * FROM projects WHERE id=$1 AND is_active=true',[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Proyecto no encontrado'});
    const ct=await query('SELECT * FROM contacts WHERE project_id=$1 AND org_id=$2 ORDER BY tag',[rows[0].id,req.org.id]);
    const sv=await query('SELECT 1 FROM org_project_saves WHERE org_id=$1 AND project_id=$2',[req.org.id,rows[0].id]);
    res.json({...rows[0],contacts:ct.rows,isSaved:sv.rows.length>0});
  }catch(err){next(err);}
});

router.post('/',requireManager,async(req,res,next)=>{
  try{
    const{name,sector,status,country='CL',region,location_text,lat,lon,capex_usd_m,start_date,end_date,typology,owner_name,description,tags}=req.body;
    if(!name) return res.status(400).json({error:'Nombre requerido'});
    const opp=computeOppWindow({start_date});
    const{rows:[p]}=await query('INSERT INTO projects(name,sector,status,country,region,location_text,lat,lon,capex_usd_m,start_date,end_date,typology,owner_name,description,tags,opp_window,opp_label,source)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'manual')RETURNING *',
      [name,sector,status,country,region,location_text,lat,lon,capex_usd_m,start_date,end_date,typology,owner_name,description,tags||[],opp.window,opp.label]);
    const sc=scoreProject(p);
    await query('UPDATE projects SET score=$1,score_breakdown=$2 WHERE id=$3',[sc.score,JSON.stringify(sc.breakdown),p.id]);
    res.status(201).json({...p,score:sc.score});
  }catch(err){next(err);}
});

router.patch('/:id',requireManager,async(req,res,next)=>{
  try{
    const al=['name','sector','status','region','capex_usd_m','start_date','end_date','typology','owner_name','description','tags','opp_window','opp_label'];
    const f=[],v=[];let i=1;
    for(const k of al)if(req.body[k]!==undefined){f.push(`${k}=$${i++}`);v.push(req.body[k]);}
    if(!f.length) return res.status(400).json({error:'Sin campos'});
    v.push(req.params.id);
    const{rows}=await query(`UPDATE projects SET ${f.join(',')},updated_at=NOW() WHERE id=$${i} RETURNING *`,v);
    if(!rows.length) return res.status(404).json({error:'Proyecto no encontrado'});
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.post('/:id/save',async(req,res,next)=>{
  try{await query('INSERT INTO org_project_saves(org_id,project_id,user_id,notes)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',[req.org.id,req.params.id,req.user.id,req.body.notes||null]);res.json({saved:true});}catch(err){next(err);}
});
router.delete('/:id/save',async(req,res,next)=>{
  try{await query('DELETE FROM org_project_saves WHERE org_id=$1 AND project_id=$2',[req.org.id,req.params.id]);res.json({saved:false});}catch(err){next(err);}
});

module.exports=router;
