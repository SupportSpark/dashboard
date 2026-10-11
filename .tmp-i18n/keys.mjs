// Print en+zh for candidate REUSE keys, then check a proposed NEW-key list for collisions.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function load(rel, name) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "nb-k-")), name);
  writeFileSync(out, js);
  return import(pathToFileURL(out).href).then((m) => m.default);
}
const [en, zh] = await Promise.all([
  load("src/i18n/messages/en.ts", "en.mjs"),
  load("src/i18n/messages/zh.ts", "zh.mjs"),
]);

const mode = process.argv[2];

if (mode === "reuse") {
  const pairs = process.argv.slice(3);
  for (const p of pairs) {
    const [ns, k] = p.split(".");
    const e = en[ns]?.[k];
    const z = zh[ns]?.[k];
    const ok = typeof e === "string" && typeof z === "string";
    console.log(`${ok ? "OK  " : "BAD "} ${p.padEnd(42)} en=${JSON.stringify(e)} zh=${JSON.stringify(z)}`);
  }
} else if (mode === "sniff") {
  const re = new RegExp(process.argv[3], "i");
  for (const ns of Object.keys(en)) {
    for (const k of Object.keys(en[ns] ?? {})) {
      const e = en[ns][k];
      if (typeof e !== "string") continue;
      if (re.test(k) || re.test(e)) {
        console.log(`${ns}.${k}\n   en=${JSON.stringify(e)}\n   zh=${JSON.stringify(zh[ns]?.[k])}`);
      }
    }
  }
} else if (mode === "collide") {
  // Proposed NEW keys: read the fragment and report collisions with catalogs/siblings.
  const frag = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const sibling = new Map();
  for (const f of readdirSync("i18n-fragments")) {
    if (f === process.argv[3].split(/[\\/]/).pop()) continue;
    const j = JSON.parse(readFileSync(join("i18n-fragments", f), "utf8"));
    for (const [ns, entries] of Object.entries(j)) {
      if (ns.startsWith("_")) continue;
      for (const [k, v] of Object.entries(entries)) sibling.set(`${ns}.${k}`, { ...v, file: f });
    }
  }
  let problems = 0;
  for (const [ns, entries] of Object.entries(frag)) {
    if (ns.startsWith("_")) continue;
    for (const [k, v] of Object.entries(entries)) {
      const id = `${ns}.${k}`;
      const s = sibling.get(id);
      if (s) {
        const same = s.en === v.en && s.zh === v.zh;
        console.log(`${same ? "dup-same" : "CONFLICT"} ${id} vs ${s.file} (en "${s.en}" / zh "${s.zh}")`);
        if (!same) problems++;
      }
      const ce = en[ns]?.[k];
      if (ce !== undefined) {
        const same = ce === v.en && zh[ns]?.[k] === v.zh;
        console.log(`${same ? "already-merged" : "ALREADY-IN-CATALOG"} ${id} en.ts="${ce}" zh.ts="${zh[ns]?.[k]}"`);
        if (!same) problems++;
      }
    }
  }
  console.log(problems ? `\n${problems} PROBLEM(S)` : "\nNo collisions.");
}
