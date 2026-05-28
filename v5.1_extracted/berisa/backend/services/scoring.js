'use strict';
const W={capex:.25,oppWindow:.30,dataQuality:.15,contacts:.15,timeline:.15};
function scoreProject(p,opts={}){
  const capex=parseFloat(p.capex_usd_m)||0;
  const cs=capex>=2000?1:capex>=1000?.9:capex>=500?.8:capex>=200?.65:capex>=100?.5:capex>=50?.35:capex>=10?.2:.1;
  const ws={green:1,yellow:.55,red:.2,none:0}[p.opp_window]||.3;
  const f=['name','sector','status','region','capex_usd_m','start_date','owner_name','typology','description','lat','lon'];
  const dq=f.filter(k=>p[k]).length/f.length;
  const cs2=opts.hasContacts?1:0;
  const days=opts.daysToStart??daysUntil(p.start_date);
  const ts=days===null?.5:days<0?.2:days<=90?1:days<=180?.85:days<=365?.65:days<=730?.45:.2;
  const raw=cs*W.capex+ws*W.oppWindow+dq*W.dataQuality+cs2*W.contacts+ts*W.timeline;
  return{score:Math.max(1,Math.min(5,Math.round(raw*4+1))),breakdown:{capex:cs,oppWindow:ws,dataQuality:dq,contacts:cs2,timeline:ts},rawScore:parseFloat(raw.toFixed(4))};
}
function computeOppWindow(p){
  const d=p.licitacion_date||p.start_date;const days=daysUntil(d);
  if(days!==null&&days>=0&&days<=120) return{window:'green',label:`Q${Math.ceil((new Date(d).getMonth()+1)/3)} ${new Date(d).getFullYear()} — Ventana activa`};
  if(days!==null&&days>120&&days<=365) return{window:'yellow',label:`Q${Math.ceil((new Date(d).getMonth()+1)/3)} ${new Date(d).getFullYear()} — En preparación`};
  return{window:days===null?'none':'red',label:null};
}
async function batchScoreProjects(queryFn){
  const{rows}=await queryFn('SELECT p.*,(SELECT COUNT(*)>0 FROM contacts WHERE project_id=p.id) as has_contacts FROM projects p WHERE p.is_active=true');
  let updated=0;
  for(const p of rows){
    const{score,breakdown}=scoreProject(p,{hasContacts:p.has_contacts});
    if(score!==p.score){await queryFn('UPDATE projects SET score=$1,score_breakdown=$2,updated_at=NOW() WHERE id=$3',[score,JSON.stringify(breakdown),p.id]);updated++;}
  }
  return{total:rows.length,updated};
}
function daysUntil(d){if(!d)return null;const n=new Date(d);return isNaN(n)?null:Math.round((n-Date.now())/86400000);}
module.exports={scoreProject,batchScoreProjects,computeOppWindow,WEIGHTS:W};
