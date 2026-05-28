'use strict';
/**
 * BERISA Matching Service v2 — Explainable matching
 * Incorpora risk flags: ISO vencida, siniestralidad alta (H-20, H-21)
 */
const { query } = require('../db/pool');

const WEIGHTS = {
  capability_match: 0.30,
  level_ice:        0.20,
  regional_match:   0.18,
  score_quality:    0.12,
  docs_complete:    0.10,
  hse_score:        0.10,   // NEW: score_hse from M-HSE-01
};

async function generateMatches(needId) {
  const { rows:[need] } = await query('SELECT * FROM project_demand_needs WHERE id=$1', [needId]);
  if (!need) return { count: 0, error: 'Need not found' };

  await query('DELETE FROM marketplace_matches WHERE need_id=$1', [needId]);

  const { rows: suppliers } = await query(
    `SELECT s.*,
            COALESCE(ss.score_total, 0) as score_total,
            COALESCE(ss.score_hse, 0) as score_hse,
            COALESCE(ss.score_quality, 0) as score_quality,
            COALESCE(ss.score_env, 0) as score_env,
            COALESCE(ss.score_docs, 0) as score_docs,
            ARRAY(SELECT capability_id FROM supplier_profile_capabilities WHERE supplier_id=s.id) as cap_ids,
            (SELECT COUNT(*) FROM supplier_documents WHERE supplier_id=s.id AND status='valid') as valid_docs,
            (SELECT COUNT(*) FROM hse_incidents WHERE supplier_id=s.id AND incident_date >= NOW()-INTERVAL '1 year' AND severity IN('fatal','serious')) as severe_incidents,
            (SELECT ta FROM hse_stats_snapshots WHERE supplier_id=s.id ORDER BY period_end DESC LIMIT 1) as latest_ta,
            ARRAY_AGG(iso_docs.name) FILTER (WHERE iso_docs.name IS NOT NULL) AS expired_iso_docs
     FROM suppliers s
     LEFT JOIN supplier_scores ss ON ss.supplier_id=s.id
     LEFT JOIN supplier_documents iso_docs 
       ON iso_docs.supplier_id=s.id 
       AND iso_docs.document_type ILIKE '%ISO%' 
       AND iso_docs.status IN('expired','expiring')
     WHERE s.is_active=true AND s.is_blacklisted=false
     GROUP BY s.id, ss.score_total, ss.score_hse, ss.score_quality, ss.score_env, ss.score_docs
     ORDER BY s.homolog_level DESC, s.rating DESC NULLS LAST
     LIMIT 100`
  );

  const levelRank = { nivel_0:0, nivel_1:1, nivel_2:2, nivel_3:3, nivel_4:4 };
  const reqLevel  = levelRank[need.required_level] || 1;
  const inserts   = [];

  for (const sup of suppliers) {
    const reasons = [];
    const risks   = [];
    let score = 0;

    // 1. Capability match
    const capMatch = need.capability_ids?.length > 0
      ? need.capability_ids.filter(id => (sup.cap_ids||[]).includes(id)).length / need.capability_ids.length
      : 0.5;
    score += capMatch * WEIGHTS.capability_match;
    if (capMatch >= 0.8) reasons.push({ dim:'capability', label:'Capacidades técnicas alineadas', score: +capMatch.toFixed(2) });
    else if (capMatch < 0.3) risks.push({ code:'low_cap_match', label:'Capacidades técnicas insuficientes', severity:'high' });

    // 2. ICE level
    const supLevel  = levelRank[sup.homolog_level] || 0;
    const lvlScore  = supLevel >= reqLevel ? 1.0 : supLevel / Math.max(reqLevel,1);
    score += lvlScore * WEIGHTS.level_ice;
    if (supLevel >= reqLevel) reasons.push({ dim:'homologation', label:`Nivel ICE ${sup.homolog_level} ≥ requerido`, score:1.0 });
    else risks.push({ code:'low_ice_level', label:`Nivel ICE ${sup.homolog_level} < ${need.required_level} requerido`, severity:'medium' });

    // 3. Regional match
    const regions = sup.geo_coverage || [];
    const regScore = !need.region ? 0.7 : regions.includes(need.region) ? 1.0 : regions.length>5 ? 0.4 : 0.1;
    score += regScore * WEIGHTS.regional_match;
    if (regScore >= 0.9) reasons.push({ dim:'geography', label:`Cobertura confirmada en ${need.region}`, score:1.0 });
    else if (regScore < 0.3) risks.push({ code:'no_regional_coverage', label:`Sin cobertura en ${need.region}`, severity:'medium' });

    // 4. Quality score
    const qScore = parseFloat(sup.score_quality||0) / 5;
    score += qScore * WEIGHTS.score_quality;
    if (qScore >= 0.8) reasons.push({ dim:'quality', label:'Score de calidad alto', score:+qScore.toFixed(2) });

    // 5. Docs completeness
    const docScore = Math.min(parseInt(sup.valid_docs||0) / 4, 1.0);
    score += docScore * WEIGHTS.docs_complete;
    if (docScore < 0.5) risks.push({ code:'incomplete_docs', label:'Documentación incompleta', severity:'low' });

    // 6. HSE Score (NEW — from M-HSE-01 siniestralidad data)
    const hseScore = parseFloat(sup.score_hse||0) / 5;
    score += hseScore * WEIGHTS.hse_score;
    if (hseScore >= 0.8) reasons.push({ dim:'hse', label:'Score HSE alto — baja siniestralidad', score:+hseScore.toFixed(2) });

    // NEW risk flags from H-20, H-21
    // Severe incidents risk flag
    const sevInc = parseInt(sup.severe_incidents||0);
    if (sevInc > 0) risks.push({ code:'recent_severe_incidents', label:`${sevInc} accidente(s) grave(s)/fatal(es) en 12 meses`, severity:'high' });

    // High accidentability vs sector benchmark (TA > 5.0 is high for construction)
    const ta = parseFloat(sup.latest_ta||0);
    if (ta > 5.0) risks.push({ code:'high_accidentability', label:`Tasa de accidentabilidad ${ta.toFixed(1)}% (sector avg 3.5%)`, severity:'medium' });
    else if (ta > 0) reasons.push({ dim:'safety', label:`Tasa accidentabilidad ${ta.toFixed(1)}% — dentro del rango aceptable`, score: Math.max(0, +(1 - ta/10).toFixed(2)) });

    // ISO expired risk flag — data pre-loaded in main query (no N+1)
    const expiredISODocs = sup.expired_iso_docs?.filter(Boolean) || [];
    if (expiredISODocs.length > 0) risks.push({ code:'iso_expired', label:`Certificación ISO vencida o próxima a vencer: ${expiredISODocs.join(', ')}`, severity:'high' });

    const finalScore = Math.round(score * 100);
    if (finalScore < 20) continue;
    inserts.push({ need_id:needId, supplier_id:sup.id, match_score:finalScore, fit_reasons:JSON.stringify(reasons), risk_flags:JSON.stringify(risks) });
  }

  inserts.sort((a,b) => b.match_score - a.match_score);
  const top = inserts.slice(0,20);

  for (const m of top) {
    await query(
      'INSERT INTO marketplace_matches(need_id,supplier_id,match_score,fit_reasons,risk_flags) VALUES($1,$2,$3,$4,$5) ON CONFLICT(need_id,supplier_id) DO UPDATE SET match_score=$3,fit_reasons=$4,risk_flags=$5',
      [m.need_id, m.supplier_id, m.match_score, m.fit_reasons, m.risk_flags]
    );
  }

  await query("UPDATE project_demand_needs SET status='matched',updated_at=NOW() WHERE id=$1",[needId]);
  return { count: top.length, topScore: top[0]?.match_score || 0 };
}

module.exports = { generateMatches, WEIGHTS };
