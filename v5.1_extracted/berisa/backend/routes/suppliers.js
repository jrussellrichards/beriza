'use strict';
const router=require('express').Router();
const multer=require('multer');
const{query}=require('../db/pool');
const{requireManager}=require('../middleware/auth');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024}});
const CHECKLIST={nivel_1:[{key:'rut',label:'RUT / Personería Jurídica',required:true},{key:'escritura',label:'Escritura de Constitución',required:true},{key:'tgr',label:'Certificado TGR',required:true},{key:'sii',label:'Inicio de Actividades SII',required:true}],nivel_2:[{key:'balance',label:'Balance tributario último año',required:true},{key:'rrhh',label:'Declaración de dotación',required:true},{key:'referencias',label:'Dos referencias de proyectos',required:true}],nivel_3:[{key:'iso9001',label:'Certificado ISO 9001',required:true},{key:'financiero',label:'Informe financiero auditado',required:true},{key:'banco',label:'Certificado bancario',required:true}],nivel_4:[{key:'track_record',label:'Track record proyectos >USD 10M',required:true}]};

router.get('/',async(req,res,next)=>{
  try{
    const{sector,region,level,search,page=1}=req.query;
    const lim=24,off=(parseInt(page)-1)*lim;
    const c=['s.is_active=true','s.is_blacklisted=false'],v=[];let i=1;
    if(sector){c.push(`$${i++}=ANY(s.sectors)`);v.push(sector);}
    if(region){c.push(`$${i++}=ANY(s.geo_coverage)`);v.push(region);}
    if(level){c.push(`s.homolog_level>=$${i++}`);v.push(level);}
    if(search){c.push(`s.company_name ILIKE $${i++}`);v.push('%'+search+'%');}
    const{rows}=await query(`SELECT id,company_name,entity_type,sectors,geo_coverage,homolog_level,homolog_status,rating,jobs_completed,on_time_rate,certifications,logo_url,description,employee_count,country,region,website,profile_complete_pct,is_verified FROM suppliers s WHERE ${c.join(' AND ')} ORDER BY s.homolog_level DESC,s.rating DESC NULLS LAST LIMIT ${lim} OFFSET ${off}`,v);
    const{rows:[cnt]}=await query(`SELECT COUNT(*) FROM suppliers s WHERE ${c.join(' AND ')}`,v);
    res.json({data:rows,meta:{total:parseInt(cnt.count),page:parseInt(page),pageSize:lim}});
  }catch(err){next(err);}
});

router.get('/:id',async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT * FROM suppliers WHERE id=$1',[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Proveedor no encontrado'});
    const[docs,cl]=await Promise.all([
      query("SELECT * FROM supplier_documents WHERE supplier_id=$1 AND status='valid' ORDER BY doc_type",[req.params.id]),
      query('SELECT * FROM homolog_checklists WHERE supplier_id=$1 ORDER BY target_level,item_key',[req.params.id]),
    ]);
    res.json({...rows[0],documents:docs.rows,checklist:cl.rows});
  }catch(err){next(err);}
});

router.post('/',async(req,res,next)=>{
  try{
    const{company_name,rut,entity_type,contact_name,contact_email,contact_phone,website,country='CL',region,address,geo_coverage,sectors,description,employee_count}=req.body;
    if(!company_name||!contact_email) return res.status(400).json({error:'Razón social y email requeridos'});
    if(rut&&(await query('SELECT id FROM suppliers WHERE rut=$1',[rut])).rows.length) return res.status(409).json({error:'RUT ya registrado',code:'RUT_EXISTS'});
    const{rows:[s]}=await query("INSERT INTO suppliers(company_name,rut,entity_type,contact_name,contact_email,contact_phone,website,country,region,address,geo_coverage,sectors,description,employee_count,homolog_level,homolog_status)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'nivel_0','in_progress')RETURNING *",
      [company_name,rut||null,entity_type||'pj_nacional',contact_name,contact_email,contact_phone,website,country,region,address,geo_coverage||[],sectors||[],description,employee_count]);
    await initChecklist(s.id);
    res.status(201).json(s);
  }catch(err){next(err);}
});

router.get('/:id/documents',async(req,res,next)=>{try{const{rows}=await query('SELECT * FROM supplier_documents WHERE supplier_id=$1 ORDER BY doc_type,version DESC',[req.params.id]);res.json(rows);}catch(err){next(err);}});

router.post('/:id/documents',upload.single('file'),async(req,res,next)=>{
  try{
    const{doc_type,doc_label,issued_date,expires_at}=req.body;
    if(!req.file) return res.status(400).json({error:'Archivo requerido'});
    if(!doc_type) return res.status(400).json({error:'Tipo de documento requerido'});
    const{rows:[ver]}=await query('SELECT COALESCE(MAX(version),0)+1 as next FROM supplier_documents WHERE supplier_id=$1 AND doc_type=$2',[req.params.id,doc_type]);
    let fileUrl='local://'+req.file.originalname;
    try{const s3=require('../services/storage');fileUrl=await s3.upload(req.file,`suppliers/${req.params.id}/${doc_type}`);}catch{}
    const{rows:[doc]}=await query("INSERT INTO supplier_documents(supplier_id,doc_type,doc_label,version,file_url,file_name,file_size_kb,mime_type,issued_date,expires_at,status,uploaded_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)RETURNING *",
      [req.params.id,doc_type,doc_label||doc_type,ver.next,fileUrl,req.file.originalname,Math.round(req.file.size/1024),req.file.mimetype,issued_date||null,expires_at||null,req.user?.id||null]);
    await query('UPDATE homolog_checklists SET completed=true,doc_id=$1,completed_at=NOW() WHERE supplier_id=$2 AND item_key=$3 AND completed=false',[doc.id,req.params.id,doc_type]);
    res.status(201).json(doc);
  }catch(err){next(err);}
});

router.patch('/:suppId/documents/:docId/review',requireManager,async(req,res,next)=>{
  try{
    const{status,rejection_reason}=req.body;
    if(!['valid','rejected'].includes(status)) return res.status(400).json({error:'Estado inválido'});
    const{rows}=await query('UPDATE supplier_documents SET status=$1,rejection_reason=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$4 AND supplier_id=$5 RETURNING *',
      [status,rejection_reason||null,req.user.id,req.params.docId,req.params.suppId]);
    if(!rows.length) return res.status(404).json({error:'Documento no encontrado'});
    if(status==='valid') await computeLevel(req.params.suppId);
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.get('/:id/homologation',async(req,res,next)=>{
  try{
    const{rows:[s]}=await query('SELECT homolog_level,homolog_status,homolog_score FROM suppliers WHERE id=$1',[req.params.id]);
    if(!s) return res.status(404).json({error:'Proveedor no encontrado'});
    const{rows:items}=await query('SELECT * FROM homolog_checklists WHERE supplier_id=$1 ORDER BY target_level,item_key',[req.params.id]);
    const plan={};
    for(const[lvl,checks]of Object.entries(CHECKLIST)){
      plan[lvl]=checks.map(c=>{const f=items.find(i=>i.target_level===lvl&&i.item_key===c.key);return{...c,completed:f?.completed||false,doc_id:f?.doc_id||null};});
    }
    res.json({...s,checklist:plan});
  }catch(err){next(err);}
});

router.get('/match',async(req,res,next)=>{
  try{
    const{sector,region,level='nivel_1',limit=10}=req.query;
    const c=["s.is_active=true","s.is_blacklisted=false",`s.homolog_level>='${level}'`],v=[];let i=1;
    if(sector){c.push(`$${i++}=ANY(s.sectors)`);v.push(sector);}
    if(region){c.push(`$${i++}=ANY(s.geo_coverage)`);v.push(region);}
    const{rows}=await query(`SELECT id,company_name,homolog_level,rating,sectors,geo_coverage,certifications FROM suppliers s WHERE ${c.join(' AND ')} ORDER BY s.homolog_level DESC,s.rating DESC NULLS LAST LIMIT ${Math.min(parseInt(limit),50)}`,v);
    res.json({matches:rows,criteria:{sector,region,level}});
  }catch(err){next(err);}
});

async function initChecklist(id){
  const vs=[];
  for(const[lvl,items]of Object.entries(CHECKLIST)) for(const it of items) vs.push(`('${id}','${lvl}','${it.key}','${it.label.replace(/'/g,"''")}',${it.required})`);
  if(vs.length) await query(`INSERT INTO homolog_checklists(supplier_id,target_level,item_key,item_label,required)VALUES${vs.join(',')} ON CONFLICT DO NOTHING`);
}
async function computeLevel(supplierId){
  const levels=['nivel_1','nivel_2','nivel_3','nivel_4'];let achieved='nivel_0';
  for(const lvl of levels){
    const{rows}=await query("SELECT COUNT(*) FILTER(WHERE required=true AND completed=false) as miss FROM homolog_checklists WHERE supplier_id=$1 AND target_level=$2",[supplierId,lvl]);
    if(parseInt(rows[0].miss)===0)achieved=lvl;else break;
  }
  await query('UPDATE suppliers SET homolog_level=$1,updated_at=NOW() WHERE id=$2',[achieved,supplierId]);
  return achieved;
}
module.exports=router;
