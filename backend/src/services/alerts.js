import { query } from "../db.js";
import { queueDelivery } from "./alertDelivery.js";

function ruleCondition(rule, params) {
  const where = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  if (rule.sector) add("p.sector = ?", rule.sector);
  if (rule.country) add("p.country = ?", rule.country);
  if (rule.region) add("p.region = ?", rule.region);
  if (rule.opportunity_status) add("p.opportunity_status = ?", rule.opportunity_status);
  if (rule.min_score) add("coalesce(p.score,0) >= ?", rule.min_score);
  if (rule.min_investment_musd) add("coalesce(p.investment_musd,0) >= ?", rule.min_investment_musd);
  if (rule.latitude && rule.longitude && rule.radius_km) {
    params.push(rule.latitude, rule.longitude, rule.radius_km);
    const latParam = params.length - 2, lonParam = params.length - 1, radiusParam = params.length;
    where.push(`p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND earth_distance(ll_to_earth(p.latitude, p.longitude), ll_to_earth($${latParam}, $${lonParam})) <= ($${radiusParam} * 1000)`);
  }
  return where;
}

export async function evaluateAlerts({ tenantId }) {
  const rules = await query("SELECT * FROM alert_rules WHERE tenant_id=$1 AND enabled=true", [tenantId]);
  const created = [];
  for (const rule of rules.rows) {
    const params = [];
    const where = ruleCondition(rule, params);
    const projects = await query(
      `SELECT p.id, p.name, p.owner_name, p.sector, p.region, p.country, p.score, p.opportunity_label
       FROM projects p ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY coalesce(p.score,0) DESC, coalesce(p.investment_musd,0) DESC LIMIT 200`,
      params
    );
    for (const project of projects.rows) {
      const title = `${rule.name}: ${project.name}`.slice(0, 180);
      const body = [project.owner_name, project.sector, project.region, project.country, `score ${project.score ?? "s/i"}`].filter(Boolean).join(" · ");
      const severity = (project.score || 0) >= 5 ? "high" : (project.score || 0) >= 4 ? "medium" : "info";
      const inserted = await query(
        `INSERT INTO alert_events(tenant_id, rule_id, project_id, event_type, severity, title, body)
         VALUES($1,$2,$3,'project_match',$4,$5,$6)
         ON CONFLICT(rule_id, project_id, event_type) DO NOTHING RETURNING id`,
        [tenantId, rule.id, project.id, severity, title, body]
      );
      if (inserted.rows[0]) {
        created.push(inserted.rows[0].id);
        await queueDelivery({ tenantId, alertEventId: inserted.rows[0].id, rule });
      }
    }
  }
  return { evaluatedRules: rules.rows.length, eventsCreated: created.length };
}
