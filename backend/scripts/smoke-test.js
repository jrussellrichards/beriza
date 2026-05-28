const base = process.env.API_URL || "http://localhost:8080/api";

const health = await fetch(`${base}/health`).then((r) => r.json());
if (!health.ok) throw new Error("Healthcheck failed");

console.log("Smoke test OK");
