/**
 * Wire hardcoded English to translation keys.
 *
 * For every recorded finding it:
 *   1. locates the enclosing function/component by brace+indent analysis,
 *   2. decides whether that scope may call a hook (component or `use*` hook) or
 *      must instead receive `t` as a parameter (plain helper),
 *   3. inserts the translator binding at the top of the body,
 *   4. rewrites the literal to `t("key")` with the right JSX/attribute syntax.
 *
 * Dry-run by default; `--apply` writes. Anything it cannot resolve with
 * confidence is reported and left alone.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const { rows } = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "rows-final.json"), "utf8"));
const work = rows.filter((r) => r.key && (!ONLY || r.file.includes(ONLY)));

const byFile = new Map();
for (const r of work) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

/** Brace-aware scan: find the function-like scope that owns `lineIdx`. */
function findScope(lines, lineIdx) {
  const indentOf = (l) => l.match(/^\s*/)[0].replace(/\t/g, "  ").length;
  const target = indentOf(lines[lineIdx]);

  for (let i = lineIdx - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (indentOf(line) >= target) continue;
    // A scope opener for our purposes ends with `{` and looks function-like.
    if (!/\{\s*$/.test(line)) continue;
    if (!/\b(function\b|=>|\bconst \w+\s*=|\bmemo\(|\bforwardRef\()/.test(line)) continue;

    // Walk forward to the line that closes the parameter list and opens the body.
    let paren = 0;
    let bodyLine = -1;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "(") paren++;
        else if (ch === ")") paren--;
      }
      if (paren <= 0 && /\{\s*$/.test(lines[j])) {
        bodyLine = j;
        break;
      }
    }
    if (bodyLine === -1) continue;

    // Name: `function X(`, `const X = (`.
    const sig = lines.slice(i, bodyLine + 1).join(" ");
    const nm = sig.match(/\b(?:function|const)\s+([A-Za-z_$][\w$]*)/);
    return { name: nm ? nm[1] : null, start: i, bodyLine };
  }
  return null;
}

const isHookable = (name) => !!name && (/^use[A-Z]/.test(name) || /^[A-Z]/.test(name));

const report = { wired: 0, skipped: [], needsParam: [], noMatch: [], collision: [] };

for (const [file, frs] of byFile) {
  let src = fs.readFileSync(file, "utf8");
  const hadCrlf = src.includes("\r\n");
  let lines = src.split("\n").map((l) => l.replace(/\r$/, ""));

  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  const needsCommon = frs.some((r) => r.ns === "common");

  // Group findings per scope so a scope gets one binding insert.
  const scopes = new Map();
  for (const r of frs) {
    const sc = findScope(lines, r.line - 1);
    if (!sc) {
      report.skipped.push(`${file}:${r.line} (no scope)`);
      continue;
    }
    if (!isHookable(sc.name)) {
      report.needsParam.push(`${file}:${r.line} ${JSON.stringify(r.text)} in ${sc.name ?? "?"}()`);
      continue;
    }
    const key = `${sc.start}:${sc.bodyLine}`;
    if (!scopes.has(key)) scopes.set(key, { ...sc, items: [] });
    scopes.get(key).items.push(r);
  }

  // 1) Rewrite literals.
  const edits = [];
  for (const r of frs) {
    const idx = r.line - 1;
    if (idx < 0 || idx >= lines.length) {
      report.noMatch.push(`${file}:${r.line} (out of range)`);
      continue;
    }
    const line = lines[idx];
    if (!line.includes(r.text)) {
      report.noMatch.push(`${file}:${r.line} ${JSON.stringify(r.text.slice(0, 60))}`);
      continue;
    }
    const v = r.ns === "common" ? "tCommon" : "t";
    const call = `${v}(${JSON.stringify(r.key)})`;

    // Decide the syntax from what precedes the literal.
    const at = line.indexOf(r.text);
    const before = line.slice(0, at);
    let repl;
    if (/[A-Za-z-]+=\s*$/.test(before)) repl = `{${call}}`; // JSX attr:  attr="X"
    else if (/\b[A-Za-z]+\s*:\s*$/.test(before)) repl = call; // object prop: title: "X"
    else repl = `{${call}}`; // JSX text node
    edits.push({ idx, from: r.text, to: repl, call, order: at });
  }

  // Apply from the bottom up so earlier positions stay valid.
  edits.sort((a, b) => b.idx - a.idx || b.order - a.order);
  for (const e of edits) {
    const line = lines[e.idx];
    const at = line.indexOf(e.from);
    if (at === -1) continue;
    lines[e.idx] = line.slice(0, at) + e.to + line.slice(at + e.from.length);
    report.wired++;
  }

  // 2) Insert bindings (bottom-up too).
  const inserts = [...scopes.values()].sort((a, b) => b.bodyLine - a.bodyLine);
  for (const sc of inserts) {
    const body = lines[sc.bodyLine];
    const indent = (body.match(/^\s*/)[0] ?? "") + "  ";
    const wanted = [`const t = useTranslations(${JSON.stringify(side)});`];
    if (sc.items.some((i) => i.ns === "common"))
      wanted.push(`const tCommon = useTranslations("common");`);

    const region = lines.slice(sc.bodyLine, sc.bodyLine + 4).join("\n");
    const add = wanted.filter((w) => {
      const name = w.match(/const (\w+)/)[1];
      const declaredAlready = new RegExp(`\\bconst\\s+${name}\\b`).test(region);
      if (declaredAlready) return false;
      // Collision with an existing identifier in this scope?
      const used = new RegExp(`\\b${name}\\b`).test(region.split("\n").slice(1).join("\n"));
      if (used && !declaredAlready) report.collision.push(`${file} ${name} already used near line ${sc.bodyLine + 1}`);
      return true;
    });
    if (add.length) lines.splice(sc.bodyLine + 1, 0, ...add.map((w) => indent + w));
  }

  // 3) Import.
  if (!lines.some((l) => /from "next-intl"/.test(l))) {
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\b/.test(lines[i]) || /^\}\s*from\s+"/.test(lines[i])) last = i;
      if (i > 5 && last !== -1 && !/^\s*import\b/.test(lines[i]) && !/^\}\s*from\s+"/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        if (i - last > 2) break;
      }
    }
    if (last === -1) report.skipped.push(`${file} (no import anchor)`);
    else lines.splice(last + 1, 0, `import { useTranslations } from "next-intl";`);
  }

  if (APPLY) {
    let out = lines.join("\n");
    if (hadCrlf) out = out.replace(/\n/g, "\r\n");
    fs.writeFileSync(file, out);
  }
}

console.log(APPLY ? "APPLIED" : "DRY RUN");
console.log(`literals rewritten: ${report.wired}`);
for (const [label, arr] of [
  ["needs t as parameter (left alone)", report.needsParam],
  ["literal not found on line (left alone)", report.noMatch],
  ["no enclosing scope found", report.skipped],
  ["possible name collision", report.collision],
]) {
  console.log(`\n### ${label}: ${arr.length}`);
  for (const a of arr.slice(0, 40)) console.log("   " + a);
  if (arr.length > 40) console.log(`   ... +${arr.length - 40} more`);
}
