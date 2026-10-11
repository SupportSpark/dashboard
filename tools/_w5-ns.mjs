import fs from "fs";
const t = fs.readFileSync("src/i18n/messages/en.ts", "utf8");
const lines = t.split(/\r?\n/);
const re = /^ {2}([A-Za-z0-9_"]+):\s*\{/;
lines.forEach((l, i) => {
  const m = re.exec(l);
  if (m) console.log((i + 1) + ": " + m[1]);
});
