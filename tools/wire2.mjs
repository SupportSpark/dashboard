/**
 * Wire hardcoded English to translation keys — whitespace-preserving.
 *
 * Every replacement keeps the surrounding whitespace exactly as it was, so JSX
 * indentation and line wrapping survive:
 *   >\n  Some copy\n<             -> >\n  {t("k")}\n<
 *   attr="Some copy"             -> attr={t("k")}
 *   attr={"Some copy"}           -> attr={t("k")}
 *   prop: "Some copy"            -> prop: t("k")
 *
 * Anything that would need a translator at MODULE scope (a constant declared
 * outside a component) is skipped and reported — those need the factory
 * refactor and are handled separately.
 *
 * Usage: node tools/wire2.mjs [--apply] [--only=Substring] [--verbose]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const VERBOSE = process.argv.includes("--verbose");

// ------------------------------------------------------------------ catalogs
async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `nb-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}
const en = await load("src/i18n/messages/en.ts");
const frag = JSON.parse(fs.readFileSync("i18n-fragments/agent-network-control-center.json", "utf8"));

// Values already in the catalogs, longest first so a long run wins over a
// fragment of itself.
const entries = [];
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) entries.push({ value: v.en, ns, key: k });
for (const [k, v] of Object.entries(en.common))
  if (typeof v === "string" && v.trim()) entries.push({ value: v, ns: "common", key: k });
entries.sort((a, b) => b.value.length - a.value.length);

const ATTRS = [
  "placeholder", "title", "label", "description", "helpText", "confirmText",
  "cancelText", "loadingMessage", "alt", "aria-label", "tooltip", "message",
];
const PROPS = [
  "label", "title", "description", "confirmText", "cancelText", "loadingMessage",
  "placeholder", "helpText", "tooltip", "subtitle", "heading", "buttonText",
  "message", "emptyState", "text", "content", "alt",
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.match(/modules\/(agent-network|control-center)\//))
  .filter((f) => !ONLY || f.includes(ONLY));

/**
 * Does the source position sit inside a hook-capable React function (a
 * component or a `use*` hook)? Only there may a `useTranslations()` binding be
 * read. Returns the enclosing name, or null.
 */
function hookHostAt(sf, pos) {
  const lineAndChar = () => sf.getLineAndCharacterOfPosition(pos);
  void lineAndChar;
  let node = null;
  const visit = (n) => {
    if (pos >= n.getStart(sf) && pos <= n.getEnd()) {
      node = n;
      ts.forEachChild(n, visit);
    }
  };
  visit(sf);

  let p = node;
  while (p) {
    if (
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isArrowFunction(p) ||
      ts.isMethodDeclaration(p)
    ) {
      const nm =
        (p.name && ts.isIdentifier(p.name) && p.name.text) ||
        (ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
        (ts.isPropertyAssignment(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
        null;
      if (nm && (/^use[A-Z]/.test(nm) || /^[A-Z]/.test(nm))) return nm;
    }
    p = p.parent;
  }
  return null;
}

const report = [];
const skippedModule = new Set();
let totalReplacements = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const original = src;
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";

  for (const { value, ns, key } of entries) {
    if (!src.includes(value)) continue;
    const t = ns === "common" ? "tCommon" : "t";
    const call = `${t}(${JSON.stringify(key)})`;
    // Internal whitespace may wrap across lines in JSX text runs.
    const flex = esc(value).replace(/\s+/g, "\\s+");

    const attempt = (re, build) => {
      const matches = [...src.matchAll(re)];
      for (const m of matches) {
        if (/\bt(Common)?\(/.test(m[0])) continue;
        const host = hookHostAt(ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), m.index);
        if (!host) {
          skippedModule.add(`${file}:${src.slice(0, m.index).split("\n").length}`);
          continue;
        }
        // Rebuild the string one match at a time so offsets stay valid.
        src = src.slice(0, m.index) + build(m) + src.slice(m.index + m[0].length);
        return true;
      }
      return false;
    };

    // --- JSX child, single or multi line. Keep leading/trailing whitespace
    //     verbatim so indentation and line wrapping are untouched.
    attempt(new RegExp(`>(\\s*)${flex}(\\s*)<`, "g"), (m) => {
      const inner = m[0].slice(1, -1);
      const lead = inner.match(/^\s*/)[0];
      const trail = inner.match(/\s*$/)[0];
      return `>${lead}{${call}}${trail}<`;
    });

    // --- visible attributes
    for (const attr of ATTRS) {
      attempt(new RegExp(`\\b${attr}="\\s*${flex}\\s*"`, "g"), () => `${attr}={${call}}`);
      attempt(new RegExp(`\\b${attr}=\\{\\s*"\\s*${flex}\\s*"\\s*\\}`, "g"), () => `${attr}={${call}}`);
    }
    // --- object properties
    for (const prop of PROPS) {
      attempt(new RegExp(`\\b${prop}:\\s*"\\s*${flex}\\s*"`, "g"), () => `${prop}: ${call}`);
    }
  }

  if (src !== original) {
    report.push({ file, applied: true });
    totalReplacements += 1;
    if (APPLY) {
      if (!/from "next-intl"/.test(src)) {
        // Place after the last complete import statement.
        const sf3 = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        let at = 0;
        for (const st of sf3.statements) {
          if (ts.isImportDeclaration(st)) at = st.getEnd();
        }
        src = `${src.slice(0, at)}\nimport { useTranslations } from "next-intl";${src.slice(at)}`;
      }
      fs.writeFileSync(file, src);
    }
  }
}

console.log(APPLY ? "APPLIED" : "DRY RUN");
console.log(`files changed: ${report.filter((r) => r.applied).length}`);
console.log(`files skipped (module scope): ${report.filter((r) => !r.applied).length}`);
for (const r of report.filter((r) => !r.applied)) console.log(`   SKIP ${r.file} — ${r.reason}`);
if (VERBOSE) for (const r of report.filter((r) => r.applied)) console.log(`   ok   ${r.file}`);
console.log(`\nmodule-scope lines to handle by hand: ${skippedModule.size}`);
for (const s of [...skippedModule].slice(0, 50)) console.log("   " + s);
