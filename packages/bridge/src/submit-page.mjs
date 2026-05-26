import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertPageReadyForSubmit } from "./page-quality.mjs";

const args = process.argv.slice(2);
const pagePath = args[0];

if (!pagePath || pagePath === "--help" || pagePath === "-h") {
  printUsage();
  process.exit(pagePath ? 0 : 1);
}

const bridgeUrl = getArg("--bridge-url") || "http://localhost:39217";
const shouldWait = args.includes("--wait");
const pageFile = resolve(pagePath);
const assetsRoot = resolve(getArg("--assets-root") || dirname(pageFile));
const page = JSON.parse(await readFile(pageFile, "utf8"));

assertPageReadyForSubmit(page, pageFile);

const createResponse = await fetch(`${bridgeUrl}/api/figma-bridge/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "figma.activityPage.import",
    source: "submit-page",
    assetsRoot,
    payload: {
      page
    }
  })
});

if (!createResponse.ok) {
  const text = await createResponse.text();
  throw new Error(`Failed to submit job: ${createResponse.status} ${text}`);
}

const created = await createResponse.json();
console.log(`Submitted ${created.job.id}`);
console.log(`Status: ${created.job.status}`);

if (shouldWait) {
  await waitForJob(created.job.id);
}

async function waitForJob(jobId) {
  const started = Date.now();
  const timeoutMs = 5 * 60 * 1000;

  while (Date.now() - started < timeoutMs) {
    await sleep(1200);
    const response = await fetch(`${bridgeUrl}/api/figma-bridge/jobs/${jobId}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to read job: ${response.status} ${text}`);
    }
    const data = await response.json();
    const status = data.job.status;
    process.stdout.write(`\rStatus: ${status.padEnd(12)}`);
    if (status === "completed" || status === "failed") {
      process.stdout.write("\n");
      console.log(JSON.stringify(data.job, null, 2));
      return;
    }
  }

  throw new Error(`Timed out waiting for ${jobId}`);
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function printUsage() {
  console.log("Usage: node packages/bridge/src/submit-page.mjs <page.json> [--bridge-url http://localhost:39217] [--assets-root dir] [--wait]");
}
