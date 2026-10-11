#!/usr/bin/env node
// Temp checker (mine): tools/check-translation-keys.mjs logic, but resolving
// against catalogs UNION fragments, restricted to my scope
// (control-center + settings). Lets me verify wiring before the central merge.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");
const MINE = ["src/modules/control-center/", "src/modules/settings/"];

async function loadCatalog(relPath, dir) {
  const js = ts.transpileModule(readFileSync(relPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, `${basename(relPath).replace(/\.[jt]s$/, "")}.mjs`);
  writeFileSync(out, js);
  const mod = await import(pathToFileURL(out).href);
  return mod.default ?? mod;
}

const dir = mkdtempSync(join(tmpdir(), "nb-mine-keys-"));
const [en, zh] = await Promise.all([
  loadCatalog("src/i18n/messages/en.ts", dir),
  loadCatalog("src/i18n/messages/zh.ts", dir),
]);

for (const file of readdirSync("i18n-fragments").filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join("i18n-fragments", file), "utf8"));
  for (const [ns, entries] of Object.entries(data)) {
    if (ns.startsWith("_")) continue;
    en[ns] ??= {};
    zh[ns] ??= {};
    for (const [k, v] of Object.entries(entries)) {
      if (en[ns][k] === undefined) en[ns][k] = v.en;
      if (zh[ns][k] === undefined) zh[ns][k] = v.zh;
    }
  }
}

const files = execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !/\.test\.|\.stories\./.test(f))
  .filter((f) => MINE.some((p) => f.startsWith(p)));

const problems = [];
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const bindings = [];
  const re = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:"([^"]+)"|'([^']+)')?\s*\)/g;
  for (const m of src.matchAll(re)) {
    bindings.push({ name: m[1], ns: m[2] ?? m[3] ?? null, line: src.slice(0, m.index).split("\n").length });
  }
  bindings.sort((a, b) => a.line - b.line);

  const paramTranslatorLines = [];
  const addParam = (name, index) =>
    paramTranslatorLines.push({ name, line: src.slice(0, index).split("\n").length });
  for (const m of src.matchAll(/(\w+)\s*:\s*([^,)\n]*(?:useTranslations|Translator)[^,)\n]*)/g)) addParam(m[1], m.index);
  for (const m of src.matchAll(/(\w+)\s*:\s*\([^)]*\)\s*=>\s*string/g)) addParam(m[1], m.index);

  function bindingAt(name, line) {
    let found;
    for (const b of bindings) if (b.name === name && b.line <= line) found = b;
    return found;
  }
  function fallbackBinding(name) {
    const all = bindings.filter((b) => b.name === name);
    if (all.length === 0) return undefined;
    return new Set(all.map((b) => b.ns)).size === 1 ? all[0] : undefined;
  }
  function isParamTranslator(name, line) {
    const localBinding = bindingAt(name, line);
    for (const p of paramTranslatorLines) {
      if (p.name !== name) continue;
      if (p.line <= line && (!localBinding || localBinding.line < p.line)) return true;
    }
    return false;
  }

  const names = new Set(bindings.map((b) => b.name));
  for (const varName of names) {
    const callRe = new RegExp(`\\b${varName}\\(\\s*"([^"]+)"`, "g");
    for (const m of src.matchAll(callRe)) {
      const line = src.slice(0, m.index).split("\n").length;
      const key = m[1];
      if (isParamTranslator(varName, line)) continue;
      const binding = bindingAt(varName, line) ?? fallbackBinding(varName);
      const ns = binding ? binding.ns : null;
      if (!ns) {
        if (key.includes(".")) continue;
        problems.push({ file, namespace: "(none — catalog root)", key, reason: "flat key with namespace-less translator" });
        continue;
      }
      const nsObj = en[ns];
      if (nsObj === undefined || typeof nsObj !== "object") {
        problems.push({ file, namespace: ns, key: "(any)", reason: "namespace does not exist (catalog + fragments)" });
        continue;
      }
      if (/[.{}]/.test(key)) continue;
      checked++;
      if (nsObj[key] === undefined) problems.push({ file, namespace: ns, key, reason: "missing in en (catalog+fragments)" });
      else if (zh[ns] && zh[ns][key] === undefined) problems.push({ file, namespace: ns, key, reason: "missing in zh (catalog+fragments)" });
    }
  }
}

if (asJson) console.log(JSON.stringify({ checked, files: files.length, problems }, null, 2));
else {
  console.log(`Checked ${checked} literal key(s) across ${files.length} file(s) in control-center + settings.`);
  if (problems.length === 0) console.log("OK: every literal key resolves (catalogs + fragments).");
  else {
    console.log(`\nPROBLEMS (${problems.length}):`);
    for (const p of problems) console.log(`  ${p.file}\n      ns=${p.namespace}  key=${p.key}  -> ${p.reason}`);
  }
}
process.exitCode = problems.length ? 1 : 0;
