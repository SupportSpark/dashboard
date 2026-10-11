/**
 * Emit one work package per file from the final wiring plan.
 * Each package names the exact import, the exact binding lines, and every
 * replacement, so a worker can edit a file without re-deriving anything.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const data = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "rows-final.json"), "utf8"));
const rows = data.rows.filter((r) => r.key);

const byFile = new Map();
for (const r of rows) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

const outDir = path.join(os.tmpdir(), "pkgs");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const index = [];
for (const [file, frs] of [...byFile].sort()) {
  const side = file.includes("/agent-network/") ? "agentNetwork" : "controlCenter";
  const needsCommon = frs.some((r) => r.ns === "common");
  const bindings = [`const t = useTranslations("${side}");`];
  if (needsCommon) bindings.push(`const tCommon = useTranslations("common");`);

  const lines = [
    `# ${file}`,
    ``,
    `Area namespace: \`${side}\` | strings: ${frs.length} | needs \`common\`: ${needsCommon ? "yes" : "no"}`,
    ``,
    `## 1. Import (with the other imports; \`import { useTranslations } from "next-intl";\`)`,
    ``,
    `## 2. Bindings — first lines of the component/hook body`,
    ``,
    "```ts",
    ...bindings,
    "```",
    ``,
    `## 3. Replacements`,
    ``,
    `| line | kind | English | replace with |`,
    `| --- | --- | --- | --- |`,
  ];
  for (const r of frs) {
    const v = r.ns === "common" ? "tCommon" : "t";
    const esc = r.text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    lines.push(`| ${r.line} | ${r.kind} | \`${esc}\` | \`${v}(${JSON.stringify(r.key)})\` |`);
  }
  lines.push(
    ``,
    `Notes:`,
    `- In JSX text, wrap in braces: \`<Button>{t("k")}</Button>\`.`,
    `- For an attribute: \`placeholder={t("k")}\` (drop any \`{" "}\` you replaced).`,
    `- In an object/array property (e.g. \`{ title: t("k") }\`) use the bare call.`,
    `- If the value is in a MODULE-LEVEL constant (declared outside the component),`,
    `  convert that constant to a factory taking the translator, e.g.`,
    `  \`const items = (t: (k: string) => string) => [...]\`, and call \`items(t)\``,
    `  inside the component. Do not leave a \`t(\` call at module scope.`,
    `- Keep \`data-testid\` / \`data-cy\` attributes exactly as they are.`,
    `- Do not change any other wording in the file.`,
    ``,
  );

  const name = file.replace(/^src\/modules\//, "").replace(/[/\\]/g, "__").replace(/\.(tsx|ts)$/, ".md");
  fs.writeFileSync(path.join(outDir, name), lines.join("\n"));
  index.push({ file, side, needsCommon, count: frs.length, pkg: path.join(outDir, name) });
}

fs.writeFileSync(path.join(outDir, "_INDEX.json"), JSON.stringify(index, null, 1));

// Six balanced batches for parallel workers.
const order = [...index].sort((a, b) => b.count - a.count);
const batches = [[], [], [], [], [], []];
order.forEach((e, i) => batches[i % 6].push(e));

console.log(`packages: ${index.length}  strings: ${rows.length}`);
for (const [i, es] of batches.entries()) {
  console.log(`\nBATCH${i + 1}: ${es.length} files, ${es.reduce((a, e) => a + e.count, 0)} strings`);
  for (const e of es) console.log(`   ${String(e.count).padStart(3)}  ${e.file}`);
}
fs.writeFileSync(
  path.join(outDir, "_BATCHES.json"),
  JSON.stringify(batches.map((es) => es.map((e) => e.file)), null, 1),
);
