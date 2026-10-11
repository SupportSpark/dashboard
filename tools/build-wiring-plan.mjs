import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const js = ts.transpileModule(fs.readFileSync("src/i18n/messages/en.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tmp = path.join(os.tmpdir(), `en-map-${Date.now()}.mjs`);
fs.writeFileSync(tmp, js);
const en = (await import(`file:///${tmp.replace(/\\/g, "/")}`)).default;

const frag = JSON.parse(
  fs.readFileSync("i18n-fragments/agent-network-control-center.json", "utf8"),
);
const mine = new Map();
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) mine.set(v.en, `${ns}.${k}`);

const byValue = new Map();
(function idx(o, pre) {
  for (const [k, v] of Object.entries(o)) {
    const pa = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object") idx(v, pa);
    else if (typeof v === "string" && v.trim()) {
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push({ ns: pre ? pre.split(".")[0] : k, key: pa });
    }
  }
})(en, "");

const NOISE = /\r\n|SELF_SCOPED|Boolean\(p\)|prompt_capture|useMemo\(/;
const all = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "all.json"), "utf8"));

const rows = [];
const seen = new Set();
for (const e of all) {
  if (NOISE.test(e.text)) continue;
  const k = `${e.file}:${e.line}`;
  if (seen.has(k)) continue;
  seen.add(k);
  let ns;
  let key;
  if (mine.has(e.text)) {
    const f = mine.get(e.text);
    ns = f.split(".")[0];
    key = f.slice(ns.length + 1);
  } else {
    const r = byValue.get(e.text);
    if (!r) continue;
    const pref =
      r.find((x) => x.ns === "common") ??
      r.find((x) => ["peers", "policies", "networks", "settings"].includes(x.ns)) ??
      r[0];
    ns = pref.ns;
    key = pref.key.includes(".") ? pref.key.split(".").slice(1).join(".") : pref.key;
  }
  rows.push({ file: e.file, line: e.line, kind: e.kind, text: e.text, ns, key });
}

fs.writeFileSync(path.join(os.tmpdir(), "plan.json"), JSON.stringify(rows, null, 1));
const byNs = {};
for (const r of rows) byNs[r.ns] = (byNs[r.ns] ?? 0) + 1;
const byFile = {};
for (const r of rows) byFile[r.file] = (byFile[r.file] ?? 0) + 1;
console.log("rows", rows.length, "files", Object.keys(byFile).length);
console.log("byNs", JSON.stringify(byNs, null, 1));
console.log("--- per file ---");
for (const [f, n] of Object.entries(byFile).sort()) console.log(String(n).padStart(4), f);
