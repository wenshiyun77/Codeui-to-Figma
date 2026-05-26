import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPageReadyForSubmit } from "./page-quality.mjs";

const args = process.argv.slice(2);
const pagePath = args[0];

if (!pagePath || pagePath === "--help" || pagePath === "-h") {
  console.log("Usage: node packages/bridge/src/validate-page.mjs <page.json>");
  process.exit(pagePath ? 0 : 1);
}

const pageFile = resolve(pagePath);
const page = JSON.parse(await readFile(pageFile, "utf8"));
const report = assertPageReadyForSubmit(page, pageFile);

console.log(`OK ${pageFile}`);
console.log(JSON.stringify(report.counts, null, 2));
