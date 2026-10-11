#!/usr/bin/env node
/**
 * Check that the English catalog still says what upstream says.
 *
 * The i18n layer is supposed to be a *pure* addition: every `en` value must be
 * byte-identical to the hardcoded English it replaced. A worker translating from
 * memory silently changed one ("You're all set!" became "You are all set!"),
 * which only surfaced because an upstream unit test asserted the original
 * wording. This finds the rest of that class of drift.
 *
 * Method: for each catalog value, look for the English literal it should match in
 * the upstream revision of the file(s) that now call the key. Rather than trying
 * to resolve call sites, it takes a cheaper and stricter route — collect every
 * string literal that exists in `upstream/main` under src/ and confirm each
 * catalog `en` value is either present there, or is genuinely new copy the
 * localization pass introduced.
 *
 * Values with no upstream match are reported for review, not as failures: the
 * pass legitimately added new strings (e.g. labels for markup that previously had
 * none). The point is to make the set small and reviewable.
 *
 * Usage:
 *   node tools/check-english-fidelity.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");
const REF = "upstream/main";

async function load(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, `${basename(rel).replace(/\.[jt]s$/, "")}.mjs`);
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-fidelity-"));
const en = await load("src/i18n/messages/en.ts", dir);

// Every file upstream ships under src/, plus the upstream test files (a test's
// expected strings are the strongest statement of the original wording).
const upstreamFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", REF, "src"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f && /\.(tsx?|ts)$/.test(f));

/** Concatenate the upstream text of every file once. */
let upstreamText = "";
for (const f of upstreamFiles) {
  try {
    upstreamText += execFileSync("git", ["show", `${REF}:${f}`], {
      encoding: "utf8",
      maxBuffer: 1 << 26,
    });
  } catch {
    /* binary or missing */
  }
}

/** Normalise for comparison: unify the HTML entities JSX requires. */
function norm(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const upstreamNorm = norm(upstreamText);

/**
 * Extract the actual user-visible string LITERALS from the upstream source.
 *
 * Comparing against raw file text (as a first attempt did) matches import lines
 * and comments, producing nonsense "upstream looks like: import type { Meta…".
 * Only quoted literals matter here.
 */
const upstreamLiterals = new Set();
for (const m of upstreamText.matchAll(/"([^"\\\n]{3,200})"|'([^'\\\n]{3,200})'|`([^`\\\n]{3,200})`/g)) {
  const lit = m[1] ?? m[2] ?? m[3];
  if (lit) upstreamLiterals.add(norm(lit));
}

/** Strip to comparable words: lowercase, letters/digits only. */
function words(s) {
  return norm(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * A near-miss is the real signal: the catalog value is NOT in upstream, but an
 * upstream literal is close to it word-for-word. That is a worker having
 * reworded upstream copy from memory — exactly how "You're all set!" silently
 * became "You are all set!".
 */
function nearMiss(value) {
  const w = words(value.replace(/\{[^}]*\}/g, " ").replace(/<\/?[a-z][^>]*>/g, " "));
  if (w.length < 3) return null;
  const target = w.join(" ");
  let best = null;
  for (const lit of upstreamLiterals) {
    const lw = words(lit);
    if (lw.length < 3) continue;
    const other = lw.join(" ");
    if (other === target) continue; // exact match would not be a near miss
    // Require a strong overlap: same leading words, small edit distance.
    const prefix = Math.min(3, w.length, lw.length);
    if (w.slice(0, prefix).join(" ") !== lw.slice(0, prefix).join(" ")) continue;
    const dist = Math.abs(lw.length - w.length);
    if (dist > Math.max(2, Math.round(w.length * 0.3))) continue;
    const score = prefix / Math.max(w.length, lw.length);
    if (!best || score > best.score) best = { literal: lit, score };
  }
  return best && best.score >= 0.5 ? best.literal : null;
}

const novel = [];
const suspects = [];
let matched = 0;
let total = 0;

(function walk(obj, ns, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") walk(v, ns ?? k, path);
    else if (typeof v === "string" && v.trim()) {
      total++;
      const needle = norm(v);
      if (needle.length < 3) {
        matched++;
        continue;
      }
      const plain = norm(
        v
          .replace(/\{[^}]*\}/g, " ")
          .replace(/<\/?[a-z][^>]*>/g, " ")
          .replace(/\{[^}]*,[^}]*\}/g, " "),
      );
      const probe = plain.length >= 3 ? plain : needle;
      if (upstreamNorm.includes(probe) || upstreamNorm.includes(needle)) {
        matched++;
      } else {
        const near = nearMiss(plain.length >= 3 ? plain : needle);
        novel.push({ namespace: ns, key: path, en: v });
        if (near) suspects.push({ namespace: ns, key: path, en: v, upstreamLooksLike: near });
      }
    }
  }
})(en, null, "");

if (asJson) {
  console.log(JSON.stringify({ total, matched, novelCount: novel.length, suspects, novel }, null, 2));
} else {
  console.log(`English catalog values: ${total}`);
  console.log(`  found verbatim in ${REF}: ${matched}`);
  console.log(`  NEW copy (not in upstream): ${novel.length}\n`);

  console.log("=== SUSPECTS: catalog text that looks like a REWORDED upstream string ===");
  console.log("(these are the fidelity bugs — the English UI would read differently)");
  if (suspects.length === 0) console.log("  none");
  for (const s of suspects.slice(0, 30)) {
    console.log(`\n  ${s.namespace}.${s.key}`);
    console.log(`    catalog : ${JSON.stringify(s.en).slice(0, 100)}`);
    console.log(`    upstream: ${JSON.stringify(s.upstreamLooksLike)}`);
  }
  if (suspects.length > 30) console.log(`\n  ... and ${suspects.length - 30} more`);
}
