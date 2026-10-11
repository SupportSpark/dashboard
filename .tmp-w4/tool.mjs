// ICU shape tests + catalog lookups in one go.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function load(rel, name) {
  const js = ts.transpileModule(readFileSync(rel, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const out = join(mkdtempSync(join(tmpdir(), "nb-w4-")), name);
  writeFileSync(out, js);
  return import(pathToFileURL(out).href).then((m) => m.default);
}

const [en, zh] = await Promise.all([
  load("src/i18n/messages/en.ts", "en.mjs"),
  load("src/i18n/messages/zh.ts", "zh.mjs"),
]);

if (process.argv[2] === "icu") {
  const { default: IntlMessageFormat } = await import("intl-messageformat");
  const cases = [
    ["brSelfClosing", "Thanks for subscribing <br />to NetBird!"],
    ["brPair", "Thanks for subscribing <br>to NetBird!</br>"],
    ["bPair", "text <b>bold</b> end"],
    ["linkTag", "Find out which <link>Pricing Plan</link> suits you."],
    ["curlyApos", "You\u2019ve hit the limit"],
    ["asciiApos", "NetBird's full set of features"],
    ["twoApostrophes", "Don't exceed the plan's limits"],
    ["boldInModal", "Welcome aboard! <b>for the next two weeks</b>."],
    ["plural", "{count, plural, one {# provider} other {# providers}} connected"],
  ];
  for (const [name, msg] of cases) {
    for (const loc of ["en", "zh"]) {
      const tags = [...msg.matchAll(/<\/?([a-zA-Z][\w-]*)\s*>/g)].map((m) => m[1]);
      const values = { count: 2 };
      for (const tag of tags) values[tag] = (c) => c;
      try {
        new IntlMessageFormat(msg, loc).format(values);
        console.log(`OK   ${name.padEnd(16)} [${loc}] tags=${JSON.stringify(tags)}`);
      } catch (e) {
        console.log(`FAIL ${name.padEnd(16)} [${loc}] ${String(e.message).slice(0, 110)}`);
      }
    }
  }
}

if (process.argv[2] === "look") {
  for (const q of process.argv.slice(3)) {
    const [ns, k] = q.split(".");
    const e = en[ns]?.[k];
    const z = zh[ns]?.[k];
    const kind = typeof e === "string" && typeof z === "string" ? "OK  " : "MISS";
    console.log(`${kind} ${q.padEnd(44)} en=${JSON.stringify(e)} zh=${JSON.stringify(z)}`);
  }
}

if (process.argv[2] === "search") {
  const re = new RegExp(process.argv[3]);
  for (const ns of Object.keys(en)) {
    for (const k of Object.keys(en[ns] ?? {})) {
      const e = en[ns][k];
      if (typeof e === "string" && (re.test(k) || re.test(e))) {
        console.log(`${ns}.${k} = ${JSON.stringify(e)}\n    zh = ${JSON.stringify(zh[ns]?.[k])}`);
      }
    }
  }
}
