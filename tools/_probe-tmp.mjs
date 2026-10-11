// temp probe: check key existence under a given namespace in BOTH catalogs
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const dir = mkdtempSync(join(tmpdir(), "nb-cat-"));
async function load(rel) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, rel.split(/[\\/]/).pop().replace(/\.[jt]s$/, "") + Math.random().toString(36).slice(2) + ".mjs");
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}
const en = await load("src/i18n/messages/en.ts");
const zh = await load("src/i18n/messages/zh.ts");
const args = process.argv.slice(2);
for (const w of args) {
  const i = w.indexOf(":");
  const ns = w.slice(0, i);
  const key = w.slice(i + 1);
  const e = en[ns]?.[key];
  const z = zh[ns]?.[key];
  const ok = e !== undefined && z !== undefined;
  console.log((ok ? "OK   " : "MISS ") + w.padEnd(46) + " en=" + JSON.stringify(e) + " zh=" + JSON.stringify(z));
}
