// Final gap report: keys the fragment must supply for the strings still English.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function load(rel, name) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "nb-gap-")), name);
  writeFileSync(out, js);
  return import(pathToFileURL(out).href).then((m) => m.default);
}
const [en, zh] = await Promise.all([
  load("src/i18n/messages/en.ts", "en.mjs"),
  load("src/i18n/messages/zh.ts", "zh.mjs"),
]);

const sibling = new Map();
for (const f of readdirSync("i18n-fragments")) {
  const j = JSON.parse(readFileSync(join("i18n-fragments", f), "utf8"));
  for (const [ns, entries] of Object.entries(j)) {
    if (ns.startsWith("_")) continue;
    for (const [k, v] of Object.entries(entries)) sibling.set(`${ns}.${k}`, { file: f, ...v });
  }
}
const has = (id) => en[id.split(".")[0]]?.[id.split(".")[1]] !== undefined || sibling.has(id);

// Every English string still visible in scope that has no key yet.
const NEEDED = [
  ["onboarding", "agentTestIntro", "Run your agent, or the cURL command from the previous step, on <device>{device}</device>. The request shows up here once NetBird logs it.", "请在<device>{device}</device>上运行您的智能体，或使用上一步中的 cURL 命令。NetBird 记录后，请求会显示在这里。"],
  ["onboarding", "requestReachedProvider", "Your request reached {provider}{tokens}.", "您的请求已到达 {provider}{tokens}。"],
  ["onboarding", "requestWentThrough", "Your request went through{tokens}.", "您的请求已完成{tokens}。"],
  ["onboarding", "requestUsedTokens", " and used {count} tokens", "，并使用了 {count} 个 Token"],
  ["onboarding", "requestForModel", ", for {model},", "，模型为 {model}，"],
  ["onboarding", "timeToAddClientDevice", "Time to add your client device", "添加您的客户端设备"],
  ["onboarding", "agentTestRequestFrom", "Run your agent, or the cURL command from the previous step, on {device}. The request shows up here once NetBird logs it.", "请在{device}上运行您的智能体，或使用上一步中的 cURL 命令。NetBird 记录后，请求会显示在这里。"],
  ["onboarding", "requestForModelParen", "{model} 的请求", "x"],
];

for (const [ns, key, e, z] of NEEDED) {
  const id = `${ns}.${key}`;
  console.log(`${has(id) ? "EXISTS" : "NEED  "} ${id}`);
  if (!has(id)) {
    console.log(`        en: ${JSON.stringify(e)}`);
    console.log(`        zh: ${JSON.stringify(z)}`);
  }
}

// Also check names the sibling may already provide under different ids.
console.log("\n--- sibling keys mentioning request/agent/test ---");
for (const [id, v] of sibling) {
  if (/request|agentTest|passed|tokens/i.test(id)) console.log(`  ${id}  [${v.file}]\n     en=${JSON.stringify(v.en)}\n     zh=${JSON.stringify(v.zh)}`);
}
