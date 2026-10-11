#!/usr/bin/env node
/**
 * Find layouts that Chinese text breaks but English survives.
 *
 * CJK glyphs are full-width: a 2-character label occupies roughly four Latin
 * characters, and CJK has no spaces so it cannot wrap at word boundaries. A box
 * sized for the English string therefore either wraps mid-word (one character
 * per line) or overflows — both of which look like "the box is the wrong size".
 *
 * The audit looks for the shapes that actually cause it:
 *
 *   1. a FIXED width or min-width on an element that also renders a translated
 *      label (`w-[80px]`, `min-w-[120px]`, `basis-[6rem]`) — the English fit, the
 *      Chinese does not;
 *   2. a FIXED height (`h-[42px]`, `h-10`) containing translated text that may
 *      wrap to a second line;
 *   3. `truncate`/`whitespace-nowrap` on a translated label inside a narrow
 *      container — clips Chinese instead of wrapping;
 *   4. explicit `w-`,`min-w-`,`max-w-` numeric Tailwind utilities near t() output.
 *
 * Reported with the label and the class so a human can judge, because the correct
 * fix differs per case (widen, allow wrap, or shorten the translation).
 *
 * Usage:
 *   node tools/audit-cjk-layout.mjs [--json]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const asJson = process.argv.includes("--json");
const ROOT = process.cwd();

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(n) && !/\.(test|stories)\./.test(n)) out.push(p);
  }
  return out;
}

/** Class strings that pin a dimension. */
const FIXED_W = /\b(?:w|min-w|basis)-\[(\d+(?:\.\d+)?)(px|rem)\]|\b(?:w|min-w)-(\d{1,3})\b/g;
const FIXED_MAXW = /\bmax-w-\[(\d+(?:\.\d+)?)(px|rem)\]/g;
const FIXED_H = /\bh-\[(\d+(?:\.\d+)?)(px|rem)\]|\bh-(\d{1,3})\b/g;
/** Tailwind numeric spacing: 1 unit = 0.25rem = 4px. */
const UNIT_PX = 4;

function px(value, unit, numeric) {
  if (numeric !== undefined) return Number(numeric) * UNIT_PX;
  return unit === "rem" ? Number(value) * 16 : Number(value);
}

const findings = [];

for (const file of walk(join(ROOT, "src"))) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const lines = src.split("\n");

  lines.forEach((line, idx) => {
    // Only lines where a translated label is rendered in the SAME element as the
    // fixed size. Matching a size anywhere near a t() call flags icons (`w-2`,
    // `h-4`) and layout wrappers, which is 90% of the output and none of the
    // problem.
    const rendersLabel = /\bt[A-Za-z]*\s*\(|\bt\.rich\s*\(/.test(line);
    if (!rendersLabel) return;
    // An icon-sized box cannot hold text; ignore anything under ~48px wide/24px tall.
    const isIconish = (n) => n > 0 && n < 48;

    for (const m of line.matchAll(FIXED_W)) {
      const width = px(m[1], m[2], m[3]);
      if (width === 0 || width > 420 || isIconish(width)) continue;
      findings.push({
        kind: "fixed-width",
        file: rel,
        line: idx + 1,
        px: width,
        class: m[0],
        text: line.trim().slice(0, 110),
      });
    }
    for (const m of line.matchAll(FIXED_MAXW)) {
      const width = px(m[1], m[2]);
      if (width === 0 || width > 420 || isIconish(width)) continue;
      findings.push({
        kind: "fixed-max-width",
        file: rel,
        line: idx + 1,
        px: width,
        class: m[0],
        text: line.trim().slice(0, 110),
      });
    }
    for (const m of line.matchAll(FIXED_H)) {
      const height = px(m[1], m[2], m[3]);
      if (height === 0 || height > 64 || height < 24) continue;
      findings.push({
        kind: "fixed-height",
        file: rel,
        line: idx + 1,
        px: height,
        class: m[0],
        text: line.trim().slice(0, 110),
      });
    }
    // Clipping a translated label inside a narrow box is the other half of the
    // problem: Chinese cannot wrap at word boundaries, so nowrap clips it.
    if (/\b(truncate|whitespace-nowrap)\b/.test(line)) {
      findings.push({
        kind: "clip-or-nowrap",
        file: rel,
        line: idx + 1,
        px: null,
        class: (line.match(/\b(truncate|whitespace-nowrap)\b/) ?? [""])[0],
        text: line.trim().slice(0, 110),
      });
    }
  });
}

// Group by kind then file so a reader can work through one class of problem.
const byKind = new Map();
for (const f of findings) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, []);
  byKind.get(f.kind).push(f);
}

if (asJson) {
  console.log(JSON.stringify({ total: findings.length, findings }, null, 2));
} else {
  console.log(`CJK layout risks: ${findings.length}\n`);
  for (const [kind, list] of byKind) {
    console.log(`== ${kind} (${list.length}) ==`);
    for (const f of list.slice(0, 18)) {
      console.log(`  ${f.file}:${f.line}  ${f.class}${f.px ? ` (${f.px}px)` : ""}`);
      console.log(`      ${f.text}`);
    }
    if (list.length > 18) console.log(`  ... and ${list.length - 18} more`);
    console.log();
  }
}
