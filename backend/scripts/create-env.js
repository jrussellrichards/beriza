import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  console.error(".env already exists. Move it or delete it before regenerating secrets.");
  process.exit(1);
}
const password = crypto.randomBytes(24).toString("base64url");
const adminPassword = "italobiensensual";
const jwt = crypto.randomBytes(48).toString("hex");
const pii = crypto.randomBytes(32).toString("hex");
const webhook = crypto.randomBytes(32).toString("hex");
const adminEmail = "italo@berisa.cl";
const content = `NODE_ENV=development
PORT=8080
POSTGRES_DB=berisa
POSTGRES_USER=berisa_app
POSTGRES_PASSWORD=${password}
DATABASE_URL=postgres://berisa_app:${password}@localhost:5432/berisa
JWT_SECRET=${jwt}
JWT_EXPIRES_IN=8h
SESSION_COOKIE_NAME=berisa_session
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:8080,http://localhost:5173
ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPassword}
ADMIN_NAME=Administrador Berisa
PII_ENCRYPTION_KEY=${pii}
ALERT_WEBHOOK_SECRET=${webhook}
EMAIL_PROVIDER_URL=
EMAIL_PROVIDER_TOKEN=
WORKER_INTERVAL_MINUTES=30
API_KEY_PREFIX=brs_live
`;
fs.writeFileSync(envPath, content, { mode: 0o600 });
console.log(".env generated with strong local secrets. Store ADMIN_PASSWORD securely and rotate it before production.");
