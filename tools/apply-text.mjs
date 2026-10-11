/**
 * Apply the localization wiring by matching the English text itself, not line
 * numbers (line numbers drift as soon as anything is edited).
 *
 * Key facts it relies on:
 *   - `i18n-fragments/agent-network-control-center.json` holds every key this
 *     area needs, plus `common` supplies the universal verbs.
 *   - A file binds `t` to its area namespace and `tCommon` to `common`.
 *
 * For each (file, english, key) pair it rewrites every context in which that
 * literal is user-visible:
 *   >Text<                 -> >{t("k")}<          (JSX child)
 *   attr="Text"            -> attr={t("k")}        (visible attribute)
 *   attr={"Text"}          -> attr={t("k")}
 *   prop: "Text"           -> prop: t("k")         (object property)
 *
 * Then it inserts the translator bindings and the next-intl import.
 *
 * Usage: node tools/apply-text.mjs [--apply] [--only=Substring]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `nb-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}

const en = await load("src/i18n/messages/en.ts");
const FRAG = "i18n-fragments/agent-network-control-center.json";
const frag = JSON.parse(fs.readFileSync(FRAG, "utf8"));

// english -> { ns, key }. Prefer the area fragment; `common` covers universal verbs.
const byValue = new Map();
for (const [ns, ks] of Object.entries(frag))
  for (const [k, v] of Object.entries(ks)) if (!byValue.has(v.en)) byValue.set(v.en, { ns, key: k });
for (const [k, v] of Object.entries(en.common))
  if (typeof v === "string" && !byValue.has(v)) byValue.set(v, { ns: "common", key: k });

const ATTRS = [
  "placeholder", "title", "label", "description", "helpText", "confirmText",
  "cancelText", "loadingMessage", "alt", "aria-label", "tooltip", "message",
];
const PROPS = [
  "label", "title", "description", "confirmText", "cancelText", "loadingMessage",
  "placeholder", "helpText", "tooltip", "subtitle", "heading", "buttonText",
  "message", "emptyState", "text", "content", "alt",
];

const allFiles = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"));
const files = allFiles.filter((f) => (!ONLY || f.includes(ONLY)) && f.match(/modules\/(agent-network|control-center)\//));

const stats = [];
const leftovers = [];

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const original = src;
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  let count = 0;

  // Longest first: a long run must win over a fragment of itself.
  const values = [...byValue.keys()].sort((a, b) => b.length - a.length);

  for (const value of values) {
    const { ns, key } = byValue.get(value);
    if (!src.includes(value)) continue;
    const t = ns === "common" ? "tCommon" : "t";
    const call = `${t}(${JSON.stringify(key)})`;
    const esc = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    let hit = 0;

    // JSX child, allowing the run to be wrapped across lines.
    const jsx = new RegExp(`>(\\s*)${esc}(\\s*)<`, "g");
    src = src.replace(jsx, (m, a, b) => {
      if (m.includes("t(") && /[A-Za-z]t\(/.test(m)) return m;
      hit++;
      return `>{${call}}<`;
    });

    // Visible attributes.
    for (const attr of ATTRS) {
      const forms = [
        new RegExp(`\\b${attr}="\\s*${esc}\\s*"`, "g"),
        new RegExp(`\\b${attr}=\\{\\s*"\\s*${esc}\\s*"\\s*\\}`, "g"),
      ];
      for (const re of forms) {
        src = src.replace(re, () => {
          hit++;
          return `${attr}={${call}}`;
        });
      }
    }

    // Object properties (not JSX attributes — those were consumed above).
    for (const prop of PROPS) {
      const re = new RegExp(`\\b${prop}:\\s*"\\s*${esc}\\s*"`, "g");
      src = src.replace(re, () => {
        hit++;
        return `${prop}: ${call}`;
      });
    }
    if (hit) count += hit;
  }

  if (count) stats.push({ file, side, count });
  if (APPLY && count) {
    // Import, if the file now references a translator.
    if (/\b(t|tCommon)\(/.test(src) && !/from "next-intl"/.test(src)) {
      const lines = src.split("\n");
      let last = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\b/.test(lines[i]) || /^\}\s*from\s+"/.test(lines[i])) last = i;
        else if (last !== -1 && lines[i].trim() !== "" && !/^\s*$/.test(lines[i])) {
          if (i - last > 3) break;
        }
      }
      if (last !== -1) lines.splice(last + 1, 0, `import { useTranslations } from "next-intl";`);
      src = lines.join("\n");
    }
    fs.writeFileSync(file, src);
  } else if (!APPLY) {
    // Dry run: report values in this file that have no key yet.
    for (const value of values) if (src.includes(value)) leftovers.push(file);
  }
  void original;
}

stats.sort((a, b) => b.count - a.count);
console.log(APPLY ? "APPLIED" : "DRY RUN");
console.log(`files touched: ${stats.length}   replacements: ${stats.reduce((a, s) => a + s.count, 0)}`);
for (const s of stats) console.log(String(s.count).padStart(4), s.file);
