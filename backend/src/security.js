import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { env } from "./env.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function createTokenValue(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function stableHash(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export function safeText(value, maxLength = 1000) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function contactHash(contact = {}) {
  const identity = [contact.nombre || contact.name || "", contact.email || "", contact.tel || contact.phone || "", contact.empresa || contact.company || ""]
    .map((x) => String(x || "").trim().toLowerCase())
    .join("|");
  return stableHash(identity);
}

export function publicContactSummary(contact = {}) {
  return {
    contactHash: contactHash(contact),
    role: safeText(contact.cargo || contact.role || contact.cat || "Contacto", 120),
    company: safeText(contact.empresa || contact.company || "", 160),
    category: safeText(contact.cat || contact.category || "General", 80),
    privacyStatus: "protected"
  };
}

function encryptionKey() {
  const raw = env.piiEncryptionKey;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64");
}

export function encryptJson(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const clear = Buffer.from(JSON.stringify(payload ?? null), "utf8");
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptJson(value) {
  if (!value) return null;
  const data = Buffer.from(value, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(clear.toString("utf8"));
}

export function sanitizeSourcePayload(input = {}) {
  if (Array.isArray(input)) return input.map(sanitizeSourcePayload);
  if (!input || typeof input !== "object") return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (["cts", "contacts", "contactos", "email", "mail", "tel", "telefono", "phone", "nombre", "name"].includes(lower)) {
      if (["n", "name", "project_name"].includes(lower)) out[key] = value;
      else out[key] = Array.isArray(value) ? value.map(publicContactSummary) : "[PII_PROTECTED]";
    } else {
      out[key] = sanitizeSourcePayload(value);
    }
  }
  return out;
}
