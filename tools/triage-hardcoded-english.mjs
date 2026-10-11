#!/usr/bin/env node
/**
 * Triage the hardcoded-English work list.
 *
 * For every string tools/find-hardcoded-english.mjs reports, decide:
 *   REUSE   the exact English value already exists somewhere in en.ts, so the
 *           fix is wiring a t() call to an existing key (no new translation)
 *   NEW     no catalog entry holds this text, so a key and a Chinese
 *           translation both have to be written
 *
 * Also reports which binding the file already has (useTranslations namespace),
 * so a reuse can name the namespace that is already in scope where possible.
 *
 * Usage: node tools/triage-hardcoded-english.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const asJson = process.argv.includes("--json");

async function load(rel, dir) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(dir, `${basename(rel).replace(/\.[jt]s$/, "")}.mjs`);
  writeFileSync(out, js);
  return (await import(pathToFileURL(out).href)).default;
}

const dir = mkdtempSync(join(tmpdir(), "nb-triage-"));
const en = await load("src/i18n/messages/en.ts", dir);

/** value -> [{ns, key}] for every leaf string in the English catalog. */
const byValue = new Map();
(function index(obj, ns, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") index(v, ns, path);
    else if (typeof v === "string" && v.trim()) {
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push({ ns: prefix ? prefix.split(".")[0] : k, key: path });
    }
  }
})(en, null, "");

let raw;
try {
  raw = execFileSync("node", ["tools/find-hardcoded-english.mjs", "--json"], { encoding: "utf8" });
} catch (e) {
  raw = e.stdout;
}
const { findings } = JSON.parse(raw);

/** Which namespaces does the file already bind? */
const fileNs = new Map();
for (const f of new Set(findings.map((x) => x.file))) {
  const src = readFileSync(f, "utf8");
  const ns = [];
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]+)"|'([^']+)')?\s*\)/g)) {
    ns.push({ var: m[1], ns: m[2] ?? m[3] ?? "(root)" });
  }
  fileNs.set(f, ns);
}

const out = [];
for (const f of findings) {
  const hits = byValue.get(f.text) ?? [];
  const bindings = fileNs.get(f.file) ?? [];
  // Prefer a namespace the file already binds.
  const bound = hits.find((h) => bindings.some((b) => b.ns === h.ns));
  out.push({
    ...f,
    status: hits.length ? "REUSE" : "NEW",
    reuse: bound ?? hits[0] ?? null,
    alternatives: hits.filter((h) => h !== (bound ?? hits[0])).slice(0, 4),
    bindings,
  });
}

const reuse = out.filter((x) => x.status === "REUSE");
const fresh = out.filter((x) => x.status === "NEW");

const areaOf = (f) => {
  const p = f.split("/");
  return p.length > 2 ? `${p[1]}/${p[2]}` : p[1];
};

if (asJson) {
  console.log(JSON.stringify({ total: out.length, reuse: reuse.length, new: fresh.length, findings: out }, null, 2));
} else {
  console.log(`Total: ${out.length}   REUSE existing key: ${reuse.length}   NEW translation needed: ${fresh.length}\n`);
  console.log("NEW-by-area (these need writing):");
  const g = new Map();
  for (const x of fresh) {
    const a = areaOf(x.file);
    g.set(a, (g.get(a) ?? 0) + 1);
  }
  for (const [k, v] of [...g].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  console.log("\nREUSE-by-area:");
  const g2 = new Map();
  for (const x of reuse) {
    const a = areaOf(x.file);
    g2.set(a, (g2.get(a) ?? 0) + 1);
  }
  for (const [k, v] of [...g2].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
}
