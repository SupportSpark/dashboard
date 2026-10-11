/**
 * Rebuild the wiring plan from a single, consistent scan of the CURRENT tree.
 *
 * Uses one method — walk the source line by line — so line numbers are exact.
 * Collects:
 *   - JSX text children
 *   - string attributes in either form (attr="x" / attr={"x"})
 *   - object-literal `key: "value"` properties whose key is user-visible
 *   - JSX text runs that wrap across lines
 * Lines that already route through a translator are skipped.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

// ---------------------------------------------------------------- catalogs
async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `nb-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}
const en = await load("src/i18n/messages/en.ts");

const frag = JSON.parse(fs.readFileSync("i18n-fragments/agent-network-control-center.json", "utf8"));
const mineByValue = { agentNetwork: new Map(), controlCenter: new Map() };
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) mineByValue[ns].set(v.en, k);

const commonByValue = new Map();
for (const [k, v] of Object.entries(en.common))
  if (typeof v === "string" && !commonByValue.has(v)) commonByValue.set(v, k);

// ---------------------------------------------------------------- scanning
const VISIBLE_PROPS = new Set([
  "label", "title", "description", "confirmText", "cancelText", "loadingMessage",
  "placeholder", "helpText", "tooltip", "subtitle", "heading", "buttonText",
  "message", "emptyState", "text", "content", "alt",
]);
const VISIBLE_ATTRS = new Set([
  "placeholder", "title", "label", "description", "helpText", "confirmText",
  "cancelText", "loadingMessage", "alt", "aria-label", "tooltip", "message",
  "subtitle", "heading", "buttonText",
]);

const scope = process.argv[2] ?? "modules/";
const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.includes(scope));

function prose(s) {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return false;
  if (/[{}<>]|=>|\/\/|https?:/.test(t)) return false;
  if (/^[a-z-]+(\s+[a-z-]+)+$/.test(t)) return false;
  if (/^[a-zA-Z0-9_.$:/-]+$/.test(t) && !/[A-Z]/.test(t[0])) return false;
  return true;
}

const findings = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  const hits = new Set();

  const add = (line, kind, text) => {
    const key = `${line}|${text}`;
    if (hits.has(key)) return;
    hits.add(key);
    findings.push({ file, line, kind, text });
  };

  lines.forEach((line, i) => {
    // Skip translator-routed lines and comments.
    const beforeT = line;
    if (/\bt[A-Za-z]*\(/.test(beforeT)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

    // JSX text node on one line: >Text<
    for (const m of line.matchAll(/>\s*([^<>{}]{2,}?)\s*</g)) {
      const s = m[1].trim();
      if (prose(s) && /^[A-Z0-9]/.test(s)) add(i + 1, "jsx", s);
    }
    // Attribute in string form.
    for (const m of line.matchAll(/\b([A-Za-z-]+)\s*=\s*"([^"{}]{2,})"/g)) {
      const [, a, v] = m;
      if (!VISIBLE_ATTRS.has(a)) continue;
      if (prose(v)) add(i + 1, `attr:${a}`, v.trim());
    }
    // Attribute in expression form: attr={"x"}
    for (const m of line.matchAll(/\b([A-Za-z-]+)\s*=\s*\{\s*"([^"{}]{2,})"\s*\}/g)) {
      const [, a, v] = m;
      if (!VISIBLE_ATTRS.has(a)) continue;
      if (prose(v)) add(i + 1, `attr:${a}`, v.trim());
    }
    // Object-literal property: key: "value"
    for (const m of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*"([^"{}]{2,})"/g)) {
      const [, k, v] = m;
      if (!VISIBLE_PROPS.has(k)) continue;
      if (prose(v)) add(i + 1, `prop:${k}`, v.trim());
    }
  });

  // Multi-line JSX text runs -> attribute them to the first line of the run.
  const src2 = lines.join("\n");
  for (const m of src2.matchAll(/(?<=>)([^<>{}]*\n[^<>{}]*)(?=<)/g)) {
    const text = m[1].replace(/\s+/g, " ").trim();
    if (text.length < 6 || !prose(text) || !/^[A-Z0-9]/.test(text)) continue;
    const line = src2.slice(0, m.index).split("\n").length;
    add(line, "jsx-run", text);
  }
}

// ---------------------------------------------------------------- assign keys
const rows = [];
const unresolved = new Map();
for (const f of findings) {
  const side = f.file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  if (commonByValue.has(f.text)) {
    rows.push({ ...f, ns: "common", key: commonByValue.get(f.text) });
  } else if (mineByValue[side].has(f.text)) {
    rows.push({ ...f, ns: side, key: mineByValue[side].get(f.text) });
  } else if (mineByValue[side].has(f.text.trim() + " ")) {
    rows.push({ ...f, ns: side, key: mineByValue[side].get(f.text.trim() + " ") });
  } else {
    rows.push({ ...f, ns: side, key: null });
    if (!unresolved.has(f.text)) unresolved.set(f.text, []);
    unresolved.get(f.text).push(`${path.basename(f.file)}:${f.line}`);
  }
}

fs.writeFileSync(
  path.join(os.tmpdir(), "plan-fresh.json"),
  JSON.stringify({ rows, unresolved: [...unresolved.keys()] }, null, 1),
);

console.log(`findings: ${rows.length}   with a key: ${rows.filter((r) => r.key).length}   unresolved: ${unresolved.size}`);
const byFile = new Map();
for (const r of rows.filter((r) => r.key)) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);
console.log(`files: ${byFile.size}`);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f);
console.log(`\n--- unresolved (need keys) ---`);
for (const [t, ls] of unresolved) console.log(`  ${JSON.stringify(t)}  ${ls.slice(0, 2).join(", ")}`);
