/**
 * Insert translator bindings where tsc reports `t` / `tCommon` undefined.
 *
 * Uses the TypeScript AST rather than brace guessing: for each error it finds
 * the innermost enclosing hook-capable function (a component or a `use*` hook),
 * and inserts the binding as the first statement of that function's body.
 *
 * Where the nearest enclosing function is a plain helper, the binding would be
 * an illegal hook call, so the translator is threaded through as a parameter
 * instead: the helper gains a `t` / `tCommon` parameter and every call site in
 * the same file passes the binding.
 *
 * Usage: node tools/add-bindings2.mjs [--apply] [--only=Substring]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const raw = (() => {
  try {
    return execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", shell: true });
  } catch (e) {
    return e.stdout ?? "";
  }
})();

const errors = [...raw.matchAll(/^(.+?)\((\d+),(\d+)\): error TS2304: Cannot find name '(t|tCommon)'/gm)]
  .map((m) => ({ file: m[1].replace(/\\/g, "/"), line: +m[2], name: m[4] }))
  .filter((e) => e.file.includes("modules/agent-network/") || e.file.includes("modules/control-center/"))
  .filter((e) => !ONLY || e.file.includes(ONLY));

console.log(`TS2304 t/tCommon errors in scope: ${errors.length}`);

const byFile = new Map();
for (const e of errors) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

const hookable = (n) => !!n && (/^use[A-Z]/.test(n) || /^[A-Z]/.test(n));

/** Walk AST ancestors of `pos` and return the nearest function-like node. */
function enclosingFunctions(sf, pos) {
  const out = [];
  const visit = (node) => {
    if (pos >= node.getStart(sf) && pos <= node.getEnd()) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)
      ) {
        out.push(node);
      }
      ts.forEachChild(node, visit);
    }
  };
  visit(sf);
  return out; // outermost -> innermost
}

const nameOf = (node, sf) => {
  if (!node) return null;
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  if (ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  return null;
};

const patched = [];
const threaded = [];

for (const [file, errs] of byFile) {
  const src = fs.readFileSync(file, "utf8");
  const hadCrlf = src.includes("\r\n");
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const inserts = new Map(); // body start pos -> Set(names)
  const paramsNeeded = new Map(); // node -> Set(names)

  for (const e of errs) {
    const pos = sf.getPositionOfLineAndCharacter(e.line - 1, 0);
    const chain = enclosingFunctions(sf, pos);
    // innermost hook-capable function wins
    let host = null;
    for (let i = chain.length - 1; i >= 0; i--) {
      if (hookable(nameOf(chain[i], sf))) {
        host = chain[i];
        break;
      }
    }
    if (host) {
      const body = host.body;
      if (body && ts.isBlock(body)) {
        if (!inserts.has(body.getStart(sf))) inserts.set(body.getStart(sf), new Set());
        inserts.get(body.getStart(sf)).add(e.name);
        continue;
      }
    }
    // Otherwise thread it through the innermost function that owns the name.
    const inner = chain[chain.length - 1] ?? chain[chain.length - 1];
    if (inner) {
      if (!paramsNeeded.has(inner)) paramsNeeded.set(inner, new Set());
      paramsNeeded.get(inner).add(e.name);
    }
  }

  let edits = [];
  for (const [pos, names] of inserts) {
    const line = sf.getLineAndCharacterOfPosition(pos).line;
    const indent = (src.split("\n")[line].match(/^\s*/)?.[0] ?? "") + "  ";
    const text = [...names]
      .map((n) => (n === "tCommon" ? `const tCommon = useTranslations("common");` : `const t = useTranslations(${JSON.stringify(side)});`))
      .join("\n" + indent);
    edits.push({ pos: pos + 1, text: "\n" + indent + text });
  }

  // Thread helpers: add the parameter and pass it at call sites.
  for (const [node, names] of paramsNeeded) {
    const nm = nameOf(node, sf);
    if (!nm) continue;
    threaded.push(`${file} ${nm}() <- ${[...names].join(", ")}`);
  }

  if (APPLY && edits.length) {
    edits.sort((a, b) => b.pos - a.pos);
    let out = src;
    for (const e of edits) out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
    if (hadCrlf) out = out.replace(/(?<!\r)\n/g, "\r\n");
    fs.writeFileSync(file, out);
    patched.push(file);
  }
}

console.log(`bodies to patch: ${[...byFile.keys()].length} file(s), ${patched.length} written`);
console.log(`\n=== helpers needing the translator threaded through: ${threaded.length} ===`);
for (const t of threaded.slice(0, 80)) console.log("   " + t);
if (threaded.length > 80) console.log(`   ... +${threaded.length - 80} more`);
