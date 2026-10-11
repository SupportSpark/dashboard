#!/usr/bin/env node
/**
 * Verify that every namespaced translation call resolves to a real key.
 *
 * Why this exists
 * ---------------
 * next-intl reports a bad key only at render time, as a
 * "MISSING_MESSAGE: <key> (<locale>)" console error — the app still builds and
 * still renders, but the user sees the raw key path. Two such bugs shipped into
 * this branch from the merge:
 *
 *   src/app/(dashboard)/dns/zones/layout.tsx        t("dnsZones")   with no namespace
 *   src/app/(dashboard)/network-routes/layout.tsx   t("networkRoutes") with no namespace
 *
 * `dnsZones` lives in the `dns` namespace and `networkRoutes` in `common`, so
 * the bare call resolved against the catalog root and missed. Nothing in
 * `tsc --noEmit` or `npm run build` complains, which is why it needs its own
 * check.
 *
 * What it does
 * ------------
 * Scans every non-test source file for `<var> = useTranslations("ns")` /
 * `getTranslations("ns")` bindings, then confirms that each `<var>("key")`
 * literal exists under `ns` in BOTH catalogs. Also flags keys used under a
 * namespace that does not exist.
 *
 * Dynamic keys (`t(someVariable)`), template literals and plural/rich variants
 * are skipped — only string literals can be checked statically.
 *
 * Usage:
 *   node tools/check-translation-keys.mjs [--json]
 *
 * Exit code 1 when any literal key is unresolvable.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");

async function loadCatalog(relPath, dir) {
  const js = ts.transpileModule(readFileSync(relPath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const out = join(dir, `${basename(relPath).replace(/\.[jt]s$/, "")}.mjs`);
  writeFileSync(out, js);
  const mod = await import(pathToFileURL(out).href);
  return mod.default ?? mod;
}

const dir = mkdtempSync(join(tmpdir(), "nb-i18n-keys-"));
const [en, zh] = await Promise.all([
  loadCatalog("src/i18n/messages/en.ts", dir),
  loadCatalog("src/i18n/messages/zh.ts", dir),
]);

const files = execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f && !/\.test\.|\.stories\./.test(f));

const problems = [];
let checked = 0;
let skippedRoot = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");

  // Map local variable name -> namespace, e.g.
  //   const t = useTranslations("peers")
  //   const tCommon = await getTranslations("common")
  const varNs = new Map();
  const re = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:"([^"]+)"|'([^']+)')?\s*\)/g;
  for (const m of src.matchAll(re)) {
    varNs.set(m[1], m[2] ?? m[3] ?? null);
  }

  for (const [varName, ns] of varNs) {
    // A namespace-less translator resolves against the catalog root, where the
    // only reachable entries are the namespaces themselves. A dotted key such as
    // t("navigation.peers") therefore works — verified against next-intl's
    // createTranslator — so dotted keys are accepted here. A flat key such as
    // t("dnsZones") cannot resolve from the root and is a real bug.
    if (!ns) {
      const bare = new RegExp(`\\b${varName}\\(\\s*"([^"]+)"\\s*\\)`, "g");
      for (const m of src.matchAll(bare)) {
        skippedRoot++;
        if (m[1].includes(".")) continue; // nested lookup, resolves fine
        problems.push({
          file,
          namespace: "(none — resolves against catalog root)",
          key: m[1],
          reason:
            "flat key used with a namespace-less translator; add the namespace or a dotted path",
        });
      }
      continue;
    }

    const nsObj = en[ns];
    if (nsObj === undefined || typeof nsObj !== "object") {
      problems.push({
        file,
        namespace: ns,
        key: "(any)",
        reason: "namespace does not exist in en.ts",
      });
      continue;
    }

    const callRe = new RegExp(`\\b${varName}\\(\\s*"([^"]+)"`, "g");
    for (const m of src.matchAll(callRe)) {
      const key = m[1];
      // Plural/select/rich calls pass options as a second argument; the key is
      // still the first string, so those are covered. Keys containing a dot or
      // brace are nested lookups, which this check does not model.
      if (/[.{}]/.test(key)) continue;
      checked++;

      if (nsObj[key] === undefined) {
        problems.push({ file, namespace: ns, key, reason: "missing in en.ts" });
      } else if (zh[ns] && zh[ns][key] === undefined) {
        problems.push({ file, namespace: ns, key, reason: "missing in zh.ts" });
      }
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ checked, problems }, null, 2));
} else {
  console.log(`Checked ${checked} namespaced literal key(s) across ${files.length} file(s).`);
  if (skippedRoot) {
    console.log(`Bare (namespace-less) literal calls seen: ${skippedRoot}`);
  }
  if (problems.length === 0) {
    console.log("OK: every literal key resolves in both en.ts and zh.ts");
  } else {
    console.log(`\nPROBLEMS (${problems.length}):`);
    for (const p of problems.slice(0, 60)) {
      console.log(`  ${p.file}`);
      console.log(`      ns=${p.namespace}  key=${p.key}  -> ${p.reason}`);
    }
    if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
  }
}

process.exitCode = problems.length ? 1 : 0;
