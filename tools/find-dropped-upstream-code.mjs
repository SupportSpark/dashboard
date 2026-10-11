#!/usr/bin/env node
/**
 * Detect upstream functionality silently dropped by the i18n branch.
 *
 * Why this exists
 * ---------------
 * A merge conflict only appears where both sides changed the *same* lines. If the
 * i18n branch deleted an upstream feature in a region upstream left alone, the
 * merge takes the deletion with no marker and no warning. Two such regressions
 * were found by hand in `NetworkSettingsTab.tsx` and `team/user/page.tsx`; this
 * script finds the rest.
 *
 * What it compares
 * ----------------
 * For every `.ts`/`.tsx` file that exists in BOTH upstream/main and the working
 * tree, it extracts the "functional surface" — imported symbols, JSX component
 * names, `data-testid` values and API paths passed to `mutate(...)` — and reports
 * upstream items that are absent from the tree.
 *
 * It deliberately ignores prose and translation keys, since the i18n branch is
 * *expected* to replace hardcoded English with `t("…")` calls.
 *
 * Usage:
 *   node tools/find-dropped-upstream-code.mjs [--ref upstream/main] [--json]
 *
 * Exit code is always 0: this is a review aid, not a gate. Read the report.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const refIdx = args.indexOf("--ref");
const REF = refIdx !== -1 ? args[refIdx + 1] : "upstream/main";

function git(...a) {
  return execFileSync("git", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

/** Files changed by the i18n work, plus every file upstream touched. */
function candidateFiles() {
  const out = new Set();
  for (const spec of [
    ["diff", "--name-only", `5a5e04ad354de5f6bd70c80aefb53dfcc5ebccc0..HEAD`],
    ["diff", "--name-only", `5a5e04ad354de5f6bd70c80aefb53dfcc5ebccc0..${REF}`],
    // Working tree, so in-progress merge resolutions are included.
    ["diff", "--name-only", "HEAD"],
  ]) {
    try {
      for (const f of git(...spec).split("\n")) {
        if (f && /\.(tsx?|ts)$/.test(f) && f.startsWith("src/")) out.add(f);
      }
    } catch {
      /* ignore */
    }
  }
  return [...out].sort();
}

/** Pull the functional surface out of one source string. */
function surface(src) {
  const imports = new Set();
  const jsx = new Set();
  const testIds = new Set();
  const routes = new Set();

  // import X, { A, B as C } from "…"  /  import { A } from "…"
  for (const m of src.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["'][^"']+["']/g)) {
    const clause = m[1];
    const braced = clause.match(/\{([\s\S]*?)\}/);
    if (braced) {
      for (let name of braced[1].split(",")) {
        name = name.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) imports.add(name);
      }
    }
    const def = clause.replace(/\{[\s\S]*?\}/, "").replace(/,/g, "").trim();
    if (/^[A-Za-z_$][\w$]*$/.test(def)) imports.add(def);
  }

  // <Component …  and  </Component>
  for (const m of src.matchAll(/<\/?([A-Z][A-Za-z0-9_]*)/g)) jsx.add(m[1]);

  // data-testid={"x"}  /  data-testid="x"  /  data-testid={`x`}
  for (const m of src.matchAll(/data-testid=\{?["'`]([^"'`]+)["'`]/g)) testIds.add(m[1]);

  // mutate(`/path`)  /  mutate("/path")
  for (const m of src.matchAll(/mutate\(\s*[`"']([^`"'$]+)[`"']/g)) routes.add(m[1]);

  return { imports, jsx, testIds, routes };
}

/**
 * Names that legitimately differ between the branches and must not be reported:
 * the i18n layer removes `next-themes`, adds `next-intl`, and so on.
 */
const IGNORED_NAMES = new Set([
  "useTranslations",
  "getTranslations",
  "NextIntlClientProvider",
  "nextIntl",
  "LocaleProvider",
  "LocaleSwitcher",
  "Cypress",
  "cy",
  "describe",
  "it",
  "expect",
  "beforeEach",
  "afterEach",
]);

const files = candidateFiles();
const findings = [];
let compared = 0;

for (const f of files) {
  let up;
  try {
    up = git("show", `${REF}:${f}`);
  } catch {
    continue; // file is new on our side
  }
  let cur;
  try {
    cur = readFileSync(f, "utf8");
  } catch {
    // Deleted in the working tree: every upstream surface item is a loss.
    findings.push({
      file: f,
      deleted: true,
      imports: [...surface(up).imports].filter((n) => !IGNORED_NAMES.has(n)),
      jsx: [...surface(up).jsx].filter((n) => !IGNORED_NAMES.has(n)),
      testIds: [...surface(up).testIds],
      routes: [...surface(up).routes],
    });
    continue;
  }
  compared++;

  const a = surface(up);
  const b = surface(cur);

  const lost = (setA, setB) =>
    [...setA].filter((x) => !setB.has(x) && !IGNORED_NAMES.has(x)).sort();

  const rec = {
    file: f,
    imports: lost(a.imports, b.imports),
    jsx: lost(a.jsx, b.jsx),
    testIds: lost(a.testIds, b.testIds),
    routes: lost(a.routes, b.routes),
  };
  if (rec.imports.length || rec.jsx.length || rec.testIds.length || rec.routes.length) {
    findings.push(rec);
  }
}

if (asJson) {
  console.log(JSON.stringify({ ref: REF, compared, findings }, null, 2));
} else {
  console.log(`Compared ${compared} file(s) against ${REF}.`);
  console.log(`Files with upstream surface missing from the working tree: ${findings.length}\n`);

  // Test ids and routes are the strongest signals: they are concrete and unique.
  const strong = findings.filter((f) => f.testIds?.length || f.routes?.length);
  const weak = findings.filter((f) => !f.testIds?.length && !f.routes?.length);

  if (strong.length) {
    console.log("=== STRONG SIGNALS (test ids / API routes lost) ===");
    for (const f of strong) {
      console.log(`\n  ${f.file}`);
      if (f.testIds?.length) console.log(`    data-testid lost : ${f.testIds.join(", ")}`);
      if (f.routes?.length) console.log(`    mutate() lost    : ${f.routes.join(", ")}`);
      if (f.jsx?.length) console.log(`    components lost  : ${f.jsx.join(", ")}`);
      if (f.imports?.length) console.log(`    imports lost     : ${f.imports.join(", ")}`);
    }
  }

  if (weak.length) {
    console.log("\n=== WEAKER SIGNALS (imports / components) — many are expected rename noise ===");
    for (const f of weak.slice(0, 60)) {
      console.log(`\n  ${f.file}`);
      if (f.jsx?.length) console.log(`    components lost  : ${f.jsx.join(", ")}`);
      if (f.imports?.length) console.log(`    imports lost     : ${f.imports.join(", ")}`);
    }
    if (weak.length > 60) console.log(`\n  … and ${weak.length - 60} more`);
  }
}
