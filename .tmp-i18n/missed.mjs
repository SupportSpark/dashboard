// Catch the shapes find-hardcoded-english.mjs misses: single-word JSX text,
// text ending in "?" or "!", template literals in JSX, and string-literal
// JSX children.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(name) && !/\.(test|stories)\./.test(name))
      files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

const lines = [];
for (const f of files) {
  const src = readFileSync(f, "utf8").split("\n");
  src.forEach((line, i) => {
    const trimmed = line.trim();
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    const prev = i > 0 ? src[i - 1].trim() : "";
    const afterTag = /\/?>\s*$/.test(prev);
    if (afterTag) {
      // A bare text line: letters, spaces, and simple punctuation only.
      const bare = /^[A-Za-z][A-Za-z0-9 ,.'’?!&/-]*$/.test(trimmed);
      if (bare && trimmed.length >= 2 && !/^(const|let|var|return|case|break|import|export)\b/.test(trimmed)) {
        const wordOnly = /^[\w-]+$/.test(trimmed);
        if (wordOnly || /[a-z]{2,}/.test(trimmed))
          lines.push(`TEXT-LINE  ${f}:${i + 1}  ${JSON.stringify(trimmed)}`);
      }
    }
    // template literal anywhere
    for (const m of line.matchAll(/`([^`]*)`/g)) {
      const s = m[1].trim();
      if (/[a-z]{2,}/.test(s) && /[A-Za-z]/.test(s) && !/^\$\{/.test(s) && !/^\/[^ ]*$/.test(s)) {
        lines.push(`TEMPLATE   ${f}:${i + 1}  ${JSON.stringify(s)}`);
      }
    }
    // string literal JSX child: {"Some text"}
    for (const m of line.matchAll(/\{\s*"([^"{}]{4,})"\s*\}/g)) {
      const s = m[1].trim();
      if (/[a-z]{2,}/.test(s) && /[A-Z]/.test(s)) lines.push(`CHILD-LIT  ${f}:${i + 1}  ${JSON.stringify(s)}`);
    }
    // JSX text ending in ? or ! after a tag on the same line
    for (const m of line.matchAll(/>\s*([A-Z][^<>{}]*?[?!])\s*</g)) {
      lines.push(`Q-TEXT     ${f}:${i + 1}  ${JSON.stringify(m[1].trim())}`);
    }
  });
}
console.log(lines.join("\n"));
console.log("\nTOTAL", lines.length);
