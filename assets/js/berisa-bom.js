/**
 * BERISA — BOM Estimator Module v1.0
 * Estimación de materiales por tipo/monto de proyecto
 */
;(function(g){'use strict';
// Coeficientes por sector y tipología (ton/MM USD o m²/MM USD)
const BOM_COEF={
  "Energía":{
    "Fotovoltaica":    {acero:180,cobre:12,cemento:150,aluminio:8,cable:22,mano_obra:0.35},
    "Eólico":          {acero:320,cobre:18,cemento:280,aluminio:14,cable:30,mano_obra:0.4},
    "GNL":             {acero:420,cobre:28,cemento:190,aluminio:20,cable:45,mano_obra:0.45},
    "Hidroeléctrica":  {acero:380,cobre:20,cemento:950,aluminio:12,cable:35,mano_obra:0.5},
    "default":         {acero:250,cobre:15,cemento:200,aluminio:10,cable:30,mano_obra:0.38},
  },
  "Infraestructura":{
    "Autopista":       {acero:280,cobre:5,cemento:1800,aluminio:4,cable:12,mano_obra:0.42},
    "Puente":          {acero:520,cobre:8,cemento:1200,aluminio:6,cable:18,mano_obra:0.48},
    "Puerto":          {acero:460,cobre:12,cemento:1600,aluminio:8,cable:25,mano_obra:0.44},
    "default":         {acero:350,cobre:8,cemento:1400,aluminio:6,cable:18,mano_obra:0.43},
  },
  "Minería":{
    "default":         {acero:580,cobre:15,cemento:320,aluminio:18,cable:55,mano_obra:0.52},
  },
  "Industrial":{
    "Celulosa":        {acero:360,cobre:22,cemento:280,aluminio:16,cable:40,mano_obra:0.44},
    "default":         {acero:300,cobre:18,cemento:250,aluminio:12,cable:35,mano_obra:0.42},
  },
  "Agua y Sanitaria":{ "default":{acero:220,cobre:10,cemento:600,aluminio:8,cable:20,mano_obra:0.38}},
  "Transporte":{       "default":{acero:310,cobre:9,cemento:1200,aluminio:5,cable:22,mano_obra:0.45}},
  "Salud":{            "default":{acero:180,cobre:14,cemento:320,aluminio:20,cable:28,mano_obra:0.5}},
  "Educación":{        "default":{acero:160,cobre:10,cemento:280,aluminio:18,cable:22,mano_obra:0.48}},
  "Inmobiliario":{     "default":{acero:140,cobre:8,cemento:380,aluminio:22,cable:18,mano_obra:0.46}},
  "default":{          "default":{acero:280,cobre:12,cemento:400,aluminio:10,cable:25,mano_obra:0.42}},
};
const MAT_META={
  acero:    {label:"Acero Estructural",icon:"🏗️",unit:"ton",color:"#5B6472"},
  cobre:    {label:"Cobre",            icon:"🔶",unit:"ton",color:"#C9972B"},
  cemento:  {label:"Cemento / Hormigón",icon:"🏚️",unit:"ton",color:"#9BAABB"},
  aluminio: {label:"Aluminio",         icon:"⬜",unit:"ton",color:"#D1D9E6"},
  cable:    {label:"Cable Eléctrico",  icon:"⚡",unit:"km",color:"#F59E0B"},
  mano_obra:{label:"Mano de Obra",     icon:"👷",unit:"MM USD",color:"#2EAD6B"},
};

function getCoef(sector,tip){
  const sc=BOM_COEF[sector]||BOM_COEF["default"];
  if(tip){for(const k of Object.keys(sc)){if(k!=="default"&&tip.toLowerCase().includes(k.toLowerCase()))return sc[k];}}
  return sc["default"]||BOM_COEF["default"]["default"];
}
function estimate(project){
  if(!project||!project.inv)return null;
  const inv=project.inv; // USD M
  const coef=getCoef(project.s,project.tip);
  const result={};
  for(const[mat,val] of Object.entries(coef)){
    const meta=MAT_META[mat];
    if(!meta)continue;
    let qty;
    if(mat==='mano_obra') qty=Math.round(inv*val*10)/10;
    else qty=Math.round(inv*val);
    result[mat]={...meta,qty,range:[Math.round(qty*0.8),Math.round(qty*1.2)]};
  }
  return result;
}
function renderBOM(project){
  const bom=estimate(project);
  if(!bom)return`<div class="bom-note">Sin datos de inversión para estimar materiales.</div>`;
  const confidence=project.score>=4?85:project.score>=3?70:55;
  const cards=Object.entries(bom).map(([k,v])=>`
    <div class="bom-item">
      <div class="bom-icon">${v.icon}</div>
      <div class="bom-name">${v.label}</div>
      <div class="bom-val">${v.qty.toLocaleString('es-CL')}</div>
      <div class="bom-unit">${v.unit}</div>
    </div>`).join('');
  return`
    <div class="bom-grid">${cards}</div>
    <div class="bom-conf">
      <span>Confianza estimación:</span>
      <div class="bom-conf-bar"><div class="bom-conf-fill" style="width:${confidence}%"></div></div>
      <span style="color:var(--gold);font-weight:600">${confidence}%</span>
    </div>
    <div class="bom-note">⚠️ Estimación algorítmica basada en promedios sectoriales (USD ${project.inv} M · ${project.s}). Rangos indicativos ±20%. Validar con ingeniería de detalle.</div>`;
}
g.BBOM={estimate,renderBOM};
})(window);
