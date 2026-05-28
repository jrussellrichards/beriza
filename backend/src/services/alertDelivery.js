import crypto from "node:crypto";
import { query } from "../db.js";
import { env } from "../env.js";

function sign(payload) {
  return crypto.createHmac("sha256", env.webhookSigningSecret).update(payload).digest("hex");
}

async function sendWebhook(target, payload) {
  const body = JSON.stringify(payload);
  const res = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json", "X-Berisa-Signature": sign(body) }, body });
  return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
}

async function sendEmail(target, payload) {
  if (!env.emailProviderUrl) return { ok: false, status: 0, text: "EMAIL_PROVIDER_URL not configured" };
  const res = await fetch(env.emailProviderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(env.emailProviderToken ? { Authorization: `Bearer ${env.emailProviderToken}` } : {}) },
    body: JSON.stringify({ to: target, subject: payload.title, text: payload.body, metadata: payload })
  });
  return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
}

export async function queueDelivery({ tenantId, alertEventId, rule }) {
  if (rule.channel === "in_app") {
    await query(`INSERT INTO alert_delivery_events(tenant_id, alert_event_id, channel, status) VALUES($1,$2,'in_app','sent')`, [tenantId, alertEventId]);
    return;
  }
  const target = rule.channel === "email" ? rule.email_to : rule.webhook_url;
  await query(
    `INSERT INTO alert_delivery_events(tenant_id, alert_event_id, channel, target, status, next_retry_at)
     VALUES($1,$2,$3,$4,'queued',now())`,
    [tenantId, alertEventId, rule.channel, target]
  );
}

export async function processPendingDeliveries({ limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT de.*, ae.title, ae.body, ae.severity, ae.project_id, ar.name AS rule_name
     FROM alert_delivery_events de
     JOIN alert_events ae ON ae.id=de.alert_event_id
     JOIN alert_rules ar ON ar.id=ae.rule_id
     WHERE de.status IN ('queued','failed') AND (de.next_retry_at IS NULL OR de.next_retry_at <= now())
       AND de.attempt_count < 5
     ORDER BY de.created_at ASC
     LIMIT $1`,
    [limit]
  );
  const results = [];
  for (const row of rows) {
    try {
      let outcome;
      const payload = { title: row.title, body: row.body, severity: row.severity, projectId: row.project_id, ruleName: row.rule_name, tenantId: row.tenant_id };
      if (!row.target) outcome = { ok: false, status: 0, text: "No target configured" };
      else if (row.channel === "webhook") outcome = await sendWebhook(row.target, payload);
      else if (row.channel === "email") outcome = await sendEmail(row.target, payload);
      else outcome = { ok: true, status: 200, text: "in-app" };
      await query(
        `UPDATE alert_delivery_events SET status=$2, attempt_count=attempt_count+1, last_attempt_at=now(), next_retry_at=CASE WHEN $2='sent' THEN NULL ELSE now() + ((attempt_count + 1) * interval '10 minutes') END, response_status=$3, error_message=$4 WHERE id=$1`,
        [row.id, outcome.ok ? "sent" : "failed", outcome.status, outcome.ok ? null : String(outcome.text).slice(0, 500)]
      );
      results.push({ id: row.id, status: outcome.ok ? "sent" : "failed" });
    } catch (error) {
      await query(`UPDATE alert_delivery_events SET status='failed', attempt_count=attempt_count+1, last_attempt_at=now(), next_retry_at=now() + interval '10 minutes', error_message=$2 WHERE id=$1`, [row.id, error.message]);
      results.push({ id: row.id, status: "failed", error: error.message });
    }
  }
  return results;
}
