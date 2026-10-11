// Collision report: proposed fragment keys vs en.ts, zh.ts and sibling fragments.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function load(rel, name) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "nb-col-")), name);
  writeFileSync(out, js);
  return import(pathToFileURL(out).href).then((m) => m.default);
}
const [en, zh] = await Promise.all([
  load("src/i18n/messages/en.ts", "en.mjs"),
  load("src/i18n/messages/zh.ts", "zh.mjs"),
]);

const MINE = "wave4-onboarding-billing.json";
const sibling = new Map();
for (const f of readdirSync("i18n-fragments")) {
  const j = JSON.parse(readFileSync(join("i18n-fragments", f), "utf8"));
  for (const [ns, entries] of Object.entries(j)) {
    if (ns.startsWith("_")) continue;
    for (const [k, v] of Object.entries(entries)) {
      if (!sibling.has(`${ns}.${k}`)) sibling.set(`${ns}.${k}`, []);
      sibling.get(`${ns}.${k}`).push({ file: f, ...v });
    }
  }
}

if (process.argv[2] === "keys") {
  // Dump existing keys of a namespace for name planning.
  const ns = process.argv[3];
  console.log(`--- en.${ns} keys (${Object.keys(en[ns] ?? {}).length}) ---`);
  console.log(Object.keys(en[ns] ?? {}).sort().join("\n"));
}

if (process.argv[2] === "check") {
  const frag = JSON.parse(readFileSync(`i18n-fragments/${MINE}`, "utf8"));
  let problems = 0;
  let checked = 0;
  for (const [ns, entries] of Object.entries(frag)) {
    if (ns.startsWith("_")) continue;
    for (const [k, v] of Object.entries(entries)) {
      checked++;
      const id = `${ns}.${k}`;
      const sibs = sibling.get(id);
      if (sibs) {
        for (const s of sibs) {
          if (s.file === MINE) continue;
          if (s.en === v.en && s.zh === v.zh) console.log(`dup-same   ${id} (also in ${s.file})`);
          else {
            console.log(`CONFLICT   ${id} vs ${s.file}: en "${s.en}" / zh "${s.zh}"  !=  en "${v.en}" / zh "${v.zh}"`);
            problems++;
          }
        }
      }
      const ce = en[ns]?.[k];
      if (ce !== undefined) {
        if (ce === v.en && zh[ns]?.[k] === v.zh) console.log(`merged     ${id} (already in catalogs, identical)`);
        else {
          console.log(`CATALOG-CLASH ${id}: en.ts="${ce}" zh.ts="${zh[ns]?.[k]}"  !=  en "${v.en}" / zh "${v.zh}"`);
          problems++;
        }
      }
      // en/zh must not be byte-identical for multi-word prose
      if (v.en === v.zh && v.en.split(/\s+/).length > 2) {
        console.log(`SAME-ZH    ${id}: "${v.en}"`);
        problems++;
      }
      // placeholder parity
      const pe = [...v.en.matchAll(/\{\s*([a-zA-Z_$][\w$]*)/g)].map((m) => m[1]);
      const pz = new Set([...v.zh.matchAll(/\{\s*([a-zA-Z_$][\w$]*)/g)].map((m) => m[1]));
      for (const p of pe) {
        if (!pz.has(p)) {
          console.log(`PLACEHOLDER ${id}: zh omits {${p}}`);
          problems++;
        }
      }
      // half-width punctuation inside Chinese
      const bad = v.zh.match(/[\u4e00-\u9fff][,.;:!?]|[,.;:!?][\u4e00-\u9fff]/g);
      if (bad) console.log(`PUNCT      ${id}: half-width next to Chinese -> ${JSON.stringify([...new Set(bad)])}`);
    }
  }
  console.log(`\nchecked ${checked} key(s); ${problems} hard problem(s)`);
}
