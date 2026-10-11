// Strip every balanced {...} JSX/JS expression container, then look for text
// sitting between > and < across newlines. This is the shape that hid
// "Time to add your client device" and the agent-test intro from earlier passes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(n) && !/\.(test|stories)\./.test(n)) files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

// Candidate-looking prose. Chinese-free, has a lowercase run and a capital.
const interesting = (s) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 4) return false;
  if (!/[A-Za-z]{3,}/.test(t)) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (/[{}<>`]|=>|https?:|\.tsx?|&&|\|\||[=;]$/.test(t)) return false;
  if (/^(const|let|var|return|if|else|case|break|await|throw|new|type|interface|import|export|from|function|default|resolved|outcome)\b/.test(t)) return false;
  if (/^(?:[a-z0-9:/[\].%_-]+)(?:\s+[a-z0-9:/[\].%_-]+)*$/.test(t)) return false;
  return true;
};

function stripBraces(src) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{" && depth === 0) { depth++; out += " "; continue; }
    if (depth > 0) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      out += ch === "\n" ? "\n" : " ";
      continue;
    }
    out += ch;
  }
  return out;
}

const found = [];
for (const f of files) {
  const raw = readFileSync(f, "utf8");
  // Drop comment lines first so JSDoc prose is not reported.
  const src = raw
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
    .join("\n");
  const stripped = stripBraces(src);
  for (const m of stripped.matchAll(/>([^<>]+)</g)) {
    const text = m[1];
    if (!/[\n]/.test(text) && !interesting(text)) continue;
    // Line number in the ORIGINAL file, approximated by counting newlines.
    const line = src.slice(0, m.index).split("\n").length;
    for (const piece of text.split("\n")) {
      if (interesting(piece)) found.push(`${f}:~${line}  ${JSON.stringify(piece.trim())}`);
    }
  }
}
console.log([...new Set(found)].join("\n"));
console.log("\nTOTAL", new Set(found).size);
