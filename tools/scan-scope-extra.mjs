#!/usr/bin/env node
/**
 * Supplementary scan for user-visible English the main finder misses inside a
 * scope directory. The main finder is line-oriented, so a value written on the
 * line *after* its key (`description:\n  "..."`) is invisible to it. This
 * script reads whole statements instead, and reports only lines that are not
 * already routed through a translator.
 *
 * Usage: node tools/scan-scope-extra.mjs <scope-substring>
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const scope = process.argv[2];
if (!scope) {
  console.error("usage: node tools/scan-scope-extra.mjs <scope-substring>");
  process.exit(2);
}

const VISIBLE = [
  "title", "description", "confirmText", "cancelText", "loadingMessage",
  "placeholder", "label", "helpText", "tooltip", "subtitle", "heading",
  "buttonText", "message", "emptyState", "text", "content", "alt", "aria-label",
];

const files = execFileSync("git", ["ls-files", "src/**/*.tsx", "src/**/*.ts"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f.includes(scope) && !/\.test\.|\.stories\./.test(f));

const re = new RegExp(
  `(?:^|[{,(\\s])(?:${VISIBLE.join("|")})\\s*[:=]\\s*\\r?\\n?\\s*"([^"]{3,})"`,
  "g",
);

let n = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (const m of src.matchAll(re)) {
    const value = m[1];
    if (!/[A-Za-z]/.test(value) || !/[a-z]{2,}/.test(value)) continue;
    if (/^[a-z-]+(\s+[a-z-]+)+$/.test(value)) continue;
    const before = src.slice(0, m.index);
    if (/\bt[A-Za-z]*\(\s*$/.test(before.slice(-40))) continue;
    const line = before.split("\n").length;
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? "")) continue;
    console.log(`${file}:${line}  ${JSON.stringify(value)}`);
    n++;
  }
}
console.log(`\n${n} additional candidate(s) in ${files.length} file(s) matching "${scope}"`);
