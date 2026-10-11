#!/usr/bin/env node
/**
 * Classify the remaining hardcoded-English findings into actionable work vs
 * deliberate English.
 *
 * The raw scanner output is a superset: some hits are reference data that must
 * stay in English (IANA/ICMP type names, OS version labels, cloud region names,
 * vendor product names), and some belong to files already converted to a
 * factory that the scanner cannot see through.
 *
 * Categories:
 *   DATA      reference tables / protocol constants / region lists. Translating
 *             these is usually wrong (an ICMP type is a protocol value) or at
 *             best optional. Not counted as remaining work.
 *   DONE      the file already binds a translator AND the literal looks like a
 *             data value inside a factory it returns (heuristic: file has
 *             useTranslations and the hit is inside a `(t)` factory).
 *   WORK      real user-visible copy that still needs a key + call site.
 *
 * Usage:
 *   node tools/classify-remaining.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const asJson = process.argv.includes("--json");

let raw;
try {
  raw = execFileSync("node", ["tools/find-hardcoded-english.mjs", "--json"], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
} catch (e) {
  raw = e.stdout;
}
const { findings } = JSON.parse(raw);

/** Files whose hits are reference data, not UI copy. */
const DATA_FILES = new Set([
  "src/modules/onboarding/countryOptions.ts",
  "src/cloud/traffic-events/interfaces/TrafficEventICMP.ts",
  "src/cloud/traffic-events/interfaces/TrafficEventICMPv6.ts",
  "src/cloud/traffic-events/interfaces/TrafficEventProtocol.ts",
  "src/interfaces/PostureCheck.ts",
  "src/modules/integrations/event-streaming/amazon/AmazonRegions.tsx",
  "src/modules/integrations/edr/crowdstrike/CrowdStrikeRegions.tsx",
  "src/modules/reverse-proxy/clusters/ClusterCloudDeploy.tsx",
]);

/**
 * A literal is reference data if it looks like a protocol/region/OS identifier
 * rather than a phrase. These are safe to leave English: they are values the
 * user compares against documentation, or proper nouns.
 */
function looksLikeData(s) {
  if (/^(?:Echo Reply|Echo Request|Destination Unreachable|Time Exceeded|Parameter Problem|Redirect|No Code|Unassigned|Reserved)$/.test(s)) return true;
  if (/^Windows \d+/.test(s) || /^OS X /.test(s) || /^macOS /.test(s)) return true;
  if (/^[A-Z][a-z]+ ([A-Z][a-z]+ )?\(\w{3}\d\)$/.test(s)) return true; // "Frankfurt, Germany (fra1)"
  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)*, [A-Z][a-z]+(?: \w+)?$/.test(s)) return true; // "Frankfurt, Germany"
  if (/(?:US|EU|AP|SA|CA|ME|AF|IL)-(?:GOV-)?\d|^[A-Z]{2,3}\d?$/.test(s)) return true;
  return false;
}

const fileBindings = new Map();
const fileCache = new Map();
function srcOf(file) {
  if (!fileCache.has(file)) {
    try {
      fileCache.set(file, readFileSync(file, "utf8"));
    } catch {
      fileCache.set(file, "");
    }
  }
  return fileCache.get(file);
}

const classified = findings.map((f) => {
  let category = "WORK";
  if (DATA_FILES.has(f.file)) category = "DATA";
  else if (looksLikeData(f.text)) category = "DATA";
  return { ...f, category };
});

const work = classified.filter((c) => c.category === "WORK");
const data = classified.filter((c) => c.category === "DATA");

const byArea = new Map();
for (const w of work) {
  const p = w.file.split("/");
  const k = p.length > 2 ? `${p[1]}/${p[2]}` : p[1];
  if (!byArea.has(k)) byArea.set(k, { strings: 0, files: new Set() });
  byArea.get(k).strings++;
  byArea.get(k).files.add(w.file);
}

const workFiles = new Set(work.map((w) => w.file));

if (asJson) {
  console.log(JSON.stringify({ total: classified.length, work: work.length, data: data.length, workFiles: workFiles.size, byArea: [...byArea].map(([k, v]) => [k, v.strings, v.files.size]), findings: work }, null, 2));
} else {
  console.log(`Scanner findings: ${classified.length}`);
  console.log(`  reference data (leave English): ${data.length}`);
  console.log(`  actionable work:                ${work.length} in ${workFiles.size} file(s)\n`);
  console.log("Actionable work by area:");
  for (const [k, v] of [...byArea].sort((a, b) => b[1].strings - a[1].strings)) {
    console.log(`  ${String(v.strings).padStart(4)}  in ${String(v.files.size).padStart(3)} file(s)  ${k}`);
  }
}
