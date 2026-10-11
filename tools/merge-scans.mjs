import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const all = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "all.json"), "utf8"));
const extra = [
  ...JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "extra-modules_agent-network.json"), "utf8")),
  ...JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "extra-modules_control-center.json"), "utf8")),
];

const NOISE = /\r\n|SELF_SCOPED|Boolean\(p\)|prompt_capture|useMemo\(|\{|\}|=>/;
const seen = new Set();
const merged = [];
for (const e of [...all, ...extra]) {
  if (NOISE.test(e.text)) continue;
  const k = `${e.file}:${e.line}:${e.text}`;
  if (seen.has(k)) continue;
  seen.add(k);
  merged.push({ file: e.file, line: e.line, kind: e.kind, text: e.text });
}
merged.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
fs.writeFileSync(path.join(os.tmpdir(), "all-merged.json"), JSON.stringify(merged, null, 1));

const frag = JSON.parse(fs.readFileSync("i18n-fragments/agent-network-control-center.json", "utf8"));
const mineByValue = { agentNetwork: new Map(), controlCenter: new Map() };
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) mineByValue[ns].set(v.en, k);

// common keys (verbatim English)
const commonValues = new Set(
  Object.values(
    JSON.parse(
      fs.readFileSync(path.join(os.tmpdir(), "common-values.json"), "utf8"),
    ),
  ),
);

const missing = { agentNetwork: new Map(), controlCenter: new Map() };
for (const r of merged) {
  if (commonValues.has(r.text)) continue;
  const side = r.file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  if (mineByValue[side].has(r.text)) continue;
  if (!missing[side].has(r.text)) missing[side].set(r.text, []);
  missing[side].get(r.text).push(`${path.basename(r.file)}:${r.line}`);
}

console.log(`merged rows: ${merged.length}`);
for (const ns of ["agentNetwork", "controlCenter"]) {
  console.log(`\n### ${ns} — ${missing[ns].size} new string(s)`);
  for (const [s, locs] of missing[ns]) console.log(`  ${JSON.stringify(s)}   ${locs.slice(0, 2).join(", ")}`);
}
fs.writeFileSync(
  path.join(os.tmpdir(), "missing-merged.json"),
  JSON.stringify(Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, Object.keys(Object.fromEntries(v))])), null, 1),
);
