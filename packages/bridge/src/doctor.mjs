import { access, constants } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const checks = [
  ["Project root", root],
  ["package.json", "package.json"],
  ["Figma manifest", "packages/plugin/manifest.json"],
  ["Bridge server", "packages/bridge/src/server.mjs"],
  ["Activity generator", "packages/bridge/src/generate-activity-package.mjs"],
  ["Image parser", "packages/bridge/src/parse-image-package.mjs"],
  ["Codex recognition preparer", "packages/bridge/src/prepare-codex-recognition.mjs"],
  ["Recognition applier", "packages/bridge/src/apply-recognition-to-page.mjs"],
  ["Sample page", "samples/activity-page/page.json"],
  ["Install service script", "scripts/macos/install-bridge-service.command"],
  ["Start bridge script", "scripts/macos/start-bridge.command"]
];

console.log("CodeUi to Figma doctor");
console.log("");
console.log(`Node: ${process.version}`);
console.log(`Project: ${root}`);
console.log("");

let failed = false;

for (const [label, filePath] of checks) {
  const fullPath = resolve(root, filePath);
  try {
    await access(fullPath, constants.R_OK);
    console.log(`OK   ${label}: ${filePath}`);
  } catch {
    failed = true;
    console.log(`FAIL ${label}: ${filePath}`);
  }
}

console.log("");
console.log("Expected Bridge URL: http://localhost:39217");
console.log("Figma manifest to import:");
console.log(`${root}/packages/plugin/manifest.json`);

if (failed) {
  process.exitCode = 1;
}
