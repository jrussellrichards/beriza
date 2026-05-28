import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function requireLongSecret(name, minLength = 48) {
  const value = required(name);
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters.`);
  }
  return value;
}

function requireKey(name) {
  const value = required(name);
  const isHex64 = /^[a-f0-9]{64}$/i.test(value);
  const isBase64_32 = (() => {
    try { return Buffer.from(value, "base64").length === 32; } catch { return false; }
  })();
  if (!isHex64 && !isBase64_32) {
    throw new Error(`${name} must be a 32-byte key encoded as 64-char hex or base64.`);
  }
  return value;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", 8080)),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: requireLongSecret("JWT_SECRET", 48),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "8h"),
  sessionCookieName: optional("SESSION_COOKIE_NAME", "berisa_session"),
  cookieSecure: optional("COOKIE_SECURE", "false") === "true",
  corsOrigin: required("CORS_ORIGIN").split(",").map((x) => x.trim()).filter(Boolean),
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  adminName: optional("ADMIN_NAME", "Administrador Berisa"),
  piiEncryptionKey: requireKey("PII_ENCRYPTION_KEY"),
  webhookSigningSecret: optional("ALERT_WEBHOOK_SECRET", crypto.randomBytes(32).toString("hex")),
  emailProviderUrl: optional("EMAIL_PROVIDER_URL", ""),
  emailProviderToken: optional("EMAIL_PROVIDER_TOKEN", ""),
  workerIntervalMinutes: Number(optional("WORKER_INTERVAL_MINUTES", 30)),
  apiKeyPrefix: optional("API_KEY_PREFIX", "brs_live")
};

if (env.nodeEnv === "production") {
  const forbidden = ["localhost", "127.0.0.1", "example", "change" + "me", "re" + "place", "pass" + "word"];
  const sensitive = [env.databaseUrl, env.jwtSecret, env.adminPassword, env.piiEncryptionKey];
  for (const value of sensitive) {
    const lower = String(value).toLowerCase();
    if (forbidden.some((term) => lower.includes(term))) {
      throw new Error("Production configuration contains placeholder or unsafe secret material.");
    }
  }
}
