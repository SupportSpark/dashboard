/**
 * Build the wiring plan with absolute source offsets, then apply it.
 *
 * Offset-based edits mean a multi-line JSX text run can be replaced as one span,
 * and earlier edits never invalidate later positions.
 *
 * Usage:
 *   node tools/plan-offsets.mjs            # write the plan
 *   node tools/apply-plan.mjs [--apply]    # preview / apply it
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

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

const PROP_KEYS = new Set([
  "label", "title", "description", "confirmText", "cancelText", "loadingMessage",
  "placeholder", "helpText", "tooltip", "subtitle", "heading", "buttonText",
  "message", "emptyState", "text", "content", "alt",
]);
const ATTR_KEYS = new Set([
  "placeholder", "title", "label", "description", "helpText", "confirmText",
  "cancelText", "loadingMessage", "alt", "aria-label", "tooltip", "message",
]);

function prose(s) {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return false;
  if (/[{}\\]/.test(t)) return false;
  if (/^[a-z-]+(\s+[a-z-]+)+$/.test(t)) return false;
  if (/^[a-zA-Z0-9_.$:/-]+$/.test(t) && !/[A-Z]/.test(t[0])) return false;
  // A bare identifier/type name is not user-facing copy.
  if (/^(Promise|Partial|Record|Array|Map|Set|String|Number|Boolean)$/.test(t)) return false;
  return true;
}

const scope = process.argv[2] ?? "modules/";
const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.includes(scope));

const plan = [];
const unresolved = new Map();

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  const found = [];
  const occupied = [];

  const claim = (start, end) => {
    if (occupied.some(([a, b]) => start < b && end > a)) return false;
    occupied.push([start, end]);
    return true;
  };

  // --- multi-line JSX text runs (do these first: they are the largest spans)
  for (const m of src.matchAll(/(?<=>)([^<>{}]*\n[^<>{}]*)(?=<)/g)) {
    const raw = m[1];
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length < 6 || !prose(text) || !/^[A-Z0-9]/.test(text)) continue;
    const start = m.index;
    if (!claim(start, start + raw.length)) continue;
    found.push({ kind: "jsx-run", text, start, end: start + raw.length });
  }

  for (const line of src.split("\n")) void line;

  // --- per-line shapes
  const lines = src.split("\n");
  let offset = 0;
  lines.forEach((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (/\bt[A-Za-z]*\(/.test(line)) return;
    const dropped = [];

    // attr="x"
    for (const m of line.matchAll(/\b([A-Za-z-]+)\s*=\s*"([^"{}]{2,})"/g)) {
      const [, a, v] = m;
      if (!ATTR_KEYS.has(a) || !prose(v)) continue;
      const s = lineStart + m.index;
      if (!claim(s, s + m[0].length)) continue;
      dropped.push([s, s + m[0].length]);
      found.push({ kind: `attr:${a}`, text: v.trim(), start: s, end: s + m[0].length, attr: a });
    }
    // attr={"x"}
    for (const m of line.matchAll(/\b([A-Za-z-]+)\s*=\s*\{\s*"([^"{}]{2,})"\s*\}/g)) {
      const [, a, v] = m;
      if (!ATTR_KEYS.has(a) || !prose(v)) continue;
      const s = lineStart + m.index;
      if (!claim(s, s + m[0].length)) continue;
      dropped.push([s, s + m[0].length]);
      found.push({ kind: `attr:${a}`, text: v.trim(), start: s, end: s + m[0].length, attr: a });
    }
    // key: "value"
    for (const m of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*"([^"{}]{2,})"/g)) {
      const [, k, v] = m;
      if (!PROP_KEYS.has(k) || !prose(v)) continue;
      const s = lineStart + m.index;
      if (!claim(s, s + m[0].length)) continue;
      dropped.push([s, s + m[0].length]);
      found.push({ kind: `prop:${k}`, text: v.trim(), start: s, end: s + m[0].length, prop: k });
    }
  });

  // --- single-line JSX text nodes (skip where a bigger span already covers them)
  offset = 0;
  lines.forEach((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (/\bt[A-Za-z]*\(/.test(line)) return;
    for (const m of line.matchAll(/>\s*([^<>{}]{2,}?)\s*</g)) {
      const v = m[1].trim();
      if (!prose(v) || !/^[A-Z0-9]/.test(v)) continue;
      const rawStart = lineStart + m.index + m[0].indexOf(m[1]);
      const s = rawStart;
      const e = rawStart + m[1].length;
      if (occupied.some(([a, b]) => s < b && e > a)) continue;
      occupied.push([s, e]);
      found.push({ kind: "jsx", text: v, start: s, end: e });
    }
  });

  for (const f of found) {
    let ns;
    let key;
    if (commonByValue.has(f.text)) {
      ns = "common";
      key = commonByValue.get(f.text);
    } else if (mineByValue[side].has(f.text)) {
      ns = side;
      key = mineByValue[side].get(f.text);
    } else {
      ns = side;
      key = null;
      if (!unresolved.has(f.text)) unresolved.set(f.text, []);
      unresolved.get(f.text).push(`${path.basename(file)}:${src.slice(0, f.start).split("\n").length}`);
    }
    plan.push({ file, side, ...f, ns, key });
  }
}

fs.writeFileSync(path.join(os.tmpdir(), "plan-offsets.json"), JSON.stringify(plan, null, 1));
console.log(`plan entries: ${plan.length}   keyed: ${plan.filter((p) => p.key).length}   unresolved: ${unresolved.size}`);
const byFile = new Map();
for (const p of plan.filter((p) => p.key)) byFile.set(p.file, (byFile.get(p.file) ?? 0) + 1);
console.log(`files: ${byFile.size}`);
console.log(`\n--- unresolved ---`);
for (const [t, l] of unresolved) console.log(`  ${JSON.stringify(t)}`);
