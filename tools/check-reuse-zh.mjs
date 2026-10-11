import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function load(rel) {
  const js = ts.transpileModule(fs.readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const p = path.join(os.tmpdir(), `${path.basename(rel).replace(/\.ts$/, "")}-${Date.now()}.mjs`);
  fs.writeFileSync(p, js);
  return (await import(`file:///${p.replace(/\\/g, "/")}`)).default;
}

const en = await load("src/i18n/messages/en.ts");
const zh = await load("src/i18n/messages/zh.ts");

const want = [
  "networks.remove", "networks.renameNetwork", "networks.peer",
  "networks.resourceTab", "settings.networksTab", "settings.agentNetwork",
  "settings.hours", "settings.days", "invoices.date", "users.group",
  "peers.server", "peers.users", "groups.create", "groups.rename",
  "untranslated.rename_group_8", "untranslated.json_162",
  "common.cancel", "common.delete", "common.save", "common.edit",
  "common.name", "common.enabled", "common.groups", "common.resources",
  "common.peers", "common.policies", "common.add", "common.close",
  "navigation.networks",
];

const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);

for (const k of want) {
  const e = get(en, k);
  const z = get(zh, k);
  console.log(`${k.padEnd(32)} en=${JSON.stringify(e)}  zh=${JSON.stringify(z)}`);
}
