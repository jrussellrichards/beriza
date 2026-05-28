import { query, withTransaction } from "../db.js";

export async function redactContactByHash({ contactHash, reason, actorId = null, tenantId = null }) {
  if (!contactHash) return { redacted: 0 };
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO redacted_contact_hashes(contact_hash, reason, created_by)
       VALUES($1,$2,$3)
       ON CONFLICT(contact_hash) DO UPDATE SET reason=excluded.reason`,
      [contactHash, reason || "Redacción solicitada por titular de datos.", actorId]
    );
    const updated = await client.query("UPDATE contact_records SET status='redacted' WHERE contact_hash=$1 RETURNING id", [contactHash]);
    await client.query(
      `UPDATE projects p SET contact_count = coalesce((SELECT count(*)::int FROM contact_records cr WHERE cr.project_id=p.id AND cr.status='active'),0)
       WHERE p.id IN (SELECT DISTINCT project_id FROM contact_records WHERE contact_hash=$1 AND project_id IS NOT NULL)`,
      [contactHash]
    );
    await client.query(
      `INSERT INTO privacy_audit_events(tenant_id, actor_user_id, action, entity, entity_id, lawful_basis, metadata)
       VALUES($1,$2,'contact_redacted','contact_hash',$3,'data_subject_request',$4)`,
      [tenantId, actorId, contactHash, JSON.stringify({ reason })]
    );
    return { redacted: updated.rows.length };
  });
}
