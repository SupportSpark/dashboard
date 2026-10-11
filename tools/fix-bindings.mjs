/**
 * Insert the translator bindings that check-wiring.mjs reports as missing.
 *
 * For every `t(` / `tCommon(` call inside a component or `use*` hook, it adds
 * `const t = useTranslations("<namespace>")` as the first statement of that
 * function's block — unless the block already declares it.
 *
 * Calls that sit outside any component/hook (module-level constants and plain
 * helpers) cannot use a hook and are reported instead, for the factory refactor.
 *
 * Usage: node tools/fix-bindings.mjs [--apply] [scopeSubstring]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const APPLY = process.argv.includes("--apply");
const scope = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "modules/";
const files = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "scope-files.json"), "utf8"))
  .filter((f) => f.includes(scope));

const cannotHook = [];
let patchedFiles = 0;
let inserted = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!/\b(t|tCommon)\(/.test(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";

  /** body start pos -> Set of names needed */
  const need = new Map();
  const report = (node, name) => {
    // Enclosing hook-capable function.
    let p = node.parent;
    let host = null;
    while (p) {
      if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p)) {
        const nm =
          (p.name && ts.isIdentifier(p.name) && p.name.text) ||
          (ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
          (ts.isPropertyAssignment(p.parent) && ts.isIdentifier(p.parent.name) && p.parent.name.text) ||
          null;
        if (nm && (/^use[A-Z]/.test(nm) || /^[A-Z]/.test(nm))) {
          host = p;
          break;
        }
        // A plain function that is NOT a component/hook: cannot hold the binding.
        if (nm && !/^use[A-Z]/.test(nm) && !/^[A-Z]/.test(nm)) {
          cannotHook.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${name}(…) in ${nm}()`);
          return;
        }
      }
      p = p.parent;
    }
    if (!host) {
      cannotHook.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${name}(…) at module scope`);
      return;
    }
    const body = host.body;
    if (!body || !ts.isBlock(body)) {
      cannotHook.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${name}(…) in a concise arrow body`);
      return;
    }
    const key = body.getStart(sf);
    if (!need.has(key)) need.set(key, { body, names: new Set() });
    need.get(key).names.add(name);
  };

  const walk = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["t", "tCommon"].includes(node.expression.text)) {
      // Skip the hook declaration itself (`useTranslations(...)` isn't named t).
      const already = (() => {
        let q = node.parent;
        while (q) {
          if (ts.isBlock(q)) {
            for (const st of q.statements) {
              if (
                ts.isVariableStatement(st) &&
                st.declarationList.declarations.some(
                  (d) => ts.isIdentifier(d.name) && d.name.text === node.expression.text,
                )
              ) {
                return true;
              }
            }
          }
          q = q.parent;
        }
        return false;
      })();
      if (!already) report(node, node.expression.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);

  if (need.size === 0) continue;

  // Insert bottom-up so offsets stay valid.
  let out = src;
  const inserts = [...need.entries()].sort((a, b) => b[0] - a[0]);
  for (const [pos, { names }] of inserts) {
    const line = sf.getLineAndCharacterOfPosition(pos).line;
    const indent = (src.split("\n")[line].match(/^\s*/)?.[0] ?? "") + "  ";
    const decls = [...names]
      .sort()
      .map((n) => (n === "tCommon" ? `const tCommon = useTranslations("common");` : `const t = useTranslations(${JSON.stringify(side)});`));
    out = out.slice(0, pos + 1) + "\n" + decls.map((d) => indent + d).join("\n") + out.slice(pos + 1);
    inserted += decls.length;
  }

  if (!/from "next-intl"/.test(out)) {
    const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let at = 0;
    for (const st of sf2.statements) if (ts.isImportDeclaration(st)) at = st.getEnd();
    out = `${out.slice(0, at)}\nimport { useTranslations } from "next-intl";${out.slice(at)}`;
  }

  if (APPLY) {
    fs.writeFileSync(file, out);
    patchedFiles++;
  }
}

console.log(APPLY ? "APPLIED" : "DRY RUN");
console.log(`files to patch: ${APPLY ? patchedFiles : "?"}   bindings inserted: ${inserted}`);
console.log(`\n=== cannot call a hook (need factory / manual work): ${cannotHook.length} ===`);
const grouped = new Map();
for (const c of cannotHook) {
  const k = c.split(" ").slice(1).join(" ");
  if (!grouped.has(k)) grouped.set(k, []);
  grouped.get(k).push(c.split(":")[0]);
}
for (const [k, fs2] of grouped) console.log(`   ${k}  <- ${[...new Set(fs2.map((f) => f.replace("src/modules/", "")))].join(", ")}`);
