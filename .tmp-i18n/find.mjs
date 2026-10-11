// lookup: node .tmp-i18n/find.mjs "exact english" ...
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const js = ts.transpileModule(readFileSync("src/i18n/messages/en.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const out = join(mkdtempSync(join(tmpdir(), "nb-find-")), "en.mjs");
writeFileSync(out, js);
const en = (await import(pathToFileURL(out).href)).default;

const byValue = new Map();
(function index(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") index(v, path);
    else if (typeof v === "string") {
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(path);
    }
  }
})(en, "");

for (const q of process.argv.slice(2)) {
  const hits = byValue.get(q) ?? [];
  console.log(hits.length ? `HIT  ${JSON.stringify(q)} -> ${hits.join(", ")}` : `MISS ${JSON.stringify(q)}`);
}
