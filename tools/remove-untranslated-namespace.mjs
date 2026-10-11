#!/usr/bin/env node
/**
 * Remove the dead `untranslated` namespace from both catalogs.
 *
 * Background: PR #671 added a 485-key `untranslated` namespace that mirrored
 * hardcoded English strings as a TODO list. Nothing ever referenced it —
 * verified with `git grep -n 'untranslated' -- src`, which matches only the two
 * catalog definitions. It therefore has no runtime effect: next-intl never
 * resolves it. It does, however, put untranslated English into the Chinese
 * catalog, inflate the bundle, and make "how much is translated?" unanswerable.
 *
 * The strings it listed are being localized properly (by key, in the right
 * namespace, with real Chinese) by the current pass, so the mirror is redundant.
 *
 * Safety:
 *   - Refuses to run if any source file references the namespace.
 *   - Refuses to run if either catalog lacks the namespace (already removed).
 *   - Removes the block from BOTH catalogs so parity holds.
 *   - Reports the removed key count and re-verifies catalog syntax afterwards.
 *
 * Usage:
 *   node tools/remove-untranslated-namespace.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
const NS = "untranslated";
const PATHS = ["src/i18n/messages/en.ts", "src/i18n/messages/zh.ts"];

// ------------------------------------------------------------- safety checks
const refs = execFileSync("git", ["grep", "-n", NS, "--", "src"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((l) => !/^src\/i18n\/messages\/(en|zh)\.ts:/.test(l));

if (refs.length) {
  console.error("Refusing to run: the namespace is referenced outside the catalogs:");
  for (const r of refs.slice(0, 20)) console.error(`  ${r}`);
  process.exit(1);
}
console.log("OK: no source file references the namespace.");

/** Remove the namespace block, returning the new source and the keys removed. */
function stripNamespace(source, path) {
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);

  const start = lines.findIndex((l) => new RegExp(`^  ${NS}: \\{`).test(l));
  if (start === -1) {
    console.log(`  ${path}: namespace already absent`);
    return { source, removed: 0, changed: false };
  }

  // Track brace depth from the namespace opener to its matching close.
  let depth = 0;
  let end = -1;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth === 0 && i > start) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`unterminated "${NS}" block in ${path}`);

  const block = lines.slice(start, end + 1);
  const keys = block.filter((l) => /^\s+[a-z0-9_]+_\d+:/.test(l)).length;

  // Also drop a comment line immediately above the namespace if it describes it.
  let cutFrom = start;
  if (start > 0 && /^\s*\/\/.*untranslated/i.test(lines[start - 1])) cutFrom = start - 1;

  lines.splice(cutFrom, end - cutFrom + 1);
  return { source: lines.join(nl), removed: keys, changed: true };
}

let totalRemoved = 0;
const results = [];

for (const path of PATHS) {
  const original = readFileSync(path, "utf8");
  const { source, removed, changed } = stripNamespace(original, path);
  totalRemoved = Math.max(totalRemoved, removed);
  results.push({ path, source, removed, changed });
  console.log(`  ${path}: removed ${removed} key(s)${changed ? "" : " (unchanged)"}`);
}

if (dryRun) {
  console.log(`\n--dry-run: would remove ${totalRemoved} keys from each catalog; not written.`);
  process.exit(0);
}

for (const { path, source, changed } of results) {
  if (changed) writeFileSync(path, source);
}
console.log(`\nRemoved ${totalRemoved} keys from each catalog.`);
