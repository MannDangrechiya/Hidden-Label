import fs from "node:fs";
import path from "node:path";

function inspectEnv(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, keys: [] };
  const content = fs.readFileSync(filePath, "utf8");
  const keys = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        keys.push({
          key,
          isSet: val.length > 0,
          isPlaceholder: /dummy|placeholder|xxx|test|changeme|default|localhost|127\.0\.0\.1/i.test(val),
        });
      }
    }
  }
  return { exists: true, keys };
}

const envFiles = [
  ".env.example",
  "apps/backend/.env",
  "apps/storefront/.env",
  "apps/storefront/.env.local",
  "apps/admin/.env",
];

const report = {};
for (const f of envFiles) {
  report[f] = inspectEnv(f);
}

console.log(JSON.stringify(report, null, 2));
