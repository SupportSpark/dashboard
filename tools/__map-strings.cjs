// Map scope strings -> real catalog keys AND sibling fragment keys.
const ts = require("typescript");
const fs = require("fs");
const os = require("os");
const p = require("path");
const crypto = require("crypto");

function load(rel) {
  const tag = "nbmap_" + crypto.randomBytes(8).toString("hex");
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = p.join(os.tmpdir(), tag + ".cjs");
  fs.writeFileSync(out, js);
  const mod = require(out);
  fs.unlinkSync(out);
  return mod.default ?? mod;
}

const en = load("src/i18n/messages/en.ts");
const zh = load("src/i18n/messages/zh.ts");

// --- index 1: real catalog (skip dead `untranslated`) ---
const catalog = new Map(); // en value -> [{where, zh}]
for (const [ns, obj] of Object.entries(en)) {
  if (ns === "untranslated") continue;
  if (!obj || typeof obj !== "object") continue;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string" || !v.trim()) continue;
    if (!catalog.has(v)) catalog.set(v, []);
    catalog.get(v).push({ where: ns + "." + k, zh: zh[ns] && zh[ns][k] });
  }
}

// --- index 2: sibling fragments ---
const siblings = new Map(); // en value -> [{where, zh}]
const siblingKeys = new Set(); // ns + "." + key
for (const f of fs.readdirSync("i18n-fragments")) {
  if (!f.endsWith(".json") || f === "integrations-idp-sso.json") continue;
  let d;
  try { d = JSON.parse(fs.readFileSync("i18n-fragments/" + f, "utf8")); } catch { continue; }
  for (const [ns, entries] of Object.entries(d)) {
    if (ns.startsWith("_")) continue;
    if (!entries || typeof entries !== "object") continue;
    for (const [k, pair] of Object.entries(entries)) {
      siblingKeys.add(ns + "." + k);
      const v = pair && pair.en;
      if (typeof v !== "string" || !v.trim()) continue;
      if (!siblings.has(v)) siblings.set(v, []);
      siblings.get(v).push({ where: ns + "." + k, zh: pair.zh });
    }
  }
}

const strings = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const lines = [];
let a = 0, b = 0, c = 0;
for (const s of strings) {
  const cat = catalog.get(s);
  const sib = siblings.get(s);
  if (cat && cat.length) {
    a++;
    lines.push(`CATALOG  ${JSON.stringify(s)}`);
    for (const x of cat.slice(0, 4)) lines.push(`           ${x.where}  zh=${JSON.stringify(x.zh)}`);
  } else if (sib && sib.length) {
    b++;
    lines.push(`SIBLING  ${JSON.stringify(s)}`);
    for (const x of sib.slice(0, 4)) lines.push(`           ${x.where}  zh=${JSON.stringify(x.zh)}`);
  } else {
    c++;
    lines.push(`NEW      ${JSON.stringify(s)}`);
  }
}
lines.push(`\n# catalog=${a} sibling=${b} new=${c} total=${strings.length}`);
lines.push(`# sibling namespace.key count = ${siblingKeys.size}`);
console.log(lines.join("\n"));
