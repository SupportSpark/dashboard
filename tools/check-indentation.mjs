#!/usr/bin/env node
/**
 * Fail when a source file is indented with tabs.
 *
 * Why this is a guard and not a style preference
 * ----------------------------------------------
 * Upstream formats with Prettier (tabWidth 2, no tabs). A file of ours that is
 * tab-indented differs from upstream on *every* line, so git cannot 3-way merge
 * it: each upstream release turns that file into a whole-file conflict and the
 * sync stops. That is exactly what happened with v2.95.0 — 86 files, 17 hunks,
 * and a nightly sync that failed twice before anyone looked.
 *
 * Rewriting those files with `npx prettier --write` collapsed the diff to just
 * the t() wiring and the merge went through with 4 trivial import conflicts.
 * This check keeps it that way.
 *
 * What counts
 * -----------
 * A line whose leading whitespace contains a tab, outside comments and outside
 * template literals (where leading tabs are content — shell snippets, PEM
 * blocks and the like — and rewriting them would change what the user copies).
 *
 * Escape hatch: put `indent-ok` anywhere on such a line.
 *
 * Usage: node tools/check-indentation.mjs [root]
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  ".git",
  "coverage",
  "public",
  "storybook-static",
  "i18n-fragments",
]);

/** Walk the tree and return every source file under `src/`. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/**
 * Return the 1-based line numbers of code lines indented with a tab.
 *
 * A character-level scan keeps comment and template state, so a tab inside a
 * multi-line bash snippet is left alone while the same tab as indentation is
 * reported.
 */
function tabIndentedCodeLines(source) {
  const hits = [];
  let state = "code"; // code | line | block | single | double | template
  let line = 1;
  let atLineStart = true;
  let leadingTab = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "\n") {
      if (state === "line") state = "code";
      if (state === "code" && leadingTab) hits.push(line);
      line++;
      atLineStart = true;
      leadingTab = false;
      continue;
    }

    if (state === "line") continue;

    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i++;
      }
      continue;
    }

    if (state === "template") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") {
        state = "code";
        continue;
      }
      continue;
    }

    if (state === "single" || state === "double") {
      const quote = state === "single" ? "'" : '"';
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) state = "code";
      continue;
    }

    // state === "code"
    if (atLineStart && (ch === " " || ch === "\t")) {
      if (ch === "\t") leadingTab = true;
      continue;
    }
    atLineStart = false;

    if (ch === "/" && next === "/") {
      state = "line";
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }
    if (ch === "`") {
      state = "template";
      continue;
    }
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "'") {
      state = "single";
      continue;
    }
    if (ch === '"') {
      state = "double";
      continue;
    }
  }

  return hits.filter((n) => {
    const text = source.split("\n")[n - 1] ?? "";
    return !text.includes("indent-ok");
  });
}

const base = path.join(ROOT, "src");
if (!fs.existsSync(base)) {
  console.error(`check-indentation: no src/ under ${path.resolve(ROOT)}`);
  process.exit(2);
}

let filesWithTabs = 0;
let totalHits = 0;

for (const file of walk(base)) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("\t")) continue;
  const hits = tabIndentedCodeLines(source);
  if (hits.length === 0) continue;
  filesWithTabs++;
  totalHits += hits.length;
  console.log(`${path.relative(ROOT, file)}`);
  for (const n of hits.slice(0, 5)) console.log(`  line ${n}`);
  if (hits.length > 5) console.log(`  ... and ${hits.length - 5} more`);
}

if (filesWithTabs > 0) {
  console.error(
    `\nFAIL: ${totalHits} tab-indented code line(s) in ${filesWithTabs} file(s).`,
  );
  console.error(
    "Tab indentation makes git see every line as changed, so each upstream",
  );
  console.error(
    "release turns the file into a whole-file merge conflict. Fix with:",
  );
  console.error(
    "\n  npx prettier --write <file>   (Prettier defaults = upstream style)\n",
  );
  process.exit(1);
}

console.log("OK: no tab-indented source files.");
