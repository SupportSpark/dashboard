/**
 * Final wiring plan + the extra fragment keys it needs.
 *
 * Strategy: every file binds at most two translators — `t` to the namespace that
 * owns its area (agentNetwork / controlCenter) and `tCommon` to `common` for the
 * universal UI verbs. So a string is mapped to `common.*` only when common has it
 * verbatim; anything else gets a key in the area's own namespace. No file has to
 * import a third namespace (networks, groups, settings, untranslated ...), which
 * keeps the diff small and the bindings unambiguous.
 */
import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `nb-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}

const en = await load("src/i18n/messages/en.ts");
const zh = await load("src/i18n/messages/zh.ts");
const FRAG = "i18n-fragments/agent-network-control-center.json";
const frag = JSON.parse(fs.readFileSync(FRAG, "utf8"));

const NOISE = /\r\n|SELF_SCOPED|Boolean\(p\)|prompt_capture|useMemo\(/;
const all = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "all.json"), "utf8"));

const sideOf = (f) =>
  f.includes("/agent-network/") ? "agentNetwork" : "controlCenter";

/** common.* entries whose English is exactly this string. */
const commonByValue = new Map();
for (const [k, v] of Object.entries(en.common)) {
  if (typeof v === "string" && !commonByValue.has(v)) commonByValue.set(v, k);
}

// Key -> en for each of my namespaces, so I can reuse inside the fragment too.
const mineByValue = { agentNetwork: new Map(), controlCenter: new Map() };
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) mineByValue[ns].set(v.en, k);

const rows = [];
const seen = new Set();
const missing = { agentNetwork: new Map(), controlCenter: new Map() };

for (const e of all) {
  if (NOISE.test(e.text)) continue;
  const dedup = `${e.file}:${e.line}:${e.text}`;
  if (seen.has(dedup)) continue;
  seen.add(dedup);

  const side = sideOf(e.file);
  if (commonByValue.has(e.text)) {
    rows.push({ ...e, ns: "common", key: commonByValue.get(e.text), via: "tCommon" });
    continue;
  }
  if (mineByValue[side].has(e.text)) {
    rows.push({ ...e, ns: side, key: mineByValue[side].get(e.text), via: "t" });
    continue;
  }
  // Needs a new key in this area's namespace.
  if (!missing[side].has(e.text)) missing[side].set(e.text, null);
  rows.push({ ...e, ns: side, key: null, via: "t" });
}

console.log(`rows ${rows.length}`);
for (const ns of ["agentNetwork", "controlCenter"]) {
  console.log(`\n### ${ns}: ${missing[ns].size} string(s) still needing a key`);
  for (const s of missing[ns].keys()) console.log(`  ${JSON.stringify(s)}`);
}

fs.writeFileSync(
  path.join(os.tmpdir(), "rows-final.json"),
  JSON.stringify({ rows, missing: Object.fromEntries(
    Object.entries(missing).map(([k, v]) => [k, [...v.keys()]]),
  ) }, null, 1),
);
