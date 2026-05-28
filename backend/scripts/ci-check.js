import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const requiredFiles = [
  "backend/src/routes/enterprise.js",
  "backend/src/services/entityResolution.js",
  "backend/src/services/alertDelivery.js",
  "backend/migrations/003_remediate_critical_high.sql",
  "frontend/nginx.conf"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const forbidden = [new RegExp("Change" + "Me", "i"), new RegExp("berisa" + "_change_" + "me", "i"), new RegExp("change" + "-this" + "-secret", "i")];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory() && !["node_modules", ".git", "dist"].includes(entry.name)) return walk(full);
  return entry.isFile() ? [full] : [];
});

for (const file of walk(root)) {
  if (/\.(png|jpe?g|svg|ico|zip)$/i.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) throw new Error(`Forbidden placeholder found in ${path.relative(root, file)}: ${pattern}`);
  }
}

console.log("CI static checks passed.");
