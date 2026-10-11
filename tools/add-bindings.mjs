/**
 * Insert translator bindings where tsc says `t` / `tCommon` is undefined.
 *
 * For each TS2304 error it finds the innermost enclosing function-like body and
 * inserts the binding there. Function-like bodies that cannot call a hook
 * (plain helpers, module-scope constants) are reported instead of patched, so
 * they can be handled by passing `t` in as a parameter.
 *
 * Usage: node tools/add-bindings.mjs [--apply]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");

const raw = (() => {
  try {
    return execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", shell: true });
  } catch (e) {
    return e.stdout ?? "";
  }
})();

const errors = [...raw.matchAll(/^(.+?)\((\d+),(\d+)\): error TS2304: Cannot find name '(t|tCommon)'/gm)]
  .map((m) => ({ file: m[1].replace(/\\/g, "/"), line: +m[2], name: m[4] }))
  .filter((e) => e.file.includes("modules/agent-network/") || e.file.includes("modules/control-center/"));

console.log(`TS2304 t/tCommon errors in scope: ${errors.length}`);

const byFile = new Map();
for (const e of errors) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

/** Walk up from `line` to the nearest function-like body opening. */
function scopeFor(lines, line) {
  const indentOf = (l) => (l.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "  ").length;
  const target = indentOf(lines[line] ?? "");

  for (let i = line; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (i !== line && indentOf(l) >= target + 1) continue;
    if (!/\{\s*$/.test(l) && !/^\s*\{\s*$/.test(l)) continue;
    // Scan upward for the signature this body belongs to.
    for (let j = i; j >= Math.max(0, i - 25); j--) {
      const sig = lines.slice(j, i + 1).join(" ");
      const m = sig.match(/\b(?:function|const)\s+([A-Za-z_$][\w$]*)\s*[=(]/);
      if (m && /\b(?:function|=>|\))\b/.test(sig.slice(0, sig.indexOf(m[0]) + m[0].length + 40))) {
        return { name: m[1], bodyLine: i, indent: indentOf(lines[i]) + 2 };
      }
      if (/^\s*(export\s+)?(default\s+)?(function|const|export)\b/.test(lines[j])) break;
    }
    return { name: null, bodyLine: i, indent: indentOf(lines[i]) + 2 };
  }
  return null;
}

const hookable = (n) => !!n && (/^use[A-Z]/.test(n) || /^[A-Z]/.test(n));
const patched = [];
const needsParam = [];

for (const [file, errs] of byFile) {
  let src = fs.readFileSync(file, "utf8");
  const hadCrlf = src.includes("\r\n");
  const lines = src.split(/\r?\n/);
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";

  const targets = new Map(); // bodyLine -> { names:Set, scope }
  for (const e of errs) {
    const sc = scopeFor(lines, e.line - 1);
    if (!sc) {
      needsParam.push(`${file}:${e.line} (no scope)`);
      continue;
    }
    if (!hookable(sc.name)) {
      needsParam.push(`${file}:${e.line} ${e.name} in ${sc.name ?? "(anonymous)"}()`);
      continue;
    }
    if (!targets.has(sc.bodyLine)) targets.set(sc.bodyLine, { names: new Set(), scope: sc, lines: [] });
    targets.get(sc.bodyLine).names.add(e.name);
    targets.get(sc.bodyLine).lines.push(e.line);
  }

  for (const [bodyLine, info] of [...targets].sort((a, b) => b[0] - a[0])) {
    const insert = [...info.names].map((n) =>
      n === "tCommon" ? `const tCommon = useTranslations("common");` : `const t = useTranslations(${JSON.stringify(side)});`,
    );
    const already = lines.slice(bodyLine + 1, bodyLine + 4).join("\n");
    const add = insert.filter((s) => !already.includes(s));
    if (add.length) lines.splice(bodyLine + 1, 0, ...add.map((s) => " ".repeat(info.scope.indent) + s));
  }

  if (APPLY) {
    let out = lines.join("\n");
    if (hadCrlf) out = out.replace(/\n/g, "\r\n");
    fs.writeFileSync(file, out);
    patched.push(file);
  }
}

console.log(APPLY ? `patched ${patched.length} file(s)` : `would patch ${new Set([...byFile.keys()]).size} file(s)`);
console.log(`\n=== cannot call a hook there: ${needsParam.length} ===`);
for (const n of needsParam.slice(0, 60)) console.log("   " + n);
if (needsParam.length > 60) console.log(`   ... +${needsParam.length - 60} more`);
