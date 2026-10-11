import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

/**
 * Recover the English text an interrupted worker replaced with t("key") but
 * never recorded in its fragment.
 *
 * The worker edited the call sites first and died before writing the fragment,
 * so the keys resolve to nothing. The original English survives in the UPSTREAM
 * revision of the same files, which is where the call-site text came from.
 */

const ROOT = process.cwd();
const KEYS = process.argv.slice(2);
if (KEYS.length === 0) {
  console.error("usage: node tools/recover-missing-keys.mjs <key> [key...]");
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(n)) out.push(p);
  }
  return out;
}
const files = walk(join(ROOT, "src"));

for (const key of KEYS) {
  const hits = [];
  const re = new RegExp(`t(?:Common|[A-Za-z]*)?\\(\\s*"${key}"`, "g");
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!re.test(src)) continue;
    re.lastIndex = 0;
    const rel = relative(ROOT, f).replace(/\\/g, "/");

    // What upstream has at the same place. The worker's diff removed the English
    // literal, so compare this file against upstream/main line-wise.
    let upstreamLines = [];
    try {
      upstreamLines = execFileSync("git", ["show", `upstream/main:${rel}`], {
        encoding: "utf8",
        maxBuffer: 1 << 26,
      }).split("\n");
    } catch {
      /* file is new in this branch */
    }
    const cur = src.split("\n");

    // Print the call site and a small window around it, plus any obvious English
    // literal that upstream had near the same region.
    const lines = src.split("\n");
    for (const m of src.matchAll(re)) {
      const lineNo = src.slice(0, m.index).split("\n").length;
      const ctx = lines.slice(Math.max(0, lineNo - 3), lineNo + 2);
      console.log(`\n${key}  (${rel}:${lineNo})`);
      ctx.forEach((l, i) => console.log(`   ${i === 3 ? ">" : " "} ${l.trim().slice(0, 110)}`));
    }

    // Upstream English literals present in that file but GONE from the current
    // one are exactly what the worker replaced.
    const upstreamText = upstreamLines.join("\n");
    const gone = [];
    for (const mm of upstreamText.matchAll(/"([^"\\\n]{3,160})"/g)) {
      const lit = mm[1];
      if (!/[A-Za-z]/.test(lit)) continue;
      if (/^[a-z0-9-_/.[\]@]+$/.test(lit)) continue; // class names, paths, ids
      if (!src.includes(`"${lit}"`)) gone.push(lit);
    }
    if (gone.length) {
      console.log("   upstream literals no longer in this file:");
      for (const g of [...new Set(gone)].slice(0, 40)) console.log(`     - ${JSON.stringify(g)}`);
    }
    hits.push(rel);
  }
  if (hits.length === 0) console.log(`\n${key}: NO CALL SITE FOUND`);
}
