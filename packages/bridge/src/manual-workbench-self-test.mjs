import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { encodePng } from "./png-utils.mjs";

const args = process.argv.slice(2);
const sourcePath = resolve("packages/bridge/src/prepare-manual-annotations.mjs");
const pluginPath = resolve("packages/plugin/code.js");
const pluginUiPath = resolve("packages/plugin/ui.html");
const serverPath = resolve("packages/bridge/src/server.mjs");
let tempRoot = null;

try {
  const htmlPath = await resolveHtmlPath();
  const source = await readFile(sourcePath, "utf8");
  const html = await readFile(htmlPath, "utf8");
  const plugin = await readFile(pluginPath, "utf8");
  const pluginUi = await readFile(pluginUiPath, "utf8");
  const server = await readFile(serverPath, "utf8");

  assertContains(plugin, "CodeUi-to-Figma", "Figma plugin uses project display name");
  assertContains(plugin, "添加 UI 图", "Figma plugin embeds the full annotation UI");
  assertContains(plugin, "data-resize", "Figma plugin exposes internal resize handles");
  assertContains(source, "/api/figma-bridge/annotations/handoff", "source uses handoff endpoint");
  assertContains(html, "/api/figma-bridge/annotations/handoff", "generated HTML uses handoff endpoint");
  assertContains(pluginUi, "/api/figma-bridge/annotations/handoff-from-image", "Figma plugin can create handoff directly from an uploaded image");
  assertContains(pluginUi, "标注工作台", "Figma plugin exposes annotation workbench tab");
  assertContains(pluginUi, "添加 UI 图", "Figma plugin supports adding a UI image");
  assertContains(pluginUi, "添加框选区域", "Figma plugin exposes layer-list add card");
  assertContains(pluginUi, "框选元素引用", "Figma plugin supports nested element reference boxes");
  assertContains(pluginUi, "undoStack", "Figma plugin supports undo history");
  assertContains(pluginUi, "clampPointToBox", "Figma plugin clamps out-of-canvas drags to box edges");
  assertContains(pluginUi, "保存并提交给 Codex", "Figma plugin exposes Codex submit button");
  assertContains(pluginUi, "页面会按 750px 宽度等比记录坐标", "Figma plugin explains 750px normalization");
  assertContains(server, "buildManualScaffold", "Bridge creates section scaffold for direct image handoffs");
  assertContains(server, "sections: scaffold.sections", "Bridge handoff page.json must not start with empty sections");
  assertContains(html, "保存并交给 Codex", "generated HTML exposes Codex handoff button");
  assertContains(html, "备注", "generated HTML exposes instruction/备注 field");
  assertContains(pluginUi, "备注", "Figma plugin exposes required instruction/备注 handling");
  assertContains(html, "建议填写备注", "generated HTML warns when region instructions are missing");
  assertContains(html, "备注过短", "generated HTML warns when complex region instructions are too short");
  assertContains(html, "image2 去背景", "generated HTML explains image2 background-removal policy");
  assertContains(pluginUi, "image2 去背景", "Figma plugin explains image2 background-removal policy");
  assertContains(html, "框选只是给 Codex 模型的识别约束", "generated HTML explains box-as-constraint policy");
  assertNotContains(source, "/api/figma-bridge/annotations/run", "source must not use removed run endpoint");
  assertNotContains(html, "/api/figma-bridge/annotations/run", "generated HTML must not use removed run endpoint");
  assertNotContains(pluginUi, "/api/figma-bridge/annotations/run", "Figma plugin must not use removed run endpoint");
  assertNotContains(pluginUi, "Package 目录", "Figma plugin workbench must not require a package directory");
  assertNotContains(pluginUi, "加载源图", "Figma plugin workbench must not require a load-source button");
  assertNotContains(pluginUi, "适配宽度</button>", "Figma plugin workbench must not expose the old fit-width button");
  assertNotContains(html, "保存并一键开始", "generated HTML must not imply browser-side recognition");
  assertNotContains(html, "正在保存标注、应用识别", "generated HTML must not claim to apply recognition");

  console.log(`PASS manual workbench contract: ${htmlPath}`);
} finally {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function resolveHtmlPath() {
  const providedHtml = getArg("--html");
  if (providedHtml) {
    return resolve(providedHtml);
  }

  tempRoot = await mkdtemp(join(tmpdir(), "codeui-to-figma-workbench-"));
  const packageDir = join(tempRoot, "activity-page");
  await cp(resolve("samples/activity-page"), packageDir, { recursive: true });
  await mkdir(join(packageDir, "source"), { recursive: true });
  await writeFile(join(packageDir, "source", "image2-screen.png"), makeFixturePng(750, 1500));

  const result = spawnSync(process.execPath, [
    sourcePath,
    "--package-dir",
    packageDir,
    "--from-sections",
    "--force"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error([
      "Failed to generate temporary manual annotation workbench.",
      result.stdout,
      result.stderr
    ].filter(Boolean).join("\n"));
  }

  return join(packageDir, "analysis", "manual-annotations.html");
}

function makeFixturePng(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 245;
      data[offset + 1] = Math.floor(120 + (x / width) * 80);
      data[offset + 2] = Math.floor(80 + (y / height) * 100);
      data[offset + 3] = 255;
    }
  }
  return encodePng({ width, height, data });
}

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
