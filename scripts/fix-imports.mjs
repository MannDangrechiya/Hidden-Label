import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "apps/backend");
const api = path.join(root, "src/api");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

for (const file of walk(api)) {
  const source = readFileSync(file, "utf8");
  const fixed = source.replace(/from "(?:\.\.\/)+(lib|modules)\//g, (_match, group) => {
    const relative = path
      .relative(path.dirname(file), path.join(root, "src", group))
      .split(path.sep)
      .join("/");
    return `from "${relative}/`;
  });
  if (fixed !== source) writeFileSync(file, fixed);
}

console.log("imports normalised");
