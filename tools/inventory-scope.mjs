#!/usr/bin/env node
/**
 * Full inventory of user-visible English under a scope directory.
 *
 * Complements tools/find-hardcoded-english.mjs, which is line-oriented and
 * misses (a) `label: "…"` object properties, (b) values wrapped onto the line
 * after their key, and (c) a second string on a line that already calls a
 * translator. This one reads whole statements and skips anything already
 * routed through a translator.
 *
 * Usage: node tools/inventory-scope.mjs <scope-substring> [--json]
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const scope = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");
if (!scope) {
  console.error("usage: node tools/inventory-scope.mjs <scope-substring> [--json]");
  process.exit(2);
}

const PROPS = [
  "label", "title", "description", "confirmText", "cancelText",
  "loadingMessage", "placeholder", "helpText", "tooltip", "subtitle",
  "heading", "buttonText", "message", "emptyState", "text", "content", "alt",
];

const files = execFileSync("git", ["ls-files", "src/**/*.tsx", "src/**/*.ts"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f.includes(scope) && !/\.test\.|\.stories\.|\.d\.ts$/.test(f));

const propRe = new RegExp(
  String.raw`(?:^|[{,(\s])(?:${PROPS.join("|")})\s*[:=]\s*\r?\n?\s*"([^"]{2,})"`,
  "g",
);
const jsxRe = />\s*([A-Z][^<>{}]*?[a-zA-Z])\s*</g;

function prose(s) {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return false;
  if (/[{}<>]|=>|\.tsx?|:\/\//.test(t)) return false;
  if (/^[a-z-]+(\s+[a-z-]+)+$/.test(t)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^[a-zA-Z0-9_.$:/-]+$/.test(t) && !/[A-Z]/.test(t[0])) return false;
  return true;
}

const out = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const seen = new Set();

  const push = (value, kind, index) => {
    if (!prose(value)) return;
    const line = src.slice(0, index).split("\n").length;
    const key = `${line}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? "")) return;
    out.push({ file, line, kind, text: value.trim() });
  };

  for (const m of src.matchAll(propRe)) {
    const before = src.slice(0, m.index);
    if (/\bt[A-Za-z]*\(\s*$/.test(before.slice(-48))) continue;
    push(m[1], "prop", m.index);
  }
  for (const m of src.matchAll(jsxRe)) {
    push(m[1], "jsx", m.index);
  }
}

if (asJson) {
  console.log(JSON.stringify({ total: out.length, findings: out }, null, 2));
} else {
  let cur = "";
  for (const f of out) {
    if (f.file !== cur) {
      cur = f.file;
      console.log(`\n## ${cur}`);
    }
    console.log(`  ${f.line}\t[${f.kind}]\t${JSON.stringify(f.text)}`);
  }
  const byFile = new Map();
  for (const f of out) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
  console.log(`\nTOTAL ${out.length} in ${byFile.size} file(s)`);
}
