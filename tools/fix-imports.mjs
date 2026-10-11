/**
 * Repair `next-intl` imports that were inserted inside a multi-line import
 * statement, and move them to a safe place in the import block.
 *
 * A correct landing spot is immediately BEFORE the first single-line `import`
 * statement that is not part of a multi-line group — i.e. a real statement
 * boundary.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.match(/modules\/(agent-network|control-center)\//));

const IMPORT = `import { useTranslations } from "next-intl";`;
const fixed = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(IMPORT)) continue;
  const hadCrlf = src.includes("\r\n");
  const lines = src.split(/\r?\n/);

  const isBoundary = (i) => {
    const l = lines[i];
    const prev = lines[i - 1] ?? "";
    // A statement boundary: a single-line import, and the previous line is
    // either blank or a fully closed import/statement.
    if (!/^\s*import\b/.test(l)) return false;
    if (!/;\s*$/.test(l)) return false; // multi-line import opener
    if (/\{\s*$/.test(l) && !/\}\s*from/.test(l)) return false;
    const p = prev.trim();
    if (p === "" || p.endsWith(";")) return true;
    return false;
  };

  // Remove every occurrence first.
  const clean = lines.filter((l) => l.trim() !== IMPORT);
  const removed = lines.length - clean.length;
  if (!removed) continue;

  // Find the first valid boundary in the cleaned file.
  let at = -1;
  for (let i = 0; i < clean.length; i++) {
    if (isBoundary(i)) {
      at = i;
      break;
    }
  }
  if (at === -1) {
    // Fallback: after the last line that closes an import from "…".
    for (let i = 0; i < clean.length; i++) {
      if (/^\}\s*from\s+"[^"]+";\s*$/.test(clean[i]) || /^import .*;\s*$/.test(clean[i])) at = i + 1;
    }
  }
  if (at === -1) continue;

  clean.splice(at, 0, IMPORT);
  let out = clean.join("\n");
  if (hadCrlf) out = out.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, out);
  fixed.push(file);
}

console.log(`repaired ${fixed.length} file(s)`);
for (const f of fixed) console.log("  " + f);
