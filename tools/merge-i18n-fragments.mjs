#!/usr/bin/env node
/**
 * Merge translation fragments into the en/zh catalogs.
 *
 * Why fragments
 * -------------
 * A localization pass of this size has many files to edit and one shared pair of
 * catalogs. If every worker edited `en.ts`/`zh.ts` directly they would overwrite
 * each other. Instead each worker owns a *fragment* file:
 *
 *   i18n-fragments/<worker>.json
 *   {
 *     "integrations": {
 *       "oktaSetupTitle": { "en": "Set up Okta", "zh": "配置 Okta" }
 *     }
 *   }
 *
 * Disjoint fragment paths mean no write contention, and this script is the
 * single writer for the catalogs.
 *
 * Usage:
 *   node tools/merge-i18n-fragments.mjs [--dry-run] [--dir i18n-fragments]
 *
 * Behaviour:
 *   - Adds a key when the target namespace lacks it.
 *   - Never overwrites an existing catalog value (safe to re-run).
 *   - Creates the namespace if it does not exist yet.
 *   - Writes both catalogs so `check-catalog-parity` stays satisfied.
 *   - Exits non-zero if a fragment is malformed or an en/zh pair is incomplete,
 *     so a bad fragment cannot half-apply.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirIdx = args.indexOf("--dir");
const FRAG_DIR = dirIdx !== -1 ? args[dirIdx + 1] : "i18n-fragments";

const EN_PATH = "src/i18n/messages/en.ts";
const ZH_PATH = "src/i18n/messages/zh.ts";

if (!existsSync(FRAG_DIR)) {
  console.log(`No fragment directory at ${FRAG_DIR}; nothing to do.`);
  process.exit(0);
}

const fragmentFiles = readdirSync(FRAG_DIR).filter((f) => f.endsWith(".json")).sort();
if (fragmentFiles.length === 0) {
  console.log(`No .json fragments in ${FRAG_DIR}; nothing to do.`);
  process.exit(0);
}

// ---------------------------------------------------------------- validate
const errors = [];
const merged = new Map(); // namespace -> Map(key -> {en, zh, sources:[]})

for (const file of fragmentFiles) {
  const path = join(FRAG_DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    errors.push(`${file}: invalid JSON (${err.message})`);
    continue;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push(`${file}: top level must be an object of namespaces`);
    continue;
  }

  for (const [ns, entries] of Object.entries(data)) {
    if (ns.startsWith("_")) continue; // allow "_comment" metadata keys
    if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
      errors.push(`${file}: namespace "${ns}" must be an object`);
      continue;
    }
    if (!merged.has(ns)) merged.set(ns, new Map());

    for (const [key, pair] of Object.entries(entries)) {
      if (typeof pair !== "object" || pair === null) {
        errors.push(`${file}: ${ns}.${key} must be {en, zh}`);
        continue;
      }
      const { en, zh } = pair;
      if (typeof en !== "string" || !en.trim()) {
        errors.push(`${file}: ${ns}.${key} has no "en" string`);
        continue;
      }
      if (typeof zh !== "string" || !zh.trim()) {
        errors.push(`${file}: ${ns}.${key} has no "zh" string`);
        continue;
      }
      // A zh value that is byte-identical to en is almost always a missed
      // translation, but legitimate for brand names and acronyms. Warn only for
      // multi-word prose.
      if (en === zh && /\s/.test(en) && en.split(/\s+/).length > 2) {
        errors.push(`${file}: ${ns}.${key} zh is identical to en ("${en}") - translate or confirm`);
        continue;
      }

      const existing = merged.get(ns).get(key);
      if (existing) {
        if (existing.en !== en || existing.zh !== zh) {
          errors.push(
            `${file}: ${ns}.${key} conflicts with ${existing.sources.join(", ")} ` +
              `(en "${existing.en}" vs "${en}")`,
          );
        } else {
          existing.sources.push(file);
        }
      } else {
        merged.set(ns, new Map(merged.get(ns)));
        merged.get(ns).set(key, { en, zh, sources: [file] });
      }
    }
  }
}

if (errors.length) {
  console.error(`Fragment validation failed (${errors.length} problem(s)):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ------------------------------------------------------------------- merge
/** Insert keys into the namespace block of a catalog source string. */
function applyToCatalog(source, pairs, locale) {
  const lines = source.split("\n");
  let added = 0;
  let skipped = 0;

  for (const [ns, entries] of pairs) {
    let nsStart = lines.findIndex((l) => new RegExp(`^  ${ns}: \\{`).test(l));
    if (nsStart === -1) {
      // Create the namespace inside the exported object. The catalog ends with
      // `  },\n};` (or `  }\n};`), so the insertion point is the LAST line that
      // closes a namespace — i.e. the line before the final `};`. Splicing after
      // the object's own closing brace would produce invalid JavaScript.
      let lastClose = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i] === "};") continue; // the export's own terminator
        if (/^\s*\},?\s*$/.test(lines[i])) {
          lastClose = i;
          break;
        }
      }
      const at = lastClose === -1 ? lines.length - 1 : lastClose + 1;
      lines.splice(at, 0, `  ${ns}: {`, `  },`);
      nsStart = at;
    }

    // Find the end of this namespace block by brace depth.
    let depth = 0;
    let nsEnd = -1;
    for (let i = nsStart; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth === 0 && i > nsStart) {
        nsEnd = i;
        break;
      }
    }
    if (nsEnd === -1) throw new Error(`unterminated namespace "${ns}" while merging`);

    const insertions = [];
    for (const [key, { en, zh }] of entries) {
      const value = locale === "en" ? en : zh;
      if (lines.slice(nsStart, nsEnd).some((l) => new RegExp(`^\\s+"?${key}"?:`).test(l))) {
        skipped++;
        continue;
      }
      const insertAt = nsEnd;
      const needsWrap = value.length > 60;
      insertions.push(
        needsWrap
          ? [`    ${key}:`, `      ${JSON.stringify(value)},`]
          : [`    ${key}: ${JSON.stringify(value)},`],
      );
      added++;
    }
    // Insert before the namespace's closing line, keeping the block balanced.
    for (const chunk of insertions.reverse()) {
      lines.splice(nsEnd, 0, ...chunk);
    }
  }

  return { source: lines.join("\n"), added, skipped };
}

const enSrc = readFileSync(EN_PATH, "utf8").replace(/\r\n/g, "\n");
const zhSrc = readFileSync(ZH_PATH, "utf8").replace(/\r\n/g, "\n");
const hadCrlfEn = readFileSync(EN_PATH, "utf8").includes("\r\n");
const hadCrlfZh = readFileSync(ZH_PATH, "utf8").includes("\r\n");

let totalKeys = 0;
for (const [, m] of merged) totalKeys += m.size;

console.log(`Fragments: ${fragmentFiles.length}`);
console.log(`Namespaces touched: ${merged.size}`);
console.log(`Keys to merge: ${totalKeys}\n`);

const enOut = applyToCatalog(enSrc, merged, "en");
const zhOut = applyToCatalog(zhSrc, merged, "zh");

console.log(`en.ts: +${enOut.added} added, ${enOut.skipped} already present`);
console.log(`zh.ts: +${zhOut.added} added, ${zhOut.skipped} already present`);

const byNs = [...merged].map(([ns, m]) => [ns, m.size]).sort((a, b) => b[1] - a[1]);
console.log("\nBy namespace:");
for (const [ns, n] of byNs.slice(0, 25)) console.log(`  ${String(n).padStart(4)}  ${ns}`);

if (dryRun) {
  console.log("\n--dry-run: catalog files not written.");
  process.exit(0);
}

writeFileSync(EN_PATH, hadCrlfEn ? enOut.source.replace(/\n/g, "\r\n") : enOut.source);
writeFileSync(ZH_PATH, hadCrlfZh ? zhOut.source.replace(/\n/g, "\r\n") : zhOut.source);
console.log("\nCatalogs written.");
