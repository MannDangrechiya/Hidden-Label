import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "apps/backend");
const src = path.join(root, "src");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

function relImport(fromFile, target) {
  const relative = path
    .relative(path.dirname(fromFile), path.join(src, target))
    .split(path.sep)
    .join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

for (const file of walk(src)) {
  if (!file.endsWith(".ts")) continue;
  let source = readFileSync(file, "utf8");
  const original = source;

  if (source.includes("req.auth_context")) {
    source = source.replaceAll("req.auth_context?.actor_id", "actorId(req)");
    if (!source.includes("lib/auth\"")) {
      const importLine = `import { actorId } from "${relImport(file, "lib/auth")}";\n`;
      const lastImport = [...source.matchAll(/^import .*;$/gm)].pop();
      const index = lastImport ? lastImport.index + lastImport[0].length + 1 : 0;
      source = source.slice(0, index) + importLine + source.slice(index);
    }
  }

  if (source.includes("req.scope.resolve(THL_MODULE)")) {
    source = source.replaceAll(
      "req.scope.resolve(THL_MODULE)",
      "req.scope.resolve<ThlModuleService>(THL_MODULE)",
    );
    if (!source.includes("modules/thl/service\"")) {
      const importLine = `import type ThlModuleService from "${relImport(file, "modules/thl/service")}";\n`;
      const lastImport = [...source.matchAll(/^import .*;$/gm)].pop();
      const index = lastImport ? lastImport.index + lastImport[0].length + 1 : 0;
      source = source.slice(0, index) + importLine + source.slice(index);
    }
  }

  if (source !== original) writeFileSync(file, source);
}

console.log("backend types normalised");
