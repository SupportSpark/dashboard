import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `${path.basename(rel, ".*")}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}

const en = await load("src/i18n/messages/en.ts");
const frag = JSON.parse(fs.readFileSync("i18n-fragments/agent-network-control-center.json", "utf8"));

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
  const k = `${e.file}:${e.line}:${e.text}`;
  if (seen.has(k)) continue;
  seen.add(k);
  let ns, key;
  if (mine.has(e.text)) {
    const f = mine.get(e.text);
    ns = f.split(".")[0];
    key = f.slice(ns.length + 1);
  } else {
    const r = byValue.get(e.text);
    if (!r) continue;
    // Prefer common; then a namespace whose Chinese is a real translation.
    const ok = r.filter((x) => x.ns !== "untranslated");
    const pref = ok.find((x) => x.ns === "common") ?? ok[0] ?? r[0];
    ns = pref.ns;
    key = pref.key.includes(".") ? pref.key.split(".").slice(1).join(".") : pref.key;
  }
  rows.push({ file: e.file, line: e.line, kind: e.kind, text: e.text, ns, key });
}

fs.writeFileSync(path.join(os.tmpdir(), "plan.json"), JSON.stringify(rows, null, 1));

const byFile = new Map();
for (const r of rows) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

const outDir = path.join(os.tmpdir(), "wiring");
fs.mkdirSync(outDir, { recursive: true });

let index = [];
for (const [file, frs] of [...byFile].sort()) {
  const nsSet = [...new Set(frs.map((r) => r.ns))].sort();
  const bindings = nsSet.map((n) => (n === "common" ? "tCommon" : "t"));
  const name = path.basename(file).replace(/\.(tsx|ts)$/, "");
  const lines = [
    `# ${file}`,
    ``,
    `Bindings needed: ${nsSet.map((n, i) => `${bindings[i]} = useTranslations("${n}")`).join(" ; ")}`,
    `Also needed in this file: ${nsSet.includes("common") ? "yes, common" : "no common"}`,
    ``,
    `| line | kind | English | replace with |`,
    `| --- | --- | --- | --- |`,
  ];
  for (const r of frs) {
    const v = r.ns === "common" ? "tCommon" : "t";
    lines.push(`| ${r.line} | ${r.kind} | \`${r.text.replace(/\|/g, "\\|")}\` | \`{${v}(${JSON.stringify(r.key)})}\` |`);
  }
  fs.writeFileSync(path.join(outDir, `${name}.md`), lines.join("\n") + "\n");
  index.push({ file, count: frs.length, ns: nsSet, needsCommon: nsSet.includes("common"), pkg: path.join(outDir, `${name}.md`) });
}

fs.writeFileSync(path.join(outDir, "INDEX.json"), JSON.stringify(index, null, 1));
console.log(`Files: ${index.length}   Rows: ${rows.length}`);
for (const r of index) {
  console.log(`${String(r.count).padStart(4)}  ${r.ns.join("+").padEnd(26)} ${r.file}`);
}
