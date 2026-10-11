/**
 * Find the function/component whose body should receive the translator binding.
 * Prints, per file, every top-level declaration that opens a body, so the
 * anchor can be verified before any edit is scripted.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { rows } = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "rows-final.json"), "utf8"));
const files = [...new Set(rows.filter((r) => r.key).map((r) => r.file))].sort();

for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  const cands = [];
  lines.forEach((l, i) => {
    const t = l.trim();
    if (/^(export\s+)?(default\s+)?(async\s+)?function\s+\w+/.test(t)) cands.push([i + 1, t.slice(0, 96)]);
    else if (/^(export\s+)?const\s+\w+\s*=\s*(React\.)?(forwardRef|memo)?\s*\(?/.test(t) && /\{\s*$/.test(t) === false && /=>\s*\{?\s*$/.test(t)) cands.push([i + 1, t.slice(0, 96)]);
  });
  const hooks = lines.filter((l) => /^export (function|const) (use|handle)/.test(l.trim())).map((l) => l.trim().slice(0, 70));
  console.log(`\n### ${f}`);
  for (const [n, t] of cands) console.log(`  ${n}\t${t}`);
  if (hooks.length) console.log(`  hooks: ${hooks.join(" | ")}`);
}
