#!/usr/bin/env node
/**
 * Compare the en/zh translation catalogs by their real key structure.
 *
 * A hand-rolled brace counter over the .ts source mis-nests on template
 * literals and ICU strings, so this compiles both catalogs with the project's
 * own TypeScript and walks the resulting objects. That gives the exact key
 * paths next-intl will resolve at runtime.
 *
 * Usage:
 *   node tools/check-catalog-parity.mjs [--json]
 *
 * Exit codes:
 *   0  keys present in zh for every en key (extra zh keys are reported only)
 *   1  at least one en key path is missing from zh
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");
const root = resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".");

const EN = join(root, "src/i18n/messages/en.ts");
const ZH = join(root, "src/i18n/messages/zh.ts");

/**
 * Transpile a catalog module and import it, so `export default {...}` with
 * nested objects, template literals and escaped quotes is parsed by the real
 * compiler rather than by a regex.
 */
async function loadCatalog(path, dir) {
  const source = await readFile(path, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;

  const out = join(dir, `${path.split(/[\\/]/).pop().replace(/\.ts$/, "")}.mjs`);
  await writeFile(out, js);
  const mod = await import(pathToFileURL(out).href);
  return mod.default ?? mod;
}

/** Flatten to dotted leaf paths. Arrays keep their index so reordering shows up. */
function leafPaths(value, prefix = "", acc = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => leafPaths(v, prefix ? `${prefix}[${i}]` : `[${i}]`, acc));
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      leafPaths(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  } else {
    acc.push(prefix);
  }
  return acc;
}

/** Every namespace path that exists (object interior), for reporting. */
function allPaths(value, prefix = "", acc = new Set()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const p = prefix ? `${prefix}.${k}` : k;
      acc.add(p);
      allPaths(v, p, acc);
    }
  }
  return acc;
}

const tmp = await mkdtemp(join(tmpdir(), "nb-catalog-"));
try {
  const [en, zh] = await Promise.all([loadCatalog(EN, tmp), loadCatalog(ZH, tmp)]);

  const enLeaves = new Set(leafPaths(en));
  const zhLeaves = new Set(leafPaths(zh));
  const enAll = allPaths(en);
  const zhAll = allPaths(zh);

  const missingInZh = [...enLeaves].filter((k) => !zhLeaves.has(k)).sort();
  const extraInZh = [...zhLeaves].filter((k) => !enLeaves.has(k)).sort();

  // Untranslated check: zh value identical to en value. Some are legitimately
  // the same (product names, "NetBird"), so this is informational.
  const identical = [];
  const enFlat = new Map();
  (
    function walk(v, p = "") {
      if (v !== null && typeof v === "object") {
        for (const [k, val] of Object.entries(v)) walk(val, p ? `${p}.${k}` : k);
      } else enFlat.set(p, v);
    }
  )(en);
  (
    function walk(v, p = "") {
      if (v !== null && typeof v === "object") {
        for (const [k, val] of Object.entries(v)) walk(val, p ? `${p}.${k}` : k);
      } else if (enFlat.get(p) === v && typeof v === "string" && v.trim()) {
        identical.push(p);
      }
    }
  )(zh);

  const report = {
    enKeys: enLeaves.size,
    zhKeys: zhLeaves.size,
    enNamespaces: enAll.size,
    zhNamespaces: zhAll.size,
    missingInZh,
    extraInZh,
    identicalValues: identical.sort(),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`en leaf keys: ${report.enKeys}   zh leaf keys: ${report.zhKeys}`);
    console.log(`en namespace paths: ${report.enNamespaces}   zh namespace paths: ${report.zhNamespaces}`);

    if (missingInZh.length) {
      console.log(`\nMISSING in zh.ts (${missingInZh.length}):`);
      for (const k of missingInZh.slice(0, 40)) console.log(`  - ${k}`);
      if (missingInZh.length > 40) console.log(`  ... and ${missingInZh.length - 40} more`);
    } else {
      console.log("\nOK: zh.ts covers every en.ts key path");
    }

    if (extraInZh.length) {
      console.log(`\nORPHAN keys in zh.ts (${extraInZh.length}):`);
      for (const k of extraInZh.slice(0, 25)) console.log(`  + ${k}`);
      if (extraInZh.length > 25) console.log(`  ... and ${extraInZh.length - 25} more`);
    } else {
      console.log("OK: zh.ts has no orphan keys");
    }

    console.log(
      `\nValues identical to English: ${identical.length}` +
        (identical.length ? " (informational — product names are expected)" : ""),
    );
    for (const k of identical.slice(0, 20)) console.log(`  = ${k}`);
    if (identical.length > 20) console.log(`  ... and ${identical.length - 20} more`);
  }

  process.exitCode = missingInZh.length ? 1 : 0;
} finally {
  await rm(tmp, { recursive: true, force: true });
}
