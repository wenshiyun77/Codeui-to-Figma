import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const htmlPath = resolve(getArg("--html") || "var/generated/iphone-17-figma-import/analysis/manual-annotations.html");
const sourcePath = resolve("packages/bridge/src/prepare-manual-annotations.mjs");
const pluginPath = resolve("packages/plugin/code.js");

const source = await readFile(sourcePath, "utf8");
const html = await readFile(htmlPath, "utf8");
const plugin = await readFile(pluginPath, "utf8");

assertContains(source, "/api/figma-bridge/annotations/handoff", "source uses handoff endpoint");
assertContains(html, "/api/figma-bridge/annotations/handoff", "generated HTML uses handoff endpoint");
assertContains(plugin, "/api/figma-bridge/annotations/handoff", "Figma plugin workbench uses handoff endpoint");
assertContains(plugin, "/api/figma-bridge/annotations/workbench", "Figma plugin can load annotation workbench data");
assertContains(plugin, "标注工作台", "Figma plugin exposes annotation workbench tab");
assertContains(plugin, "保存并交给 Codex", "Figma plugin exposes Codex handoff button");
assertContains(html, "保存并交给 Codex", "generated HTML exposes Codex handoff button");
assertContains(html, "备注", "generated HTML exposes instruction/备注 field");
assertContains(plugin, "备注必须", "Figma plugin explains required instruction/备注 handling");
assertContains(html, "建议填写备注", "generated HTML warns when region instructions are missing");
assertContains(html, "备注过短", "generated HTML warns when complex region instructions are too short");
assertContains(html, "image2 去背景", "generated HTML explains image2 background-removal policy");
assertContains(plugin, "image2 去背景", "Figma plugin explains image2 background-removal policy");
assertContains(html, "框选只是给 Codex 模型的识别约束", "generated HTML explains box-as-constraint policy");
assertNotContains(source, "/api/figma-bridge/annotations/run", "source must not use removed run endpoint");
assertNotContains(html, "/api/figma-bridge/annotations/run", "generated HTML must not use removed run endpoint");
assertNotContains(plugin, "/api/figma-bridge/annotations/run", "Figma plugin must not use removed run endpoint");
assertNotContains(html, "保存并一键开始", "generated HTML must not imply browser-side recognition");
assertNotContains(html, "正在保存标注、应用识别", "generated HTML must not claim to apply recognition");

console.log(`PASS manual workbench contract: ${htmlPath}`);

function assertContains(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing "${needle}"`);
  }
}

function assertNotContains(text, needle, label) {
  if (text.includes(needle)) {
    throw new Error(`${label}: found forbidden "${needle}"`);
  }
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
