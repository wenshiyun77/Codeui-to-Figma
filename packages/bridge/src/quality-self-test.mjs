import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPageReadyForSubmit } from "./page-quality.mjs";

const cases = [
  {
    name: "valid sample package passes",
    path: "samples/activity-page/page.json",
    shouldPass: true
  },
  {
    name: "flat full-canvas image package fails",
    path: "samples/invalid-flat/page.json",
    shouldPass: false,
    messagePattern: /flat full-image import/
  },
  {
    name: "parser-only baseline package fails",
    path: "samples/invalid-baseline/page.json",
    shouldPass: false,
    messagePattern: /unrecognized baseline package/
  }
];

let failures = 0;

for (const testCase of cases) {
  const pagePath = resolve(testCase.path);
  if (testCase.optional && !(await exists(pagePath))) {
    console.log(`SKIP ${testCase.name}`);
    continue;
  }

  try {
    const page = JSON.parse(await readFile(pagePath, "utf8"));
    const report = assertPageReadyForSubmit(page, pagePath);
    if (!testCase.shouldPass) {
      console.error(`FAIL ${testCase.name}: expected failure but passed`);
      failures += 1;
      continue;
    }
    console.log(`PASS ${testCase.name}: ${report.counts.semantic} semantic layer(s)`);
  } catch (error) {
    if (testCase.shouldPass) {
      console.error(`FAIL ${testCase.name}: ${error.message}`);
      failures += 1;
      continue;
    }
    if (testCase.messagePattern && !testCase.messagePattern.test(error.message)) {
      console.error(`FAIL ${testCase.name}: unexpected error "${error.message}"`);
      failures += 1;
      continue;
    }
    console.log(`PASS ${testCase.name}: rejected`);
  }
}

if (failures > 0) {
  process.exit(1);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
