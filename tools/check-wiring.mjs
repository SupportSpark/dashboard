/**
 * Independent wiring check — does NOT rely on tsc.
 *
 * tsc stops reporting semantic errors (TS2304) when any file in the project has
 * a syntax error, and parallel workers routinely leave such files in the tree.
 * So this checker reads each file itself and reports:
 *   - a `t(` / `tCommon(` call with no matching binding,
 *   - a binding declared in a scope where a hook cannot run (module level),
 *   - a `tCommon(` call without the `common` binding.
 *
 * Usage: node tools/check-wiring.mjs [scopeSubstring]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const scope = process.argv[2] ?? "modules/";
const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.includes(scope));

const problems = [];
const stats = { files: 0, calls: 0 };

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let any = false;

  const walk = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["t", "tCommon"].includes(node.expression.text)) {
      const name = node.expression.text;
      any = true;
      stats.calls++;

      // Find the enclosing hook-capable function.
      let host = null;
      let p = node.parent;
      while (p) {
        if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p)) {
          const nm =
            (p.name && ts.isIdentifier(p.name) && p.name.text) ||
            (ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
            (ts.isPropertyAssignment(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
            null;
          if (nm && (/^use[A-Z]/.test(nm) || /^[A-Z]/.test(nm))) {
            host = { node: p, name: nm };
            break;
          }
        }
        p = p.parent;
      }
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

      if (!host) {
        problems.push(`${file}:${line} ${name}(…) outside any component/hook — needs the translator passed in`);
        return;
      }

      // Is the binding declared in that host body (or a scope that encloses the
      // call inside it)?
      const body = host.node.body;
      if (!body || !ts.isBlock(body)) {
        problems.push(`${file}:${line} ${name}(…) in a body without a block`);
        return;
      }
      const declared = findBinding(body, name);
      if (!declared) {
        problems.push(`${file}:${line} ${name}(…) used in ${host.name}() but no \`const ${name} = useTranslations(...)\` in that body`);
        return;
      }
      // A binding declared in a nested non-hook function is also illegal.
      let q = declared.parent;
      let illegal = false;
      while (q && q !== body) {
        if (ts.isFunctionDeclaration(q) || ts.isFunctionExpression(q) || ts.isArrowFunction(q)) illegal = true;
        q = q.parent;
      }
      if (illegal) problems.push(`${file}:${line} ${name} binding sits inside a nested function`);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  if (any) stats.files++;
}

function findBinding(block, name) {
  for (const st of block.statements) {
    if (
      ts.isVariableStatement(st) &&
      st.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === name && d.initializer && ts.isCallExpression(d.initializer) && ts.isIdentifier(d.initializer.expression) && d.initializer.expression.text === "useTranslations",
      )
    ) {
      return st;
    }
  }
  return null;
}

console.log(`files with translator calls: ${stats.files}   calls: ${stats.calls}`);
console.log(`problems: ${problems.length}`);
for (const p of problems) console.log("   " + p);
