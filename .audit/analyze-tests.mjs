import fs from "node:fs";

function analyzeAuditScript(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const testMatches = [
    ...content.matchAll(/pass\(\{\s*id:\s*["']([^"']+)["'],\s*area:\s*["']([^"']+)["'],\s*feature:\s*["']([^"']+)["'],\s*expected:\s*["']([^"']+)["'],\s*actual:\s*`?([^`,]+)`?/g)
  ];

  console.log(`Analyzing ${filePath}: found ${testMatches.length} recorded tests`);

  let statusOnlyCount = 0;
  let simulatedOrMockCount = 0;

  for (const m of testMatches) {
    const [full, id, area, feature, expected, actual] = m;
    const isStatusOnly = /^(HTTP\s*\d{3}|200|201|400|403|404|422|4xx)$/i.test(expected.trim()) ||
                         /^(HTTP\s*\d{3})$/i.test(actual.trim());
    const isSimulated = /simulat|no provider|not configured|mock|placeholder/i.test(feature + " " + expected + " " + actual);

    if (isStatusOnly) statusOnlyCount++;
    if (isSimulated) simulatedOrMockCount++;
  }

  return {
    total: testMatches.length,
    statusOnlyCount,
    simulatedOrMockCount,
  };
}

console.log("audit-e2e.mjs:", analyzeAuditScript("scripts/audit-e2e.mjs"));
console.log("audit-admin.mjs:", analyzeAuditScript("scripts/audit-admin.mjs"));
