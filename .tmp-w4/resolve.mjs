// Every literal t("key") in scope must resolve against en.ts + all fragments.
// This is the union that the central merge will produce.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function load(rel, name) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "nb-keys-")), name);
  writeFileSync(out, js);
  return import(pathToFileURL(out).href).then((m) => m.default);
}
const [en, zh] = await Promise.all([
  load("src/i18n/messages/en.ts", "en.mjs"),
  load("src/i18n/messages/zh.ts", "zh.mjs"),
]);

// Union of catalog + fragments (what merge will produce), and fragment-only.
const union = { en: {}, zh: {} };
for (const ns of Object.keys(en)) { union.en[ns] = { ...en[ns] }; union.zh[ns] = { ...zh[ns] }; }
const fromFrag = new Map();
for (const f of readdirSync("i18n-fragments")) {
  if (!f.endsWith(".json")) continue;
  const j = JSON.parse(readFileSync(join("i18n-fragments", f), "utf8"));
  for (const [ns, entries] of Object.entries(j)) {
    if (ns.startsWith("_")) continue;
    union.en[ns] ??= {};
    union.zh[ns] ??= {};
    for (const [k, v] of Object.entries(entries)) {
      if (union.en[ns][k] === undefined) {
        union.en[ns][k] = v.en;
        union.zh[ns][k] = v.zh;
        fromFrag.set(`${ns}.${k}`, { file: f, ...v });
      }
    }
  }
}

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(n) && !/\.(test|stories)\./.test(n)) files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

const problems = [];
let checked = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const bindings = [];
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g)) {
    bindings.push({ name: m[1], ns: m[2], line: src.slice(0, m.index).split("\n").length });
  }
  bindings.sort((a, b) => a.line - b.line);
  const bindingAt = (name, line) => {
    let found;
    for (const b of bindings) if (b.name === name && b.line <= line) found = b;
    if (found) return found;
    const all = bindings.filter((b) => b.name === name);
    const ns = new Set(all.map((b) => b.ns));
    return ns.size === 1 ? all[0] : undefined;
  };

  for (const m of src.matchAll(/\b(\w+)(\.rich)?\(\s*"([^"]+)"/g)) {
    const name = m[1];
    const key = m[3];
    if (/[.{}]/.test(key)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    const b = bindingAt(name, line);
    if (!b) continue;
    checked++;
    const e = union.en[b.ns]?.[key];
    const z = union.zh[b.ns]?.[key];
    if (e === undefined || z === undefined) {
      problems.push(`${file}:${line}  ${name}("${key}")  ns=${b.ns}  en=${e === undefined ? "MISSING" : "ok"} zh=${z === undefined ? "MISSING" : "ok"}`);
    }
  }
}
console.log(`checked ${checked} literal key(s) in ${files.length} file(s)`);
if (problems.length) {
  console.log(`\nUNRESOLVED (${problems.length}) — these render the raw key:`);
  for (const p of problems) console.log("  " + p);
} else {
  console.log("\nOK: every literal key resolves against catalogs + fragments.");
}
console.log(`\nkeys supplied only by fragments: ${fromFrag.size}`);
const byFile = new Map();
for (const [id, v] of fromFrag) byFile.set(v.file, (byFile.get(v.file) ?? 0) + 1);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${f}`);
