import { query } from "../db.js";
import { stableHash } from "../security.js";

function normalize(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(value) {
  const text = ` ${normalize(value)} `;
  const result = new Set();
  for (let i = 0; i < text.length - 1; i += 1) result.add(text.slice(i, i + 2));
  return result;
}

function dice(a, b) {
  const x = bigrams(a), y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const item of x) if (y.has(item)) inter += 1;
  return Math.round((2 * inter * 100) / (x.size + y.size));
}

function deterministicKey(project) {
  return stableHash([normalize(project.name), normalize(project.ownerName), normalize(project.country), normalize(project.region)].join("|"));
}

export async function resolveCanonicalProject({ client, sourceId, externalId, project }) {
  const sourceLink = await client.query(
    `SELECT ps.project_id
     FROM project_sources ps
     JOIN source_records sr ON sr.id=ps.source_record_id
     WHERE sr.source_id=$1 AND sr.external_id=$2
     LIMIT 1`,
    [sourceId, externalId]
  );
  if (sourceLink.rows[0]) return { projectId: sourceLink.rows[0].project_id, method: "source_external_id", score: 100, evidence: { externalId } };

  const key = deterministicKey(project);
  const candidates = await client.query(
    `SELECT id, name, owner_name, country, region, investment_musd
     FROM projects
     WHERE country IS NOT DISTINCT FROM $1
       AND (region IS NOT DISTINCT FROM $2 OR owner_name IS NOT DISTINCT FROM $3)
     ORDER BY coalesce(score,0) DESC, coalesce(investment_musd,0) DESC
     LIMIT 200`,
    [project.country, project.region, project.ownerName]
  );
  let best = null;
  for (const row of candidates.rows) {
    const nameScore = dice(project.name, row.name);
    const ownerScore = project.ownerName && row.owner_name ? dice(project.ownerName, row.owner_name) : 50;
    const invScore = project.investmentMusd && row.investment_musd ? Math.max(0, 100 - Math.min(100, Math.abs(Number(project.investmentMusd) - Number(row.investment_musd)))) : 50;
    const score = Math.round(nameScore * 0.62 + ownerScore * 0.28 + invScore * 0.10);
    if (!best || score > best.score) best = { row, score, nameScore, ownerScore, invScore };
  }
  if (best && best.score >= 86) {
    await client.query(
      `INSERT INTO canonical_project_links(canonical_project_id, duplicate_project_id, source_id, match_method, match_score, review_status, evidence)
       VALUES($1,$1,$2,'fuzzy_entity_resolution',$3,'auto_linked',$4)
       ON CONFLICT(canonical_project_id, duplicate_project_id) DO UPDATE SET match_score=excluded.match_score, evidence=excluded.evidence`,
      [best.row.id, sourceId, best.score, JSON.stringify({ key, nameScore: best.nameScore, ownerScore: best.ownerScore, invScore: best.invScore })]
    );
    return { projectId: best.row.id, method: "fuzzy_entity_resolution", score: best.score, evidence: { key } };
  }
  const generatedId = Number.parseInt(stableHash(`${sourceId}:${externalId}:${key}`).slice(0, 12), 16) % 2000000000;
  return { projectId: generatedId, method: "new_canonical_project", score: 100, evidence: { key } };
}
