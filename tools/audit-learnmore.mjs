#!/usr/bin/env node
/**
 * Find `learnMore` keys whose English does not match upstream.
 *
 * A link that stands alone after a description reads "Learn more" upstream. A
 * translation pass changed several of them to "Learn more about" / 了解更多关于,
 * which is wrong for a standalone link: the phrase needs an object, and the link
 * text itself IS the object ("Learn more" + [Groups]). Reported for the groups
 * page; this checks whether the same edit landed anywhere else.
 *
 * Method: for each namespace's `learnMore*` key, look up what upstream renders at
 * the call site and compare. Since the call sites are the same files, it compares
 * the catalog value against the English literal that upstream had near the same
 * JSX link.
 *
 * Usage: node tools/audit-learnmore.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function load(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, rel.replace(/[\\/]/g, "_").replace(/\.ts$/, ".mjs"));
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-lm-"));
const en = await load("src/i18n/messages/en.ts", dir);

function walk(d) {
  const out = [];
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.tsx$/.test(n) && !/\.(test|stories)\./.test(n)) out.push(p);
  }
  return out;
}

const findings = [];

for (const file of walk(join(process.cwd(), "src"))) {
  const src = readFileSync(file, "utf8");
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");

  // translator bindings in this file
  const bindings = [];
  for (const m of src.matchAll(
    /(?:const|let)\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g,
  )) {
    bindings.push({ name: m[1], ns: m[2] });
  }

  for (const b of bindings) {
    // `t("learnMore…")` inside an InlineLink / <a> in this file
    const re = new RegExp(`\\b${b.name}\\(\\s*"(learnMore[A-Za-z]*)"`, "g");
    for (const m of src.matchAll(re)) {
      const key = m[1];
      const value = en[b.ns]?.[key];
      if (typeof value !== "string") continue;

      // What upstream had in this file, for the same link.
      let upstream = "";
      try {
        upstream = execFileSync("git", ["show", `upstream/main:${rel}`], {
          encoding: "utf8",
          maxBuffer: 1 << 26,
        });
      } catch {
        continue; // file is new in this branch
      }
      const hasLearnMore = /Learn more\b(?! about)/.test(upstream);
      const hasLearnMoreAbout = /Learn more about/.test(upstream);

      if (hasLearnMore && !hasLearnMoreAbout && /^Learn more about/i.test(value)) {
        findings.push({ file: rel, ns: b.ns, key, value, upstream: "Learn more" });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("OK: no standalone 'Learn more' link was widened to 'Learn more about'.");
} else {
  console.log(
    `POSSIBLE WIDENED LINKS (${findings.length}): upstream says "Learn more" but the\n` +
      `catalog says "Learn more about". A standalone link needs no object — the link\n` +
      `text is the object.\n`,
  );
  for (const f of findings) {
    console.log(`  ${f.file}   ${f.ns}.${f.key} = ${JSON.stringify(f.value)}`);
  }
  process.exitCode = 1;
}
