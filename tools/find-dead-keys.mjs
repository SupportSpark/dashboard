#!/usr/bin/env node
/**
 * Find catalog keys that no component ever references (dead translation keys).
 *
 * Dead keys are not a correctness bug — next-intl ignores them — but they cost
 * bundle size, mislead translators (the `untranslated` namespace from PR #671 was
 * 485 such keys), and hide the real coverage number.
 *
 * A key is considered USED if its literal name appears in any non-test source
 * file, either as t("key"), t("ns.key"), t.rich("key", ...), or inside a
 * generateMetadata call. Keys are matched by bare name rather than by
 * resolved namespace because several modules legitimately read the same key name
 * from different namespaces, and double-counting a false positive is safer than
 * deleting a live string.
 *
 * Usage:
 *   node tools/find-dead-keys.mjs [--json] [--namespace <ns>]
 *
 * Exit code is always 0; this is a review aid.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const nsIdx = args.indexOf("--namespace");
const onlyNs = nsIdx !== -1 ? args[nsIdx + 1] : null;

async function load(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, `${basename(rel).replace(/\.[jt]s$/, "")}.mjs`);
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-dead-"));
const en = await load("src/i18n/messages/en.ts", dir);

const files = execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f && !/\.test\.|\.stories\.|src\/i18n\//.test(f));

// Concatenate all source once and test membership by substring, which is far
// cheaper than 2600 regex passes.
const haystack = files.map((f) => readFileSync(f, "utf8")).join("\n");

/** Sink 1: the key name appears as a quoted string literal anywhere. */
function referencedAnywhere(key) {
  return (
    haystack.includes(`"${key}"`) ||
    haystack.includes(`'${key}'`) ||
    haystack.includes(`\`${key}\``) ||
    haystack.includes(`.${key}"`) ||
    haystack.includes(`.${key}'`)
  );
}

const dead = [];
let total = 0;

// Walk each top-level namespace separately so the namespace is known.
for (const [ns, nsObj] of Object.entries(en)) {
  if (onlyNs && ns !== onlyNs) continue;
  if (!nsObj || typeof nsObj !== "object") continue;

  (function walk(obj, prefix) {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") {
        walk(v, path);
      } else if (typeof v === "string") {
        total++;
        // Match on the leaf key; the full dotted path is also tried, since some
        // call sites use t("namespace.key") from a root translator.
        if (!referencedAnywhere(path) && !referencedAnywhere(k)) {
          dead.push({ namespace: ns, key: path, leaf: k, value: v });
        }
      }
    }
  })(nsObj, "");
}

// Group by namespace for reporting.
const byNs = new Map();
for (const d of dead) {
  byNs.set(d.namespace, (byNs.get(d.namespace) ?? 0) + 1);
}

if (asJson) {
  console.log(JSON.stringify({ totalKeys: total, deadKeys: dead.length, byNamespace: [...byNs], dead }, null, 2));
} else {
  console.log(`Catalog keys: ${total}`);
  console.log(`Possibly dead keys: ${dead.length} (${((dead.length / total) * 100).toFixed(1)}%)\n`);
  console.log("By namespace (top 25):");
  for (const [ns, n] of [...byNs].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(4)}  ${ns}`);
  }
  console.log("\nSample:");
  for (const d of dead.slice(0, 15)) {
    console.log(`  ${d.namespace}.${d.key} = ${JSON.stringify(d.value).slice(0, 70)}`);
  }
  console.log(
    "\nNOTE: a key can be reported dead while still being used through a variable" +
      "\n      (e.g. t(`prefix_${x}`)). Confirm before deleting.",
  );
}
