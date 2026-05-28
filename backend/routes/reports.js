'use strict';
const router=require('express').Router();
const{query}=require('../db/pool');
const{requireManager}=require('../middleware/auth');
router.get('/',async(req,res,next)=>{try{const{rows}=await query('SELECT * FROM reports WHERE org_id=$1 ORDER BY created_at DESC LIMIT 50',[req.org.id]);res.json(rows);}catch(err){next(err);}});
router.post('/generate',requireManager,async(req,res,next)=>{
  try{
    const ALLOWED=['sector_summary','project_detail','pipeline_export','supplier_ranking','market_overview'];
    const{type,title,params={}}=req.body;
    if(!ALLOWED.includes(type)) return res.status(400).json({error:`Tipo inválido. Opciones: ${ALLOWED.join(', ')}`});
    if(!title) return res.status(400).json({error:'Título requerido'});
    const exp=new Date(Date.now()+7*864e5);
    const{rows:[r]}=await query("INSERT INTO reports(org_id,user_id,type,title,params,status,expires_at)VALUES($1,$2,$3,$4,$5,'queued',$6)RETURNING *",
      [req.org.id,req.user.id,type,title,JSON.stringify(params),exp]);
    require('../services/reports').generateReport(r.id).catch(console.error);
    res.status(202).json({...r,message:'Generación iniciada. Recibirá una notificación cuando esté listo.'});
  }catch(err){next(err);}
});
router.get('/:id/download',async(req,res,next)=>{
  try{
    const{rows}=await query('SELECT * FROM reports WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);
    if(!rows.length) return res.status(404).json({error:'Reporte no encontrado'});
    const r=rows[0];
    if(r.status!=='ready') return res.status(202).json({status:r.status,message:'Reporte aún en generación'});
    if(r.expires_at&&new Date()>new Date(r.expires_at)) return res.status(410).json({error:'Reporte expirado. Genere uno nuevo.'});
    if(r.file_url?.startsWith('https://')) return res.redirect(r.file_url);
    res.status(404).json({error:'Archivo no disponible'});
  }catch(err){next(err);}
});
router.delete('/:id',requireManager,async(req,res,next)=>{try{await query('DELETE FROM reports WHERE id=$1 AND org_id=$2',[req.params.id,req.org.id]);res.json({deleted:true});}catch(err){next(err);}});
module.exports=router;
