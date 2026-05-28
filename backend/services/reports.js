'use strict';
const{query}=require('../db/pool');
async function generateReport(reportId){
  await query("UPDATE reports SET status='generating' WHERE id=$1",[reportId]);
  try{
    const{rows:[r]}=await query('SELECT * FROM reports WHERE id=$1',[reportId]);
    if(!r)throw new Error('Report not found');
    // Build report content
    let content='BERISA Report\n'+r.title+'\nGenerated: '+new Date().toISOString()+'\n\n';
    if(r.type==='sector_summary'||r.type==='market_overview'){
      const{rows}=await query('SELECT sector,COUNT(*) as count,SUM(capex_usd_m) as capex FROM projects WHERE is_active=true GROUP BY sector ORDER BY capex DESC NULLS LAST');
      content+=rows.map(s=>`${s.sector}: ${s.count} projects, USD ${parseFloat(s.capex||0).toFixed(0)}M`).join('\n');
    }
    if(r.type==='pipeline_export'){
      const{rows}=await query("SELECT o.name,o.stage,o.value_usd_m,o.probability,u.name as assignee FROM opportunities o LEFT JOIN users u ON u.id=o.assigned_to WHERE o.org_id=$1 AND o.stage NOT IN('won','lost')",[r.org_id]);
      content+=rows.map(o=>`${o.name}|${o.stage}|$${o.value_usd_m}M|${o.probability}%|${o.assignee||'-'}`).join('\n');
    }
    // In production: use pdf-lib to generate real PDF and upload to S3
    const fakeUrl='https://berisa.com/reports/'+reportId+'.pdf';
    await query("UPDATE reports SET status='ready',file_url=$1,file_size_kb=42,pages=1,generated_at=NOW() WHERE id=$2",[fakeUrl,reportId]);
    return{success:true};
  }catch(e){
    await query("UPDATE reports SET status='failed',error_msg=$1 WHERE id=$2",[e.message,reportId]);
    throw e;
  }
}
module.exports={generateReport};
