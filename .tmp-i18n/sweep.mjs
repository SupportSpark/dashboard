// Broad sweep: every English-prose candidate in scope, to catch scanner misses.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const out = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(name) && !/\.(test|stories)\./.test(name)) files.push(p.replace(/\\/g, "/"));
  }
}
const files = [];
for (const r of roots) walk(r);

const prose = (s) => {
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[a-z]{2,}/.test(t)) return false;
  if (!/\s/.test(t)) return false; // single word
  if (!/[A-Z]/.test(t)) return false;
  if (/[{}<>]|=>|https?:|\/\/|@[a-z]+\.|\.tsx?/.test(t)) return false;
  if (/^[a-z0-9:/[\].%_-]+(?:\s+[a-z0-9:/[\].%_-]+)*$/.test(t)) return false;
  if (/^\//.test(t)) return false;
  return true;
};

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    if (/^\s*(import|export)\b/.test(trimmed)) return;
    // string literals
    for (const m of line.matchAll(/"([^"\\\n]{3,300})"|'([^'\\\n]{3,300})'|`([^`\\\n]{3,300})`/g)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (s && prose(s)) out.push(`${f}:${i + 1}:LIT   ${JSON.stringify(s)}`);
    }
    // JSX text with no > < on the same line (scanner-missed shapes)
    if (!/[<>]/.test(line) && /[A-Za-z]/.test(line) && prose(trimmed)) {
      out.push(`${f}:${i + 1}:TEXT  ${JSON.stringify(trimmed)}`);
    }
  });
}
console.log(out.join("\n"));
console.log("\nTOTAL", out.length);
