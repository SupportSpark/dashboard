import fs from "node:fs";

const FRAG = "i18n-fragments/agent-network-control-center.json";
const raw = fs.readFileSync(FRAG, "utf8");
const d = JSON.parse(raw);

// 1) Same English twice within one namespace -> one CJK value would silently
//    shadow the other.
const dupValue = [];
for (const [ns, ks] of Object.entries(d)) {
  const seen = new Map();
  for (const [k, v] of Object.entries(ks)) {
    if (seen.has(v.en)) dupValue.push(`${ns}: ${JSON.stringify(v.en)} -> ${seen.get(v.en)} & ${k}`);
    seen.set(v.en, k);
  }
}

// 2) The same key name twice -> JSON.parse keeps only the last.
const dupKey = [];
for (const ns of Object.keys(d)) {
  const marker = `"${ns}": {`;
  const start = raw.indexOf(marker);
  if (start === -1) continue;
  // Slice to the end of this namespace block by brace depth.
  let i = start + marker.length - 1;
  let depth = 0;
  for (; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = raw.slice(start + marker.length, i);
  const names = [...body.matchAll(/"([A-Za-z0-9_]+)"\s*:\s*\{/g)].map((m) => m[1]);
  const counts = {};
  for (const n of names) counts[n] = (counts[n] ?? 0) + 1;
  for (const [n, c] of Object.entries(counts)) if (c > 1) dupKey.push(`${ns}.${n} x${c}`);
}

console.log(`namespaces: ${Object.keys(d).join(", ")}`);
for (const [ns, ks] of Object.entries(d)) console.log(`  ${ns}: ${Object.keys(ks).length} keys`);
console.log(`\nduplicate en value within a namespace: ${dupValue.length}`);
dupValue.forEach((x) => console.log("   " + x));
console.log(`duplicate key name (shadowed): ${dupKey.length}`);
dupKey.forEach((x) => console.log("   " + x));

// 3) Language rules: CJK punctuation only, no half-width , or . inside Chinese.
const badPunct = [];
const identical = [];
for (const [ns, ks] of Object.entries(d)) {
  for (const [k, v] of Object.entries(ks)) {
    if (/[\u4e00-\u9fff]/.test(v.zh)) {
      // A half-width comma/period directly between CJK characters. The `...`
      // ellipsis is required by the glossary, so mask it first.
      const masked = v.zh.replace(/\.\.\./g, "\u2026\u2026\u2026");
      if (/[\u4e00-\u9fff][,.]/u.test(masked)) badPunct.push(`${ns}.${k}: ${v.zh}`);
      if (v.zh.includes("\u2026\u2026")) badPunct.push(`${ns}.${k}: …… (use ...)`);
    }
    if (v.en === v.zh && /\s/.test(v.en) && v.en.split(/\s+/).length > 2) identical.push(`${ns}.${k}: ${v.en}`);
  }
}
console.log(`\nhalf-width punctuation inside Chinese: ${badPunct.length}`);
badPunct.forEach((x) => console.log("   " + x));
console.log(`zh identical to en for multi-word prose: ${identical.length}`);
identical.forEach((x) => console.log("   " + x));

// 4) Placeholder parity.
const ph = [];
for (const [ns, ks] of Object.entries(d)) {
  for (const [k, v] of Object.entries(ks)) {
    const a = [...v.en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const b = [...v.zh.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    if (a !== b) ph.push(`${ns}.${k}: en{${a}} zh{${b}}`);
  }
}
console.log(`\nplaceholder mismatches: ${ph.length}`);
ph.forEach((x) => console.log("   " + x));
