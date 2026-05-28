import { query } from "./db.js";

export async function audit({ actorId = null, action, entity, entityId = null, metadata = {}, ip = null }) {
  try {
    await query(
      `INSERT INTO audit_logs(actor_user_id, action, entity, entity_id, metadata, ip_address)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [actorId, action, entity, entityId, metadata, ip]
    );
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}
