import { query } from "../db.js";

function parseFeature(description = "") {
  const text = String(description || "").replace(/,/g, ".");
  const find = (regex) => {
    const match = text.match(regex);
    return match ? Number(match[1]) : null;
  };
  return {
    mw: find(/(\d+(?:\.\d+)?)\s*MW\b/i),
    km: find(/(\d+(?:\.\d+)?)\s*km\b/i),
    hectares: find(/(\d+(?:\.\d+)?)\s*ha\b/i),
    apartments: find(/(\d+)\s*(?:departamentos|deptos)/i),
    houses: find(/(\d+)\s*(?:viviendas|casas)/i)
  };
}

function multiplierFromFeatures(project, features) {
  let factor = 1;
  if (project.sector === "Energía" && features.mw) factor += Math.min(1.5, features.mw / 600);
  if (project.sector === "Vialidad y Transporte" && features.km) factor += Math.min(2, features.km / 50);
  if (project.sector === "Edificación e Infraestructura" && (features.apartments || features.houses)) factor += Math.min(1.25, ((features.apartments || 0) + (features.houses || 0)) / 1200);
  return Number(factor.toFixed(2));
}

export async function estimateProjectBom({ projectId, tenantId = null, userId = null }) {
  const projectResult = await query("SELECT * FROM projects WHERE id=$1", [projectId]);
  const project = projectResult.rows[0];
  if (!project) throw new Error("Proyecto no encontrado.");
  if (project.investment_musd === null) throw new Error("El proyecto no tiene inversión informada para estimar BOM.");
  const features = parseFeature(project.description);
  const multiplier = multiplierFromFeatures(project, features);
  const assumptionsResult = await query(
    `SELECT * FROM bom_assumptions WHERE status='active' AND (sector=$1 OR sector='*') ORDER BY CASE WHEN sector=$1 THEN 0 ELSE 1 END, item_code`,
    [project.sector]
  );
  const investment = Number(project.investment_musd);
  const items = assumptionsResult.rows.map((a) => {
    let quantity = Number(a.factor_per_musd) * investment * multiplier;
    quantity = Math.max(quantity, Number(a.min_quantity || 0));
    if (a.max_quantity !== null) quantity = Math.min(quantity, Number(a.max_quantity));
    return { itemCode: a.item_code, itemName: a.item_name, unit: a.unit, quantity: Number(quantity.toFixed(2)), factorPerMusd: Number(a.factor_per_musd), modelFamily: a.model_family || "investment_rule", multiplier, confidence: a.confidence, sourceNote: a.source_note };
  });
  if (!items.length) throw new Error("No existen supuestos BOM activos para el sector del proyecto.");
  const baseConfidence = Math.round(items.reduce((acc, item) => acc + item.confidence, 0) / items.length);
  const featureBonus = Object.values(features).some(Boolean) ? 8 : 0;
  const confidence = Math.min(65, baseConfidence + featureBonus);
  const assumptions = assumptionsResult.rows.map((a) => ({ id: a.id, sector: a.sector, itemCode: a.item_code, sourceNote: a.source_note, confidence: a.confidence, modelFamily: a.model_family || "investment_rule" }));
  const disclaimer = "Estimación preliminar para priorización comercial; no apta para presupuesto contractual sin validación técnica, cubicaciones ni comparables calibrados.";
  const { rows } = await query(
    `INSERT INTO project_bom_estimates(project_id, tenant_id, calculation_version, investment_musd, confidence, assumptions, items, input_features, disclaimer, created_by)
     VALUES($1,$2,'v2-feature-assisted-rule-based',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [project.id, tenantId, project.investment_musd, confidence, JSON.stringify(assumptions), JSON.stringify(items), JSON.stringify(features), disclaimer, userId]
  );
  return rows[0];
}
