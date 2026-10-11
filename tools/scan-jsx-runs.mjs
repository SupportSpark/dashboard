/**
 * Extract complete multi-line JSX text runs, so a key holds the whole sentence
 * rather than the fragment that happened to start a line.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const scope = process.argv[2] ?? "modules";
const files = execFileSync("git", ["ls-files", "src/**/*.tsx"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.includes(scope) && !/\.test\.|\.stories\./.test(f));

const out = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  // A JSX text run: after a `>` and before the next `<`, spanning lines, with no
  // braces (an interpolation ends the run for our purposes).
  for (const m of src.matchAll(/>([^<>{}]+)</g)) {
    const raw = m[1];
    if (!/\n/.test(raw)) continue; // single-line runs are covered elsewhere
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length < 6) continue;
    if (!/[A-Za-z]/.test(text) || !/[a-z]{2,}/.test(text)) continue;
    if (!/^[A-Z0-9]/.test(text)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ file, line, kind: "jsx-run", text });
  }
}
const byFile = new Map();
for (const o of out) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f);
console.log(`\nTOTAL ${out.length}`);
fs.writeFileSync(
  process.env.TEMP + `/jsxruns-${scope.replace(/\//g, "_")}.json`,
  JSON.stringify(out, null, 1),
);
for (const o of out.slice(0, 40)) console.log(`  ${o.line} ${JSON.stringify(o.text.slice(0, 130))}`);
