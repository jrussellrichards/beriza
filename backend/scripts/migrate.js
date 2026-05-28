import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../migrations");

function checksum(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function ensureHistory(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS migration_history (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const client = await pool.connect();
try {
  await ensureHistory(client);
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const hash = checksum(sql);
    const existing = await client.query("SELECT checksum FROM migration_history WHERE filename=$1", [file]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== hash) throw new Error(`Migration checksum changed after apply: ${file}`);
      console.log(`Skipping applied migration ${file}`);
      continue;
    }
    console.log(`Applying migration ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO migration_history(filename, checksum) VALUES($1,$2)", [file, hash]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Migrations complete.");
} finally {
  client.release();
  await pool.end();
}
