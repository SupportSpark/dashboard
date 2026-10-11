#!/usr/bin/env node
/**
 * Find translated LABELS that are long enough to break an English-sized box.
 *
 * The layout audit by class name was not productive: `min-w-*` grows with its
 * content, and icon boxes dwarf the real findings. The risk is not in the CSS, it
 * is in the TEXT — a Chinese label that renders far wider than the English one it
 * replaced, inside a container whose width was chosen for that English.
 *
 * So measure the strings instead. For every catalog entry where `zh` is much
 * WIDER than `en` (CJK glyphs are full-width, so count them as 2), report it. A
 * ratio near or below 1 is fine; the interesting set is where Chinese is the
 * longer of the two and is already long in absolute terms.
 *
 * Usage:
 *   node tools/audit-label-widths.mjs [--json] [--min-px 150] [--ratio 1.0]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const minPx = Number(
  args.includes("--min-px") ? args[args.indexOf("--min-px") + 1] : 150,
);
const minRatio = Number(
  args.includes("--ratio") ? args[args.indexOf("--ratio") + 1] : 1.0,
);

async function load(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, rel.replace(/[\\/]/g, "_").replace(/\.ts$/, ".mjs"));
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-w-"));
const en = await load("src/i18n/messages/en.ts", dir);
const zh = await load("src/i18n/messages/zh.ts", dir);

/** Approximate rendered width in px at the app's 12–14px body size. */
function width(text) {
  let w = 0;
  for (const ch of text) {
    if (/[\u3000-\u9fff\uff00-\uffef\u4e00-\u9fff]/.test(ch)) w += 13;
    else if (/[iIl1.,:;'|!\[\]()]/.test(ch)) w += 4;
    else if (/[A-Z]/.test(ch)) w += 9;
    else w += 8;
  }
  return Math.round(w);
}

/** Files that actually render a given key, so a finding can be located. */
function indexUsages() {
  const map = new Map();
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(n)) {
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/\(\s*"([a-zA-Z][\w$]*)"/g)) {
          if (!map.has(m[1])) map.set(m[1], relative(process.cwd(), p).replace(/\\/g, "/"));
        }
      }
    }
  };
  walk(join(process.cwd(), "src"));
  return map;
}
const usage = indexUsages();

const rows = [];
(function walk(obj, ns) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      walk(v, ns ?? k);
      continue;
    }
    if (typeof v !== "string") continue;
    // `untranslated` holds English in BOTH catalogs and nothing references it, so
    // every one of its entries shows up as a 1.0-ratio "risk". Excluded.
    if (ns === "untranslated") continue;
    const enVal = ns ? en[ns]?.[k] : undefined;
    if (typeof enVal !== "string") continue;
    // Skip ICU/rich markup: it does not render as text.
    const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "");
    const wEn = width(clean(enVal));
    const wZh = width(clean(v));
    if (wZh < minPx) continue;
    const ratio = wEn === 0 ? 99 : wZh / wEn;
    if (ratio < minRatio) continue;
    rows.push({
      namespace: ns,
      key: k,
      en: clean(enVal),
      zh: clean(v),
      enPx: wEn,
      zhPx: wZh,
      ratio: Number(ratio.toFixed(2)),
      file: usage.get(k) ?? null,
    });
  }
})(zh, null);

rows.sort((a, b) => b.zhPx - a.zhPx);

if (asJson) {
  console.log(JSON.stringify({ total: rows.length, rows }, null, 2));
} else {
  console.log(
    `Labels where Chinese is >= ${minRatio}x the English width AND wider than ${minPx}px: ${rows.length}\n`,
  );
  console.log(
    "These are the ones most likely to overflow or wrap inside a control that was\n" +
      "sized for the English string. Widest first.\n",
  );
  for (const r of rows.slice(0, 30)) {
    console.log(
      `  ${r.zhPx}px (en ${r.enPx}px, ${r.ratio}x)  ${r.namespace}.${r.key}`,
    );
    console.log(`      zh: ${r.zh}`);
    console.log(`      en: ${r.en}`);
    if (r.file) console.log(`      used in: ${r.file}`);
    console.log();
  }
  if (rows.length > 30) console.log(`  ... and ${rows.length - 30} more`);
}
