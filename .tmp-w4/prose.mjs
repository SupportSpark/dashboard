// Un-wired user-visible copy in scope: JSX text, {"literal"} children,
// template literals, and single words after a tag — regardless of whether the
// scanner can see them.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(n) && !/\.(test|stories)\./.test(n)) files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

const isProse = (s) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (/[{}<>`]|=>|https?:|\/\/|\$\{|\.tsx?/.test(t)) return false;
  if (/^(?:[a-z0-9:/[\].%_-]+)(?:\s+[a-z0-9:/[\].%_-]+)*$/.test(t)) return false;
  if (/^(const|let|var|return|if|else|case|break|await|throw|new|type|interface|import|export|function|default)\b/.test(t)) return false;
  if (/^[A-Za-z_.$-]+$/.test(t) && t.length < 14) return false;
  if (/^(secondaryLighter|secondary|primary|input|white|tertiary)$/.test(t)) return false;
  return true;
};

const out = [];
for (const f of files) {
  const L = readFileSync(f, "utf8").split("\n");
  L.forEach((line, i) => {
    const t = line.trim();
    if (/^(\/\/|\*|\/\*)/.test(t)) return;
    const prev = i > 0 ? L[i - 1].trim() : "";
    for (const m of line.matchAll(/>\s*([^<>{}]+?)\s*</g)) {
      if (isProse(m[1])) out.push(`JSXTEXT  ${f}:${i + 1}  ${JSON.stringify(m[1].replace(/\s+/g," ").trim())}`);
    }
    if (/\/?>\s*$/.test(prev) && !/[{}<>]/.test(t) && isProse(t)) {
      out.push(`TEXTLINE ${f}:${i + 1}  ${JSON.stringify(t)}`);
    }
    for (const m of line.matchAll(/\{\s*"([^"]{3,})"\s*\}/g)) {
      if (isProse(m[1])) out.push(`CHILD    ${f}:${i + 1}  ${JSON.stringify(m[1])}`);
    }
    for (const m of line.matchAll(/`([^`]*)`/g)) {
      const s = m[1];
      if (!/\s/.test(s)) continue;
      const w = s.replace(/\$\{[^}]*\}/g, "X").trim();
      if (/[A-Za-z]{2,}/.test(w) && /[A-Z]/.test(w) && !/^\/|gradient|transparent|^\d|to bottom/.test(w)) {
        out.push(`TMPL     ${f}:${i + 1}  ${JSON.stringify(s.replace(/\s+/g, " ").trim())}`);
      }
    }
  });
}
console.log([...new Set(out)].join("\n"));
console.log("\nTOTAL", new Set(out).size);
