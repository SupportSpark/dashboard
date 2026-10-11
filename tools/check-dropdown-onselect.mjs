import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Find DropdownMenuItem usages that pass `onSelect` but no `onClick`.
 *
 * Those are dead. Every action DropdownMenuItem wrapper ends its own onClick
 * with:
 *
 *     e.preventDefault();
 *     e.stopPropagation();
 *     onClick && onClick(e);
 *
 * Radix composes the primitive's handler with the caller's:
 *
 *     onClick: composeEventHandlers(props.onClick, handleSelect)
 *
 * and composeEventHandlers SKIPS the second handler when the first called
 * preventDefault. So the wrapper's preventDefault stops `handleSelect` from
 * running, which is what dispatches the `menu.itemSelect` event that calls
 * `onSelect`. An item whose only action is `onSelect` therefore does nothing —
 * it looks clickable, closes, and silently ignores the click.
 *
 * The correct shape is to put the action in `onClick`:
 *     <DropdownMenuItem onClick={() => setLocale(option)}>
 *
 * Usage: node tools/check-dropdown-onselect.mjs
 */

const ROOT = process.cwd();

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(n) && !/\.(test|stories)\./.test(n)) out.push(p);
  }
  return out;
}

const findings = [];

for (const file of walk(join(ROOT, "src"))) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  // Each <DropdownMenuItem ...> opening tag, however it wraps.
  for (const m of src.matchAll(/<DropdownMenuItem\b/g)) {
    const start = m.index;
    // Find the end of the opening tag: the first '>' at brace depth 0.
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    const tag = src.slice(start, end + 1);
    const line = src.slice(0, start).split("\n").length;

    const hasOnSelect = /\bonSelect\s*=/.test(tag);
    const hasOnClick = /\bonClick\s*=/.test(tag);
    const hasHref = /\bhref\s*=/.test(tag);

    if (hasOnSelect && !hasOnClick && !hasHref) {
      findings.push({ file: rel, line, tag: tag.replace(/\s+/g, " ").slice(0, 130) });
    }
  }
}

if (findings.length === 0) {
  console.log("OK: no DropdownMenuItem relies on onSelect alone.");
} else {
  console.log(
    `DEAD HANDLERS (${findings.length}): DropdownMenuItem with onSelect but no onClick.\n` +
      `The wrapper's onClick calls preventDefault, which stops Radix from ever\n` +
      `dispatching the itemSelect event that invokes onSelect. Move the action to onClick.\n`,
  );
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}`);
    console.log(`      ${f.tag}`);
  }
  process.exitCode = 1;
}
