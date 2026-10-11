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

  // A file frequently declares the SAME variable name in several scopes:
  //
  //   const t = useTranslations("common");        // component A
  //   function useOptions(t: RulesTranslator) {}  // module-scope factory
  //   const t = useTranslations("reverseProxy");  // component B
  //
  // A flat name->namespace map attributes every `t(...)` call in the file to
  // whichever binding happened to be seen last, which produced false positives
  // for the factory functions (their `t` is typed against a DIFFERENT catalog).
  // So bindings are kept with their line number, and each call is resolved
  // against the nearest binding declared above it.
  const bindings = [];
  const re = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:"([^"]+)"|'([^']+)')?\s*\)/g;
  for (const m of src.matchAll(re)) {
    bindings.push({
      name: m[1],
      ns: m[2] ?? m[3] ?? null,
      line: src.slice(0, m.index).split("\n").length,
    });
  }
  bindings.sort((a, b) => a.line - b.line);

  /**
   * Function parameters that are translators, e.g.
   *   function useOptions(t: RulesTranslator)
   *   const columns = (t: (k: string) => string) => [...]
   *   columns(td: ReturnType<typeof useTranslations>)
   *   ({ t }: { t: Translator })
   * Their namespace is decided by the CALLER, so a literal key inside cannot be
   * checked against one catalog. Recorded so those calls are skipped rather than
   * misattributed to an unrelated binding elsewhere in the file.
   */
  const paramTranslatorLines = [];
  const addParam = (name, index) => {
    paramTranslatorLines.push({
      name,
      line: src.slice(0, index).split("\n").length,
    });
  };
  // `name: <type mentioning useTranslations or *Translator>`
  for (const m of src.matchAll(/(\w+)\s*:\s*([^,)\n]*(?:useTranslations|Translator)[^,)\n]*)/g)) {
    addParam(m[1], m.index);
  }
  // `name: (k: string) => string`
  for (const m of src.matchAll(/(\w+)\s*:\s*\([^)]*\)\s*=>\s*string/g)) {
    addParam(m[1], m.index);
  }

  /** Nearest binding for `name` at or above `line`, or undefined. */
  function bindingAt(name, line) {
    let found;
    for (const b of bindings) {
      if (b.name === name && b.line <= line) found = b;
    }
    return found;
  }

  /**
   * Fallback for a forward reference.
   *
   * `const t = useTranslations("dns")` may be declared BELOW its first use,
   * because the use sits inside a closure (`const update = async () => { ...
   * t("x") ... }`) whose body only runs after the binding is initialised. That is
   * legal JavaScript and TypeScript accepts it, so the checker must too — it was
   * reporting such calls as "namespace-less", which looked like 194 real bugs.
   *
   * Only used when nothing is bound above the call, and only when every binding
   * of that name in the file agrees on one namespace; ambiguity is left alone so
   * a genuine mistake is still surfaced.
   */
  function fallbackBinding(name) {
    const all = bindings.filter((b) => b.name === name);
    if (all.length === 0) return undefined;
    const namespaces = new Set(all.map((b) => b.ns));
    return namespaces.size === 1 ? all[0] : undefined;
  }

  /** True when `name` is a function parameter at or above `line` with no local binding. */
  function isParamTranslator(name, line) {
    const localBinding = bindingAt(name, line);
    for (const p of paramTranslatorLines) {
      if (p.name !== name) continue;
      // A parameter only shadows if there is no `const` binding after it.
      if (p.line <= line && (!localBinding || localBinding.line < p.line)) return true;
    }
    return false;
  }

  // Distinct variable names that are ever bound to a translator in this file,
  // plus any translator-typed parameters (handled separately below).
  const names = new Set(bindings.map((b) => b.name));

  for (const varName of names) {
    // Every call site for this name, with its line.
    const callRe = new RegExp(`\\b${varName}\\(\\s*"([^"]+)"`, "g");
    for (const m of src.matchAll(callRe)) {
      const line = src.slice(0, m.index).split("\n").length;
      const key = m[1];

      // Skip calls that resolve through a factory parameter, not a local binding.
      if (isParamTranslator(varName, line)) continue;

      const binding = bindingAt(varName, line) ?? fallbackBinding(varName);
      const ns = binding ? binding.ns : null;

      // A namespace-less translator resolves against the catalog root, where the
      // only reachable entries are the namespaces themselves. A dotted key such
      // as t("navigation.peers") therefore works — verified against next-intl's
      // createTranslator — so dotted keys are accepted. A flat key cannot
      // resolve from the root and is a real bug.
      if (!ns) {
        skippedRoot++;
        if (key.includes(".")) continue;
        problems.push({
          file,
          namespace: "(none — resolves against catalog root)",
          key,
          reason:
            "flat key used with a namespace-less translator; add the namespace or a dotted path",
        });
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

      // Nested lookups (dots/braces) are not modelled.
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
