#!/usr/bin/env node
/**
 * Add missing translator bindings left behind by interrupted workers.
 *
 * Several localization workers referenced `tPolicies`, `tGroups`, `tUsers`, … in
 * component bodies but never declared them, so `tsc` reports TS2304/TS2552. The
 * fix is mechanical: insert the missing binding next to the translator the file
 * already declares, in the same scope.
 *
 * How scope is decided: for each error position, walk backwards to the nearest
 * preceding `const tXxx = useTranslations("…")` and insert the new binding
 * directly after it, copying that line's indentation. That keeps the new binding
 * in the same function scope as the reference, which is where the existing
 * translator already is.
 *
 * Idempotent: a binding that is already declared anywhere in the file's target
 * scope is not added again.
 *
 * Usage:
 *   node tools/fix-missing-bindings.mjs [--dry-run]
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");

/** tName -> namespace */
const PREFIX_TO_NS = {
  tCommon: "common",
  tPolicies: "policies",
  tGroups: "groups",
  tUsers: "users",
  tPeers: "peers",
  tNetworks: "networks",
  tSettings: "settings",
  tServiceUsers: "serviceUsers",
  tSetupKeys: "setupKeys",
  tPostureChecks: "postureChecks",
  tRoutes: "routes",
  tDns: "dns",
  tActivity: "activity",
  tOnboarding: "onboarding",
  tReverseProxy: "reverseProxy",
  tIntegrations: "integrations",
  tTable: "table",
  tNavigation: "navigation",
  tAuth: "auth",
};

function tscErrors() {
  // Run the local TypeScript compiler through node directly. Spawning `npx` fails
  // on Windows (it is a .cmd shim, not an executable), and the failure is silent
  // enough that the caller sees "no errors" and does nothing.
  let out = "";
  const candidates = [
    ["node", ["node_modules/typescript/bin/tsc", "--noEmit"]],
    ["node", ["node_modules/.bin/tsc", "--noEmit"]],
  ];
  for (const [cmd, args] of candidates) {
    try {
      out = execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
      break;
    } catch (e) {
      // tsc exits 1 when it finds errors; that is the normal path.
      if (e.stdout || e.stderr) {
        out = (e.stdout ?? "") + (e.stderr ?? "");
        break;
      }
    }
  }
  const errs = [];
  for (const line of out.split("\n")) {
    // file(line,col): error TS2304: Cannot find name 'x'.
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS(?:2304|2552): Cannot find name '(\w+)'/);
    if (m) errs.push({ file: m[1].replace(/\\/g, "/"), line: Number(m[2]), name: m[4] });
  }
  return errs;
}

/**
 * Line index where the function enclosing `lineIdx` starts.
 *
 * Approximated by scanning upwards for a line that closes a brace at
 * indentation 0 (`};` / `}` / `) => {`-style endings) — good enough for the
 * component-per-function layout these files use, and it only ever widens the
 * search window, so a miss degrades to "no binding found" rather than to a
 * binding inserted in the wrong place.
 */
function enclosingScopeStart(lines, lineIdx) {
  for (let i = lineIdx; i >= 0; i--) {
    const l = lines[i];
    if (/^(export\s+)?(default\s+)?(async\s+)?function\s/.test(l)) return i;
    if (/^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/.test(l)) return i;
    if (/^(export\s+)?const\s+\w+\s*=\s*(async\s*)?function/.test(l)) return i;
    // A top-level closing brace marks the end of the PREVIOUS declaration.
    if (i < lineIdx && /^\}/.test(l)) return i + 1;
  }
  return 0;
}

const errors = tscErrors();if (errors.length === 0) {
  console.log("No missing-name errors. Nothing to do.");
  process.exit(0);
}

// Group by file.
const byFile = new Map();
for (const e of errors) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

let fixedFiles = 0;
let added = 0;

for (const [file, errs] of byFile) {
  const original = readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let lines = original.split(/\r?\n/);
  let changed = false;

  for (const err of errs) {
    const name = err.name;
    const ns = PREFIX_TO_NS[name];
    if (!ns) {
      console.log(`  ?? ${file}: no namespace mapping for '${name}' - skipped`);
      continue;
    }
    // Already declared in THIS scope? Check the enclosing function only, not the
    // whole file: the same name is commonly declared in several sibling
    // components, and a file-wide test therefore concluded the binding existed
    // when the reference was in a different component.
    const scopeStart = enclosingScopeStart(lines, err.line - 1);
    const already = lines
      .slice(scopeStart, err.line)
      .some((l) => new RegExp(`^\\s*const\\s+${name}\\s*=`).test(l));
    if (already) continue;

    // Nearest preceding translator binding, to inherit scope + indentation.
    let anchor = -1;
    for (let i = err.line - 1; i >= scopeStart; i--) {
      if (/^\s*const\s+t[A-Za-z]*\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(/.test(lines[i])) {
        anchor = i;
        break;
      }
    }
    if (anchor === -1) {
      // Fall back to the file's first translator import and add at function top.
      console.log(`  ?? ${file}: no anchor binding for '${name}' - needs manual placement`);
      continue;
    }

    const indent = lines[anchor].match(/^\s*/)[0];
    const isAsync = /await\s+getTranslations/.test(lines[anchor]);
    const binding = isAsync
      ? `${indent}const ${name} = await getTranslations("${ns}");`
      : `${indent}const ${name} = useTranslations("${ns}");`;

    lines.splice(anchor + 1, 0, binding);
    changed = true;
    added++;
    console.log(`  ++ ${file}:${err.line}  ${binding.trim()}`);
  }

  if (changed && !dryRun) {
    writeFileSync(file, lines.join(eol));
    fixedFiles++;
  }
}

console.log(
  dryRun
    ? `\n--dry-run: would add ${added} binding(s) across ${byFile.size} file(s).`
    : `\nAdded ${added} binding(s) across ${fixedFiles} file(s).`,
);
