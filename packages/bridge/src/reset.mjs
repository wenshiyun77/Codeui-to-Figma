import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const bridgeUrl = getArg("--bridge-url") || "http://localhost:39217";
const dataDir = resolve(process.env.BRIDGE_DATA_DIR || resolve(process.cwd(), "var/bridge"));
const jobsFile = resolve(dataDir, "jobs.json");

try {
  const response = await fetch(`${bridgeUrl}/api/figma-bridge/jobs/reset`, {
    method: "POST"
  });
  if (response.ok) {
    const result = await response.json();
    console.log(`Reset running Bridge queue: removed ${result.removed || 0} job(s)`);
    process.exit(0);
  }
  console.log(`Running Bridge reset returned HTTP ${response.status}; falling back to file reset.`);
} catch {
  // Bridge may not be running; remove the persisted file below.
}

await rm(jobsFile, { force: true });
console.log(`Removed ${jobsFile}`);

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
