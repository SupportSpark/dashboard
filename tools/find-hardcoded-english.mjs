#!/usr/bin/env node
/**
 * Find user-visible English strings that are still hardcoded in the UI.
 *
 * This is the work-list generator for the localization pass. It looks for the
 * places a user actually reads text:
 *
 *   1. JSX text nodes            <div>Save changes</div>
 *   2. string attributes         placeholder="Search...", title="Delete peer"
 *   3. notify()/confirm() calls  notify({ title: "Deleted", description: "..." })
 *   4. toast/alert arguments     toast.success("Copied")
 *
 * It deliberately ignores:
 *   - anything already wrapped in t()/tCommon()/etc. or a template literal
 *   - className/data-testid/aria-hidden/role/key/id and other non-visible attrs
 *   - CSS-looking values, URLs, emails, hex colours, version numbers
 *   - strings that are a single word already present as a catalog value
 *   - the `untranslated` namespace's own bookkeeping
 *
 * Usage:
 *   node tools/find-hardcoded-english.mjs [--json] [--area <substring>]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const areaIdx = args.indexOf("--area");
const area = areaIdx !== -1 ? args[areaIdx + 1] : null;

const NON_VISIBLE_ATTRS = new Set([
  "className", "class", "data-testid", "data-cy", "dataCy", "aria-hidden",
  "role", "key", "id", "name", "type", "value", "href", "src", "to", "target",
  "rel", "htmlFor", "width", "height", "size", "variant", "color", "fill",
  "stroke", "viewBox", "d", "xmlns", "autoComplete", "inputMode", "tabIndex",
  "maxWidthClass", "contentClassName", "onClick", "onChange", "onSubmit",
  "style", "strokeWidth", "strokeLinecap", "strokeLinejoin", "pattern",
  "data-state", "data-orientation", "data-side", "aria-describedby",
  "aria-labelledby", "aria-controls", "aria-haspopup", "aria-expanded",
]);

/** Attributes whose value a sighted user reads. */
const VISIBLE_ATTRS = new Set([
  "placeholder", "title", "label", "description", "helpText", "confirmText",
  "cancelText", "loadingMessage", "alt", "aria-label", "emptyState", "text",
  "content", "tooltip", "message", "subtitle", "heading", "buttonText",
]);

/** Check whether a candidate is actually human-readable English prose. */
function looksLikeProse(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 3) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  // Needs at least one lowercase-letter word (filters ALL_CAPS constants).
  if (!/[a-z]{2,}/.test(t)) return false;
  // No code / markup / paths.
  if (/[{}<>]|=>|\.tsx?|\.js\b|\/\/|@[a-z]+\.|https?:/.test(t)) return false;
  if (/^[a-z-]+(\s+[a-z-]+)+$/.test(t)) return false; // css-ish "flex items-center"
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^\d+(\.\d+)*$/.test(t)) return false;
  // Ignore tokens that are just an identifier or a key path.
  if (/^[a-zA-Z0-9_.$:-]+$/.test(t) && !/[A-Z]/.test(t[0])) return false;
  return true;
}

const files = (area
  ? execFileSync("git", ["ls-files", `src/${area}/**/*.tsx`, `src/${area}/**/*.ts`], { encoding: "utf8" })
  : execFileSync("git", ["ls-files", "src/**/*.tsx", "src/**/*.ts"], { encoding: "utf8" })
)
  .split("\n")
  .filter((f) => f && !/\.test\.|\.stories\.|src\/i18n\//.test(f));

const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Skip comments outright.
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    // Skip lines that already translate something.
    if (/\bt[A-Za-z]*\(/.test(line)) return;

    // 1. JSX text nodes: >Some Text<
    for (const m of line.matchAll(/>\s*([A-Z][^<>{}]*?[a-zA-Z])\s*</g)) {
      const s = m[1].trim();
      if (looksLikeProse(s)) {
        findings.push({ file, line: idx + 1, kind: "jsx-text", text: s });
      }
    }

    // 2. visible string attributes
    for (const m of line.matchAll(/([A-Za-z-]+)\s*=\s*"([^"{}]+)"/g)) {
      const [, attr, val] = m;
      if (NON_VISIBLE_ATTRS.has(attr)) return;
      if (!VISIBLE_ATTRS.has(attr)) return;
      if (looksLikeProse(val)) {
        findings.push({ file, line: idx + 1, kind: `attr:${attr}`, text: val.trim() });
      }
    }

    // 3. notify()/confirm() title/description
    for (const m of line.matchAll(/\b(title|description|loadingMessage|confirmText|cancelText)\s*:\s*"([^"]+)"/g)) {
      if (looksLikeProse(m[2])) {
        findings.push({ file, line: idx + 1, kind: `notify:${m[1]}`, text: m[2].trim() });
      }
    }

    // 4. toast/alert with a plain string
    for (const m of line.matchAll(/\b(?:toast(?:\.\w+)?|alert)\(\s*"([^"]+)"/g)) {
      if (looksLikeProse(m[1])) {
        findings.push({ file, line: idx + 1, kind: "toast", text: m[1].trim() });
      }
    }
  });
}

// Group by file, then by area.
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

const byArea = new Map();
for (const [file, items] of byFile) {
  const parts = file.split("/");
  const key = parts.length > 2 ? `${parts[1]}/${parts[2]}` : parts[1] ?? "root";
  if (!byArea.has(key)) byArea.set(key, { files: 0, strings: 0 });
  const a = byArea.get(key);
  a.files++;
  a.strings += items.length;
}

if (asJson) {
  console.log(JSON.stringify({ total: findings.length, files: byFile.size, byArea: [...byArea], findings }, null, 2));
} else {
  console.log(`Hardcoded user-visible English: ${findings.length} string(s) in ${byFile.size} file(s)\n`);
  console.log("By area:");
  for (const [k, v] of [...byArea].sort((a, b) => b[1].strings - a[1].strings)) {
    console.log(`  ${String(v.strings).padStart(4)}  in ${String(v.files).padStart(3)} file(s)  ${k}`);
  }
}
