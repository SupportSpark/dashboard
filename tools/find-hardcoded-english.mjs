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
  "noResultsTitle", "noResultsDescription", "subLabel", "hint", "errorMessage",
]);

/**
 * Object-property names whose string value is user-visible even though the
 * property is not a JSX attribute — e.g. `{ label: "Focus", value: "focus" }`
 * in a menu definition, or `{ title: "...", description: "..." }` passed to
 * notify(). The JSX-attribute pass above only sees the `attr="..."` form.
 */
const VISIBLE_OBJECT_PROPS = new Set([
  ...VISIBLE_ATTRS,
  "title", "shortName", "placeholderText", "confirmButtonText",
  "cancelButtonText", "emptyMessage", "loadingText",
]);

/**
 * TypeScript type positions that are not UI text. Without this, annotations like
 * `onBeforeSave?: () => Promise<boolean>` and `Partial<Group>` are reported.
 */
const TYPE_POSITION_RE =
  /^\s*(?:\w+\??\s*:\s*)?(?:Promise|Partial|Record|Array|Readonly|Pick|Omit|Exclude|Extract|ReturnType|Awaited|Map|Set|WeakMap|WeakSet|Date|Error|React\.\w+)\b|=>\s*(?:Promise|Partial)|:\s*(?:Promise|Partial|Record|Array|Map|Set)</;

/** True when a line is a TS type annotation rather than rendered output. */
function isTypePosition(line) {
  if (TYPE_POSITION_RE.test(line)) return true;
  // `foo?: SomeType;` / `foo: SomeType[]` with no string literal involved.
  if (/^\s*\w+\??\s*:\s*[A-Za-z_$][\w$.<>[\], |]*;?\s*$/.test(line)) return true;
  return false;
}

/** Check whether a candidate is actually human-readable English prose. */
/** Nouns written with the "(s)" plural device: Peer(s), Resource(s), Key(s). */
const NOUN_PLURAL_S = /\b[A-Za-z][a-z]+\(s\)/;

function looksLikeProse(s) {  if (!s) return false;
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
  // Bare TS type names that slipped through as JSX text.
  if (/^(Promise|Partial|Record|Array|Readonly|Map|Set|Date|Error|Function|Object|String|Number|Boolean|void|null|undefined)$/.test(t)) {
    return false;
  }
  // Colour literals: rgb()/rgba()/hsl()/oklch() and their comma-separated parts.
  // The scanner matched `rgba(99, 102, 241, 0.6)` as a short-circuit/ternary
  // candidate because of its internal commas.
  if (/^(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/i.test(t)) return false;
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/.test(t)) return false;

  // The "(s)" plural device: "{peerCount} Peer(s)", "{n} Resource(s)",
  // "Revoke 3 Key(s)". These were invisible to every rule here because the
  // interpolated counter puts a `{` in the text, and the code/markup guard above
  // rejects anything containing a brace. They are unambiguously user-facing copy —
  // and "1 Resource(s)" is exactly the kind of half-English that reads as a bug —
  // so this shape is accepted regardless of the brace.
  if (NOUN_PLURAL_S.test(t)) return true;
  // Tailwind / CSS utility strings. Two shapes appear in practice:
  //   (a) a run of hyphenated lowercase tokens: "flex items-center gap-2"
  //   (b) a token containing a Tailwind variant prefix or a slash/percent
  //       modifier: "hover:bg-nb-gray-930", "dark:hover:bg-x/[15%]",
  //       "group-hover/trigger:dark:bg-y", "hover:ring-2 ring-white"
  // Both are class names, never user-visible prose.
  //
  // NOTE: these patterns are deliberately CASE-SENSITIVE. With the `i` flag a
  // character class like [a-z0-9:/._-] also matches capitals, so "Save Changes"
  // would be classified as a class-name run and silently dropped from the work
  // list. Utility strings are lowercase by construction, so requiring lowercase
  // is both correct and much safer.
  const utilityRun = /^[a-z0-9:/[\].%_-]+(?:\s+[a-z0-9:/[\].%_-]+)*$/;
  if (utilityRun.test(t)) return false;
  if (/(?:^|\s)[a-z-]+:[a-z0-9:[\]/.%_-]+/.test(t) && !/[A-Z]/.test(t)) return false;
  // A run of only lowercase/hyphen/slash/percent tokens with no uppercase and no
  // sentence punctuation is styling, not copy.
  if (!/[A-Z]/.test(t) && /^[a-z0-9][a-z0-9\s:/[\].%_-]*$/.test(t)) return false;
  // Numbers with units, and spacing/sizing shorthands.
  if (/^\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)$/.test(t)) return false;
  // Data-URL / base64 / SVG path fragments.
  if (/^data:|^M\d/.test(t)) return false;
  return true;
}

// `--area` is a plain path prefix, NOT a git pathspec. A pathspec glob like
// "src/modules/x/**/*.tsx" silently excludes direct children of x, which made
// --area under-report by ~95%. Filter the full file list instead.
const allFiles = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && /\.(tsx?|ts)$/.test(f));

const files = allFiles.filter(
  (f) => !/\.test\.|\.stories\.|src\/i18n\//.test(f) && (!area || f.startsWith(`src/${area}/`)),
);

const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Skip comments outright.
    if (/^(\/\/|\*|\/\*)/.test(trimmed)) return;
    if (isTypePosition(line)) return;
    // A line that already translates something is normally done, but it can
    // still hold a second, untranslated literal (e.g. two props on one line),
    // so we no longer skip the line wholesale — only lines that are *entirely*
    // a single t() call are redundant to scan.
    const lineIsPureTCall = /^\s*\{?\s*t[A-Za-z]*\([^)]*\)\s*\}?,?\s*$/.test(line);

    if (!lineIsPureTCall) {
      // 1. JSX text nodes: >Some Text<
      for (const m of line.matchAll(/>\s*([A-Z][^<>{}]*?[a-zA-Z])\s*</g)) {
        const s = m[1].trim();
        if (looksLikeProse(s)) {
          findings.push({ file, line: idx + 1, kind: "jsx-text", text: s });
        }
      }

      // 1b. JSX text on its OWN line, following a tag on the previous one:
      //
      //       <PenSquare size={16} />
      //       Edit
      //
      // The rule above is line-scoped, so it never sees the `>` that closes the
      // previous tag and misses the text entirely. Two real strings survived a
      // full localization pass this way (the target row's Edit/Delete buttons and
      // the add-service modal's "Learn more about"), and the build, tsc and key
      // gates cannot see them either — only a reader can.
      if (idx > 0 && /\/?>\s*$/.test(lines[idx - 1].trim())) {
        const text = trimmed;
        const isBareProse =
          /^[A-Za-z][A-Za-z0-9 ,.'’\-]*$/.test(text) && !text.includes("{");
        // Exclude code that merely happens to start with a capital or sit after a
        // tag: statement keywords, type members and single identifiers.
        const isCode =
          /^(const|let|var|import|export|return|type|interface|function|case|break|await|throw|new|else|try|catch|default)\b/.test(
            text,
          ) || !/[\s.]/.test(text);
        if (isBareProse && !isCode && looksLikeProse(text)) {
          findings.push({ file, line: idx + 1, kind: "jsx-text-line", text });
        }
      }
    }

    // 2. visible string attributes
    for (const m of line.matchAll(/([A-Za-z-]+)\s*=\s*"([^"{}]+)"/g)) {
      const [, attr, val] = m;
      if (NON_VISIBLE_ATTRS.has(attr)) continue;
      if (!VISIBLE_ATTRS.has(attr)) continue;
      if (looksLikeProse(val)) {
        findings.push({ file, line: idx + 1, kind: `attr:${attr}`, text: val.trim() });
      }
    }

    // 3. object properties: { label: "Focus" }, notify({ title: "..." })
    for (const m of line.matchAll(/(?:^|[\s,{])([A-Za-z-]+)\s*:\s*"([^"]+)"/g)) {
      const [, prop, val] = m;
      if (!VISIBLE_OBJECT_PROPS.has(prop)) continue;
      if (looksLikeProse(val)) {
        findings.push({ file, line: idx + 1, kind: `prop:${prop}`, text: val.trim() });
      }
    }

    // 4. toast/alert with a plain string
    for (const m of line.matchAll(/\b(?:toast(?:\.\w+)?|alert)\(\s*"([^"]+)"/g)) {
      if (looksLikeProse(m[1])) {
        findings.push({ file, line: idx + 1, kind: "toast", text: m[1].trim() });
      }
    }
  });

  // 5. Multi-line string values: `description:` then a newline then "Text".
  //    These are invisible to a line-oriented scan.
  for (let i = 0; i < lines.length - 1; i++) {
    const m = lines[i].match(/(?:^|[\s,{])([A-Za-z-]+)\s*:\s*$/);
    if (!m) continue;
    if (!VISIBLE_OBJECT_PROPS.has(m[1])) continue;
    const next = lines[i + 1].trim();
    const nm = next.match(/^"([^"]+)",?$/);
    if (nm && looksLikeProse(nm[1])) {
      findings.push({ file, line: i + 1, kind: `prop:${m[1]}(multiline)`, text: nm[1].trim() });
    }
    // Also handle the template-literal form: `title: \`...\` on the next line.`
  }

  // 6. JSX expression containers holding a bare string: `{cond ? "A" : "B"}`,
  //    `{x && "Text"}`, `<C label={"Text"} />`. These live inside braces, so
  //    neither the attribute pass (needs `attr="..."`) nor the JSX-text pass
  //    (needs `>Text<`) sees them. This was the largest reported blind spot.
  //
  //    Careful: a ternary that compares against a literal and returns the same
  //    literal (`x === "CrowdStrike" ? "CrowdStrike" : "CrowdStrike"`) is an
  //    identifier comparison, not user-facing prose. Those are filtered below.
  lines.forEach((line, idx) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (isTypePosition(line)) return;

    /**
     * Reject a candidate that is not itself rendered text:
     *   - echoing a literal used for comparison
     *     (`x === "CrowdStrike" ? "CrowdStrike" : "CrowdStrike"`)
     *   - passed as an interpolation *argument* to t(), e.g.
     *     `t("key", { name: "CrowdStrike" })` — the brand name is data, and the
     *     template around it is already translated
     */
    const isComparisonEcho = (s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `(?:===?\\s*"${escaped}"|!==?\\s*"${escaped}"|includes\\(\\s*"${escaped}"|case\\s+"${escaped}"|startsWith\\(\\s*"${escaped}")`,
      ).test(line);
    };
    const isTArgument = (s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // `name: "X"` inside a t() interpolation call. We only treat it as an
      // argument (and not as user-facing prose) when the enclosing call really
      // is a translator — brand names passed to t("key", { name: "Okta" }) are
      // data, whereas `{ name: "Europe (EU-1)" }` in a module-level option
      // array is a rendered dropdown label.
      const looksLikeArg = new RegExp(`\\b(?:name|value|count|id|setting|provider)\\s*:\\s*"${escaped}"`).test(line);
      if (!looksLikeArg) return false;
      // Require the t() call to be on the same line AND to appear before the literal.
      const tIdx = line.search(/\bt[A-Za-z]*\(/);
      const litIdx = line.indexOf(`"${s}"`);
      return tIdx !== -1 && litIdx !== -1 && tIdx < litIdx;
    };
    const reject = (s) => isComparisonEcho(s) || isTArgument(s) || isCodeFragment(s);

    /** Reject fragments that are clearly code, not copy. */
    const isCodeFragment = (s) => {
      // Method calls / property access / comparisons leaked into a candidate.
      if (/^[)\]]?\s*[?.:]|\b\w+\.\w+\(|\)\s*[?.:]|[=<>!]==?/.test(s)) return true;
      // Ends mid-expression.
      if (/[([{.,]$/.test(s) || /^[)\]}]/.test(s)) return true;
      // Contains a JS operator without being a sentence.
      if (/[?&|]{1,2}\s*$/.test(s)) return true;
      return false;
    };

    // `? "Then text"` / `: "Else text"` — ternaries in JSX
    for (const m of line.matchAll(/[?:]\s*"([^"]{3,})"/g)) {
      const s = m[1].trim();
      if (!looksLikeProse(s)) continue;
      if (reject(s)) continue;
      findings.push({ file, line: idx + 1, kind: "jsx-expr:ternary", text: s });
    }
    // `&& "Text"` / `|| "Text"` — short-circuit rendering
    for (const m of line.matchAll(/&&\s*"([^"]{3,})"|\|\|\s*"([^"]{3,})"/g)) {
      const s = (m[1] ?? m[2]).trim();
      if (!looksLikeProse(s)) continue;
      if (reject(s)) continue;
      findings.push({ file, line: idx + 1, kind: "jsx-expr:shortcircuit", text: s });
    }
    // `attr={"Text"}` — same as an attribute but brace-wrapped
    for (const m of line.matchAll(/([A-Za-z-]+)=\{\s*"([^"]+)"\s*\}/g)) {
      const [, attr, val] = m;
      if (NON_VISIBLE_ATTRS.has(attr)) continue;
      if (!VISIBLE_ATTRS.has(attr)) continue;
      const s = val.trim();
      if (!looksLikeProse(s)) continue;
      if (reject(s)) continue;
      findings.push({ file, line: idx + 1, kind: `jsx-expr:attr(${attr})`, text: s });
    }
    // `<Text>{"literal"}</Text>` — a string inside a JSX child expression
    for (const m of line.matchAll(/>\s*\{\s*"([^"]{3,})"\s*\}\s*</g)) {
      const s = m[1].trim();
      if (!looksLikeProse(s)) continue;
      findings.push({ file, line: idx + 1, kind: "jsx-expr:child", text: s });
    }
  });
}

// Group by file, then by area. Dedupe first: the same literal is legitimately
// reachable from more than one pass (an object property `label: "X"` also looks
// like a ternary else-branch), and the work list should count it once.
const deduped = [];
const seenAt = new Set();
for (const f of findings) {
  // The same English text at the same line is one piece of work, whatever pass
  // found it. Keep the first (passes run in usefulness order).
  const id = `${f.file}\u0000${f.line}\u0000${f.text}`;
  if (seenAt.has(id)) continue;
  seenAt.add(id);
  deduped.push(f);
}

const byFile = new Map();
for (const f of deduped) {
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
  console.log(
    JSON.stringify({ total: deduped.length, files: byFile.size, byArea: [...byArea], findings: deduped }, null, 2),
  );
} else {
  console.log(`Hardcoded user-visible English: ${deduped.length} distinct string(s) in ${byFile.size} file(s)\n`);
  console.log("By area:");
  for (const [k, v] of [...byArea].sort((a, b) => b[1].strings - a[1].strings)) {
    console.log(`  ${String(v.strings).padStart(4)}  in ${String(v.files).padStart(3)} file(s)  ${k}`);
  }
}
