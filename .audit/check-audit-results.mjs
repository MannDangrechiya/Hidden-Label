import fs from "node:fs";

const r1 = JSON.parse(fs.readFileSync(".audit/results.json", "utf8"));
const r2 = JSON.parse(fs.readFileSync(".audit/results2.json", "utf8"));

console.log("Results 1 (audit-e2e.mjs) total:", r1.length);
console.log("Results 2 (audit-admin.mjs) total:", r2.length);

// Analyze how many tests in r1 and r2 only check HTTP status:
const r1StatusOnly = r1.filter(r => /^HTTP\s*\d{3}$/i.test(r.actual.trim()) || r.expected.startsWith("200") || r.expected.startsWith("400") || r.expected.startsWith("403") || r.expected.startsWith("404"));
console.log("r1 status-only or primarily status:", r1StatusOnly.length);

const r2StatusOnly = r2.filter(r => /^HTTP\s*\d{3}$/i.test(r.actual.trim()) || r.expected.startsWith("200") || r.expected.startsWith("400") || r.expected.startsWith("403") || r.expected.startsWith("404"));
console.log("r2 status-only or primarily status:", r2StatusOnly.length);

// Check if any tests were skipped or simulated:
const simulated = [...r1, ...r2].filter(r => /simulat|no provider|not configured|mock|placeholder|dev_echo/i.test(r.actual + " " + r.expected + " " + r.feature));
console.log("Simulated / unconfigured integrations in tests:", simulated.map(s => ({ id: s.id, feature: s.feature, actual: s.actual })));
