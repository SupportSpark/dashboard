import { readFileSync, writeFileSync } from "node:fs";

/**
 * Normalise parentheses around purely-Latin parenthetical content.
 *
 * Rule applied: if everything between the brackets is Latin, digits or
 * punctuation (no CJK at all), use half-width `()`. If it contains any CJK, keep
 * the full-width `（）`.
 *
 * Why:
 *   - The catalog did both, nearly evenly (44 full-width vs 37 half-width), so
 *     the same UI showed both styles.
 *   - The half-width ones were already the correct ones under this rule
 *     (`HTTP(S)`, `peer(s)`) — Latin content in Latin brackets.
 *   - A full-width bracket pair is ~13px wider than a half-width pair per glyph
 *     slot. Chinese labels are already the longer of the two languages in a box
 *     sized for English, and full-width brackets around `(APT)`, `(SSO)`,
 *     `(Zypper)` pushed several setup labels past the English width.
 *
 * Mixed content keeps full width, because the surrounding text is Chinese
 * (`（SSO、PIN、密码）`, `（IP 地址、域名等）`).
 *
 * Both catalogs are edited so `en` and `zh` stay structurally aligned; the en
 * side has no full-width brackets, so it is a no-op there.
 */
const CJK = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;

const files = ["src/i18n/messages/en.ts", "src/i18n/messages/zh.ts"];
let changedTotal = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  let out = "";
  let i = 0;
  let changed = 0;
  const examples = [];

  while (i < src.length) {
    if (src[i] === "（") {
      // Find the matching full-width close bracket on the same line.
      const close = src.indexOf("）", i);
      const nl = src.indexOf("\n", i);
      if (close !== -1 && (nl === -1 || close < nl)) {
        const inner = src.slice(i + 1, close);
        // Only convert when the content has no CJK whatsoever, and is not
        // already carrying an ICU placeholder that could hold text.
        const hasCjk = CJK.test(inner);
        const hasIcu = /\{[^}]*\}/.test(inner);
        if (!hasCjk && !hasIcu && inner.trim().length > 0) {
          // A full-width bracket already carries its own side bearing, so
          // `Kimi（Moonshot AI）` had visible separation without a space. A
          // half-width bracket does not, so insert one when the preceding
          // character is CJK — otherwise it reads as `Kimi(Moonshot AI)`.
          const prev = out.length > 0 ? out[out.length - 1] : "";
          const needsSpace = CJK.test(prev) && !/\s$/.test(out);
          out += `${needsSpace ? " " : ""}(${inner})`;
          examples.push(`（${inner}） -> ${needsSpace ? " " : ""}(${inner})`);
          changed++;
          i = close + 1;
          continue;
        }
      }
    }
    out += src[i];
    i++;
  }

  if (changed > 0) {
    writeFileSync(file, out);
    changedTotal += changed;
    console.log(`${file}: ${changed} bracket pair(s) normalised`);
    for (const e of examples.slice(0, 8)) console.log(`    ${e}`);
    if (examples.length > 8) console.log(`    ... and ${examples.length - 8} more`);
  } else {
    console.log(`${file}: nothing to change`);
  }
}

console.log(`\n${changedTotal} pair(s) total.`);
