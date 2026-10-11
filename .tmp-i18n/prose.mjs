// Refined: every user-visible string in scope, regardless of the shapes
// find-hardcoded-english.mjs can see.
//   - JSX text nodes (any leading character, any punctuation)
//   - {"literal"} children, anywhere
//   - template literals containing prose
//   - single words on their own line between tags
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.(test|stories)\./.test(name))
      files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

const err = [];
const isProse = (s) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (/[{}<>`]|=>|https?:|\/\/|\$\{|\.tsx?|\.ts\b/.test(t)) return false;
  if (/^(?:[a-z0-9:/[\].%_-]+)(?:\s+[a-z0-9:/[\].%_-]+)*$/.test(t)) return false;
  if (/^(const|let|var|return|if|else|case|break|await|throw|new|type|interface|import|export|function|default)\b/.test(t)) return false;
  if (/^[A-Za-z_.$-]+$/.test(t) && t.length < 12) return false; // lone identifier
  return true;
};

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^(\/\/|\*|\/\*)/.test(t)) return;
    const prev = i > 0 ? lines[i - 1].trim() : "";

    // JSX text node on this line, whatever it starts/ends with.
    for (const m of line.matchAll(/>\s*([^<>{}]+?)\s*</g)) {
      const s = m[1];
      if (isProse(s)) err.push(`JSXTEXT  ${f}:${i + 1}  ${JSON.stringify(s.replace(/\s+/g, " ").trim())}`);
    }
    // Bare text line right after a tag (single words included).
    if (/\/?>\s*$/.test(prev) && !/[{}<>]/.test(t) && isProse(t)) {
      err.push(`TEXTLINE ${f}:${i + 1}  ${JSON.stringify(t)}`);
    }
    // {"literal"} children.
    for (const m of line.matchAll(/\{\s*"([^"]{3,})"\s*\}/g)) {
      if (isProse(m[1])) err.push(`CHILD    ${f}:${i + 1}  ${JSON.stringify(m[1])}`);
    }
    // Template literals with prose.
    for (const m of line.matchAll(/`([^`]*)`/g)) {
      const s = m[1];
      if (!/\s/.test(s)) continue;
      const words = s.replace(/\$\{[^}]*\}/g, "X").trim();
      if (/[A-Za-z]{2,}/.test(words) && /[A-Z]/.test(words) && !/^\/|^[a-z-]+$|gradient|transparent|^\d/.test(words)) {
        err.push(`TMPL     ${f}:${i + 1}  ${JSON.stringify(s.replace(/\s+/g, " ").trim())}`);
      }
    }
  });
}
const seen = new Set();
for (const e of err) {
  const k = e.replace(/:\d+:/, ":");
  if (seen.has(e)) continue;
  seen.add(e);
  console.log(e);
}
console.log("\nTOTAL", seen.size);
