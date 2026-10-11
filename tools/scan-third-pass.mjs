/**
 * Third-pass scan: the two shapes the earlier passes miss.
 *   (a) JSX-expression string attributes:  placeholder={"Search nodes..."}
 *   (b) multi-line JSX text children:      <HelpText>\n  How long ...\n</HelpText>
 * Reports only English prose not already routed through a translator.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const scope = process.argv[2];
const files = execFileSync("git", ["ls-files", "src/**/*.tsx", "src/**/*.ts"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.includes(scope) && !/\.test\.|\.stories\.|\.d\.ts$/.test(f));

const ATTRS = ["placeholder", "label", "title", "helpText", "description", "aria-label", "alt"];
const attrRe = new RegExp(`([A-Za-z-]+)=\\{\\s*"([^"]{2,})"\\s*\\}`, "g");

function prose(s) {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return false;
  if (/[{}<>]|=>|\/\/|:\/\//.test(t)) return false;
  if (/^[a-z-]+(\s+[a-z-]+)+$/.test(t)) return false;
  if (/^[a-zA-Z0-9_.$:/-]+$/.test(t) && !/[A-Z]/.test(t[0])) return false;
  return true;
}

let a = 0;
let b = 0;
const out = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  for (const m of src.matchAll(attrRe)) {
    const [, attr, val] = m;
    if (!ATTRS.includes(attr)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    if (/\bt[A-Za-z]*\(\s*$/.test(src.slice(0, m.index).slice(-48))) continue;
    if (!prose(val)) continue;
    out.push({ file, line, kind: `expr:${attr}`, text: val });
    a++;
  }

  // JSX text children: a line consisting only of prose, inside a tag body.
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t || /^(\/\/|\*|\/\*|import |export |const |let |return|<|\}|\{)/.test(t)) return;
    if (!/^[A-Z][^<>{}]*[a-zA-Z][.,]?$/.test(t)) return;
    if (!prose(t)) return;
    // Must look like prose, not an identifier: needs a space or sentence end.
    if (!/\s/.test(t)) return;
    const prev = (lines[i - 1] ?? "").trim();
    const next = (lines[i + 1] ?? "").trim();
    const inJsx = />$/.test(prev) || /^<\//.test(next) || /^<span|^<code|^<\/?[a-z]/.test(next);
    if (!inJsx) return;
    out.push({ file, line: i + 1, kind: "jsx-text", text: t });
    b++;
  });
}

console.log(`expr-attr: ${a}   multiline-jsx-text: ${b}`);
const byFile = new Map();
for (const o of out) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
for (const [f, n] of [...byFile].sort((x, y) => y[1] - x[1])) console.log(String(n).padStart(4), f);
fs.writeFileSync(
  process.env.TEMP + `/extra-${scope.replace(/\//g, "_")}.json`,
  JSON.stringify(out, null, 1),
);
console.log(`\nTOTAL ${out.length}`);
