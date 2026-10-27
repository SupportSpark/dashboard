#!/usr/bin/env node
/**
 * Fails when a dependency this fork adds on top of upstream has gone missing.
 *
 * Why this exists: the localization branch carries runtime dependencies that
 * upstream `netbirdio/dashboard` does not have — `next-intl` above all. When a
 * sync merge takes upstream's `package.json` wholesale (which is the only sane
 * resolution for a lock file conflict), those entries disappear with it, and
 * nothing complains until `next build` dies with
 *
 *     Cannot find module 'next-intl/plugin'
 *
 * long after the merge was pushed. That happened while merging the 8 commits
 * after v2.95.0, so the check now runs in both pipelines and before a sync push.
 *
 * Add a dependency here when the fork starts needing one that upstream lacks.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Packages this fork needs that upstream's package.json does not declare. */
const FORK_ONLY_DEPENDENCIES = ["next-intl"];

/**
 * npm scripts this fork needs. Same failure mode as the dependencies: taking
 * upstream's package.json wholesale drops `test:i18n` along with it, and the
 * first symptom is a CI step that dies with `npm error Missing script`.
 */
const FORK_ONLY_SCRIPTS = {
  "test:i18n": "scripts/run-i18n-test.mjs",
};

/** Files/dirs the i18n layer owns; a sync merge must never drop them. */
const FORK_ONLY_PATHS = [
  "src/i18n/messages/en.ts",
  "src/i18n/messages/zh.ts",
  "src/i18n/config.ts",
  "src/i18n/request.ts",
  "src/i18n/global.d.ts",
  "src/contexts/LocaleProvider.tsx",
];

const root = resolve(process.argv[2] ?? ".");
const problems = [];

let pkg = {};
try {
  pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
} catch (error) {
  problems.push(`cannot read package.json: ${error.message}`);
}

const declared = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.peerDependencies ?? {}),
};

for (const name of FORK_ONLY_DEPENDENCIES) {
  if (!declared[name]) {
    problems.push(
      `package.json lost "${name}" (upstream has no such dependency; ` +
        `re-add it: npm install ${name} --save)`,
    );
    continue;
  }
  if (!existsSync(resolve(root, "node_modules", name))) {
    problems.push(
      `"${name}" is declared but not installed — run npm install`,
    );
  }
}

for (const [name, runner] of Object.entries(FORK_ONLY_SCRIPTS)) {
  if (!pkg.scripts?.[name]) {
    problems.push(
      `package.json lost the "${name}" script (upstream has no such script; ` +
        `re-add it: "${name}": "node ${runner}")`,
    );
    continue;
  }
  if (!existsSync(resolve(root, runner))) {
    problems.push(`the "${name}" script points at a missing file: ${runner}`);
  }
}

for (const path of FORK_ONLY_PATHS) {
  if (!existsSync(resolve(root, path))) {
    problems.push(`missing i18n file: ${path}`);
  }
}

if (problems.length > 0) {
  console.error("fork dependencies are incomplete:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `OK: ${FORK_ONLY_DEPENDENCIES.length} fork-only dependency(ies) present, ` +
    `${Object.keys(FORK_ONLY_SCRIPTS).length} fork-only script(s) present, ` +
    `${FORK_ONLY_PATHS.length} i18n file(s) present.`,
);
