import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * Repair i18n wiring left half-done by an interrupted worker.
 *
 * Two mechanical faults, both of which break the build:
 *   - `import { useTranslations } from "next-intl"` added twice
 *   - `useTranslations(...)` called with no import at all
 *
 * Missing BINDINGS (`const tX = useTranslations(...)` absent inside a component)
 * are handled by tools/fix-missing-bindings.mjs afterwards.
 */

const IMPORT_LINE = 'import { useTranslations } from "next-intl";';

let changed = 0;

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  const eol = src.includes("\r\n") ? "\r\n" : "\n";

  const importIdx = lines
    .map((l, i) => (l.trim() === IMPORT_LINE ? i : -1))
    .filter((i) => i !== -1);

  const usesHook = /\buseTranslations\s*\(/.test(src);

  if (importIdx.length > 1) {
    // Keep the first, drop the rest.
    for (const i of importIdx.slice(1).reverse()) lines.splice(i, 1);
    console.log(`  ${file}: removed ${importIdx.length - 1} duplicate import(s)`);
    changed++;
  } else if (importIdx.length === 0 && usesHook) {
    // Insert after the last top-level import.
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) last = i;
    }
    if (last === -1) {
      console.log(`  ${file}: no import block found, needs manual insertion`);
      continue;
    }
    lines.splice(last + 1, 0, IMPORT_LINE);
    console.log(`  ${file}: added the missing next-intl import after line ${last + 1}`);
    changed++;
  }

  if (changed) writeFileSync(file, lines.join(eol));
}

console.log(`\n${changed} file(s) touched.`);

// Now let the binding fixer handle `Cannot find name 'tXxx'` errors.
console.log("\nrunning fix-missing-bindings.mjs ...");
try {
  console.log(
    execFileSync("node", ["tools/fix-missing-bindings.mjs"], { encoding: "utf8", maxBuffer: 1 << 28 }),
  );
} catch (e) {
  console.log((e.stdout ?? "") + (e.stderr ?? ""));
}
