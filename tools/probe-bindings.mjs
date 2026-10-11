import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { rows } = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "rows-final.json"), "utf8"));

const files = [...new Set(rows.map((r) => r.file))].sort();
const hookRe = /\buse(State|Effect|Callback|Memo|Ref|ReactFlow|SWR|Memo|Context|Reducer|LayoutEffect)\b|use[A-Z]/;

console.log("file | use-client | hooks? | ext | first non-import code line");
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const hasUseClient = /^\s*["']use client["']/.test(src);
  const usesHooks = hookRe.test(src);
  const lines = src.split("\n");
  const lastImport = lines.reduce((acc, l, i) => (/^\s*import\b|^\s*}\s*from\s/.test(l) ? i : acc), -1);
  console.log(
    `${f.replace("src/modules/", "")} | ${hasUseClient ? "YES" : "-"} | ${usesHooks ? "hooks" : "-----"} | ${path.extname(f)} | L${lastImport + 1}`,
  );
}
console.log(`\n${files.length} files`);
console.log("use-client count:", files.filter((f) => /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8"))).length);
console.log("hookless (needs review):", files.filter((f) => !hookRe.test(fs.readFileSync(f, "utf8"))).length);
for (const f of files.filter((f) => !hookRe.test(fs.readFileSync(f, "utf8")))) console.log("   ", f);
