// AST-based: every JsxText node + JSX-child string literal + template literal in
// scope, so nothing hides behind multi-line text or brace wrapping.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const roots = ["src/modules/onboarding", "src/modules/billing"];
const files = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(n) && !/\.(test|stories)\./.test(n)) files.push(p.replace(/\\/g, "/"));
  }
}
for (const r of roots) walk(r);

const ALLOW = /^(NetBird|AWS|HubSpot|Claude Code|Codex|OpenAI|Anthropic|Vertex AI|Bedrock|vLLM|cURL|All|Users|Routing Peers|Default|Team|Business|Personal|Other|Free|Slack|GitHub|RDP|SSH|DNS|API|URL|IDP|SSO|MFA|Trial|MSP|ICMP|TCP|UDP|true|false|1-5|5-50|50-300|300-1000|1000\+)$/;

const out = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);

  const report = (text, node) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!/[A-Za-z]{3,}/.test(t)) return;      // no word
    if (!/[A-Za-z]/.test(t)) return;
    if (t.length < 3) return;
    if (ALLOW.test(t)) return;
    if (!/[A-Z]/.test(t)) return;             // needs a capital → prose, not css
    if (/^[a-z0-9:/[\].%_-]+$/.test(t)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push(`${f}:${line}  ${JSON.stringify(t)}`);
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) report(node.text, node);
    // {"literal"} children and any bare string in a JSX child position.
    if (ts.isStringLiteral(node)) {
      const p = node.parent;
      if (p && (ts.isJsxExpression(p) || ts.isJsxAttribute(p) === false && ts.isJsxElement(p.parent ?? p))) {
        report(node.text, node);
      }
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
      report(node.expression.text, node.expression);
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) report(node.text, node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
console.log([...new Set(out)].join("\n"));
console.log("\nTOTAL", new Set(out).size);
