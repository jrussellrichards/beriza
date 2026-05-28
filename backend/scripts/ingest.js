import { runDueIngestions, runIngestion } from "../src/services/ingestion.js";
import { pool } from "../src/db.js";

const sourceKey = process.argv[2];
try {
  const result = sourceKey
    ? await runIngestion({ sourceKey, mode: "manual" })
    : await runDueIngestions();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
