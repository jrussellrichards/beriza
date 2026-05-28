import { runDueIngestions } from "../src/services/ingestion.js";
import { evaluateAlerts } from "../src/services/alerts.js";
import { processPendingDeliveries } from "../src/services/alertDelivery.js";
import { query } from "../src/db.js";
import { env } from "../src/env.js";

const intervalMinutes = env.workerIntervalMinutes;

async function tick() {
  const started = new Date().toISOString();
  try {
    const ingestion = await runDueIngestions();
    const tenants = await query("SELECT id FROM tenants WHERE status IN ('active','trial')");
    const alerts = [];
    for (const tenant of tenants.rows) alerts.push({ tenantId: tenant.id, ...(await evaluateAlerts({ tenantId: tenant.id })) });
    const deliveries = await processPendingDeliveries({ limit: 250 });
    console.log(JSON.stringify({ started, ingestion, alerts, deliveries }, null, 2));
  } catch (error) {
    console.error("worker_error", error);
  }
}

await tick();
setInterval(tick, intervalMinutes * 60 * 1000);
