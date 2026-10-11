#!/usr/bin/env node
/**
 * Find catalog messages that THROW when rendered.
 *
 * Why this exists
 * ---------------
 * `check-translation-keys.mjs` proves a key resolves. It does not prove the
 * message can be rendered, and next-intl throws at render time for:
 *
 *   - malformed ICU (a plural with no `other` branch, an unclosed brace,
 *     a stray `#` outside a plural, `{count, plural, ...}` missing branches)
 *   - `t.rich()` whose message references a tag the call site did not provide
 *     (`Unable to find tag "code"`)
 *
 * A throw during render is caught by Next.js's error boundary, which replaces
 * the page with its built-in "This page couldn't load" screen. That looks like
 * a network failure but is a crash, and neither `tsc` nor the key checker nor
 * the build can see it: the message is only parsed when the component renders.
 *
 * Usage:
 *   node tools/check-message-rendering.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");
const ROOT = process.cwd();

async function loadCatalog(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, rel.replace(/[\\/]/g, "_").replace(/\.ts$/, ".mjs"));
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-render-"));
const en = await loadCatalog("src/i18n/messages/en.ts", dir);
const zh = await loadCatalog("src/i18n/messages/zh.ts", dir);

// intl-messageformat is what next-intl parses messages with.
const { default: IntlMessageFormat } = await import("intl-messageformat");

/** Every source file under src/. */
function walk(dirPath) {
  const out = [];
  for (const name of readdirSync(dirPath)) {
    const p = join(dirPath, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(join(ROOT, "src"));

/** Tags referenced by a message, e.g. `<code>` / `</b>`. */
function tagsIn(message) {
  const set = new Set();
  for (const m of message.matchAll(/<\/?([a-zA-Z][\w-]*)\s*>/g)) set.add(m[1]);
  return set;
}

/** Dummy values so the message has something to interpolate. */
function dummyValues(message) {
  const v = {};
  for (const m of message.matchAll(/\{\s*([a-zA-Z_$][\w$]*)\s*[,}]/g)) v[m[1]] = "X";
  for (const m of message.matchAll(/\{\s*([a-zA-Z_$][\w$]*)\s*,/g)) v[m[1]] = 1;
  return v;
}

/**
 * Variables the message needs, excluding rich tags (which arrive as render
 * functions rather than data).
 */
function varsIn(message) {
  const set = new Set();
  for (const m of message.matchAll(/\{\s*([a-zA-Z_$][\w$]*)\s*[,}]/g)) set.add(m[1]);
  const tags = tagsIn(message);
  for (const t of tags) set.delete(t);
  return set;
}

/**
 * Top-level keys of the object literal starting at `start`, plus whether the
 * call passed anything at all.
 */
function objectKeys(src, start) {
  let i = start;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== "{") return null; // no values argument
  let depth = 0;
  let end = i;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  const body = src.slice(i + 1, end);
  const keys = new Set();
  let d = 0;
  let cur = "";
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (ch === "{" || ch === "(" || ch === "[") d++;
    else if (ch === "}" || ch === ")" || ch === "]") d--;
    if (d === 0 && /[\w$]/.test(ch)) cur += ch;
    else if (d === 0 && /[\s:]/.test(ch)) {
      if (cur && /[\s]*:/.test(body.slice(j, j + 2))) keys.add(cur);
      cur = "";
    } else if (d === 0) cur = "";
  }
  // Shorthand properties: `{ count, name }`
  for (const m of body.matchAll(/(?:^|[,{\s])([a-zA-Z_$][\w$]*)\s*(?=[,}]|$)/g)) keys.add(m[1]);
  return keys;
}

const problems = [];
let compiled = 0;
let richCalls = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  // translator bindings, resolved per call site (same approach as the key checker)
  const bindings = [];
  const re = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:"([^"]+)"|'([^']+)')?\s*\)/g;
  for (const m of src.matchAll(re)) {
    bindings.push({ name: m[1], ns: m[2] ?? m[3] ?? null, line: src.slice(0, m.index).split("\n").length });
  }
  bindings.sort((a, b) => a.line - b.line);
  const bindingAt = (name, line) => {
    let found;
    for (const b of bindings) if (b.name === name && b.line <= line) found = b;
    if (found) return found;
    const all = bindings.filter((b) => b.name === name);
    const ns = new Set(all.map((b) => b.ns));
    return ns.size === 1 ? all[0] : undefined;
  };

  // `t.rich("key", { ... })` and `t("key")`
  for (const m of src.matchAll(/\b(\w+)\.rich\(\s*"([^"]+)"\s*,\s*\{/g)) {
    const line = src.slice(0, m.index).split("\n").length;
    const b = bindingAt(m[1], line);
    if (!b || !b.ns) continue;
    richCalls++;

    // Grab the balanced object literal that follows.
    let depth = 0;
    let end = m.index + m[0].length - 1;
    for (let i = end; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const obj = src.slice(m.index + m[0].length - 1, end + 1);
    // Tag keys at the top level of that object: `code: (chunks) => ...`
    const provided = new Set();
    let d = 0;
    let key = "";
    for (let i = 0; i < obj.length; i++) {
      const ch = obj[i];
      if (ch === "{") d++;
      else if (ch === "}") d--;
      if (d === 1 && /[\w$]/.test(ch)) key += ch;
      if (d === 1 && ch === ":") {
        if (key.trim()) provided.add(key.trim());
        key = "";
      }
      if (d === 1 && (ch === "," || ch === "\n")) key = "";
    }

    const msg = en[b.ns]?.[m[2]] ?? zh[b.ns]?.[m[2]];
    if (typeof msg !== "string") continue;
    const needed = tagsIn(msg);
    const missing = [...needed].filter((t) => !provided.has(t));
    if (missing.length) {
      problems.push({
        kind: "missing-rich-tag",
        file: rel,
        line,
        namespace: b.ns,
        key: m[2],
        detail: `message uses <${missing.join(">, <")}> but the call site provides only {${[...provided].join(", ")}}`,
      });
    }
  }

  // Compile every literal message referenced from this file, and check that the
  // call site actually supplies the variables the message asks for. next-intl
  // THROWS on a missing variable, which blanks the page.
  for (const m of src.matchAll(/\b(\w+)(\.rich)?\(\s*"([^"]+)"(\s*,)?/g)) {
    const line = src.slice(0, m.index).split("\n").length;
    const b = bindingAt(m[1], line);
    if (!b || !b.ns) continue;
    const isRich = Boolean(m[2]);
    const key = m[3];
    if (/[.{}]/.test(key)) continue;
    const afterKey = m.index + m[0].length;
    const provided = m[4] ? objectKeys(src, afterKey) : null;
    for (const [label, cat] of [["en", en], ["zh", zh]]) {
      const msg = cat[b.ns]?.[key];
      if (typeof msg !== "string") continue;
      compiled++;

      // (a) required variables supplied?
      //
      // Rather than guessing which `{...}` are variables with a regex — which
      // flags the literal branch text in `{count, plural, one {group} other
      // {# groups}}` — format using ONLY the keys the call site actually passes.
      // That is exactly what next-intl does, so the real ICU parser decides.
      try {
        const msgTags = tagsIn(msg);
        const values = {};
        if (provided) {
          for (const k of provided) {
            // A provided key that is also a tag in the message is a render
            // function, not data. Setting it to 1 here would make ICU throw
            // "Value for X must be of type function" — a false positive that
            // buried the real problems under 580 lines of noise.
            if (msgTags.has(k)) continue;
            values[k] = 1;
          }
        }
        if (isRich) for (const tag of msgTags) values[tag] = (chunks) => chunks;
        new IntlMessageFormat(msg, label).format(values);
      } catch (e) {
        const raw = String(e.message);
        const isMissingVar = /context variable .* was not provided/.test(raw);
        problems.push({
          kind: isMissingVar ? "missing-variable" : "unrenderable-message",
          file: rel,
          line,
          namespace: `${b.ns} (${label})`,
          key,
          detail: raw.slice(0, 200),
          message: msg.slice(0, 160),
        });
      }
    }
  }
}

// De-duplicate: the same broken key is reported once per call site.
const seen = new Set();
const unique = problems.filter((p) => {
  const k = `${p.kind}|${p.namespace}|${p.key}|${p.detail}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

/**
 * Hook calls at MODULE scope.
 *
 * `const t = useTranslations("ns")` placed at the top level of a file — instead
 * of inside a component — runs when the module is first imported. React throws
 * "Invalid hook call", the module fails to load, and Next.js replaces the page
 * with its "This page couldn't load" screen.
 *
 * This is the one that actually took a production page down: the binding had
 * been lifted out of the component body (it even kept the body's indentation),
 * and nothing else could see it. `tsc` accepts it, the key checker accepts it,
 * and `next build` accepts it because the module only throws in the browser.
 */
function moduleScopeHooks(file, src) {
  const found = [];
  const lines = src.split("\n");
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(
      /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:useTranslations|useLocale|useNow|useTimeZone|useFormatter|useMessages|useExtracted)\s*\(/,
    );
    if (m && depth === 0) {
      found.push({ file, line: i + 1, name: m[1], text: line.trim() });
    }
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }
  return found;
}

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  for (const h of moduleScopeHooks(rel, readFileSync(file, "utf8"))) {
    unique.push({
      kind: "module-scope-hook",
      file: h.file,
      line: h.line,
      namespace: "(module scope)",
      key: h.name,
      detail:
        "React hook called at module scope: throws 'Invalid hook call' on import and blanks the page. Move it inside the component.",
    });
  }
}

if (asJson) {
  console.log(JSON.stringify({ compiled, richCalls, problems: unique }, null, 2));
} else {
  console.log(`Compiled ${compiled} message instance(s); inspected ${richCalls} t.rich() call(s).`);
  if (unique.length === 0) {
    console.log("OK: every referenced message parses and every rich tag is provided.");
  } else {
    console.log(`\nPROBLEMS (${unique.length}) - these THROW at render and blank the page:\n`);
    for (const p of unique) {
      console.log(`  [${p.kind}] ${p.file}:${p.line}`);
      console.log(`      ${p.namespace}.${p.key}`);
      console.log(`      ${p.detail}`);
      if (p.message) console.log(`      msg: ${JSON.stringify(p.message)}`);
      console.log();
    }
    process.exitCode = 1;
  }
}
