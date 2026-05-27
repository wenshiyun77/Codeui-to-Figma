import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const packageDir = resolve(getArg("--package-dir") || getPositionalArg() || ".");
const bridgeUrl = (getArg("--bridge-url") || "http://localhost:39217").replace(/\/+$/, "");
const pagePath = resolve(packageDir, "page.json");
const analysisDir = resolve(packageDir, "analysis");
const recognitionPath = resolve(analysisDir, "recognition.json");
const tasksPath = resolve(analysisDir, "remove-background-tasks.json");
const statusPath = resolve(analysisDir, "handoff-status.json");
const shouldApply = !args.includes("--skip-apply");
const shouldSubmit = !args.includes("--no-submit");
const shouldWait = args.includes("--wait");
const shouldNotifyFigma = !args.includes("--no-notify-figma");
const commandsRun = [];

await mkdir(analysisDir, { recursive: true });

const status = {
  type: "codeui-to-figma.handoff-status",
  status: "running",
  packageDir,
  pagePath,
  statusPath,
  bridgeUrl,
  pendingCount: 0,
  pendingImage2Tasks: [],
  image2CutoutDir: null,
  image2TasksMarkdown: null,
  submittedJobId: null,
  message: "正在继续处理 Codex handoff。",
  commandsRun,
  updatedAt: new Date().toISOString()
};

try {
  await writeStatus({ status: "running" });

  if (shouldApply) {
    if (await fileExists(recognitionPath)) {
      runNodeScript("apply recognition", "apply-recognition-to-page.mjs", [
        "--package-dir",
        packageDir
      ]);
      await writeStatus({ status: "recognition_applied" });
    } else {
      await writeStatus({
        status: "waiting_for_recognition",
        message: `缺少 ${recognitionPath}，Codex 需要先写入识别结果。`
      });
      console.log(status.message);
      process.exit(0);
    }
  }

  const page = await readJson(pagePath);
  const recognition = await readOptionalJson(recognitionPath, {});
  const tasks = await readOptionalJson(tasksPath, { tasks: [] });
  const pending = await findPendingImage2Assets({ packageDir, page, recognition, tasks });

  if (pending.count > 0) {
    let cutoutInfo = null;
    if (Array.isArray(tasks.tasks) && tasks.tasks.length > 0) {
      runNodeScript("prepare image2 cutouts", "prepare-image2-cutouts.mjs", [
        "--package-dir",
        packageDir
      ]);
      cutoutInfo = {
        image2CutoutDir: resolve(packageDir, "analysis/image2-cutouts"),
        image2TasksMarkdown: resolve(packageDir, "analysis/image2-cutouts/tasks.md")
      };
    }

    await writeStatus({
      status: "waiting_for_image2_cutouts",
      pendingCount: pending.count,
      pendingImage2Tasks: pending.items,
      ...cutoutInfo,
      message: `等待 image2 透明素材：还有 ${pending.count} 个前景/艺术字资产需要用 image2 去背景后放回目标路径。`
    });

    console.log(status.message);
    if (status.image2TasksMarkdown) {
      console.log(`Image2 tasks: ${status.image2TasksMarkdown}`);
    }
    await notifyFigmaIfPossible(status);
    process.exit(0);
  }

  runNodeScript("validate page", "validate-page.mjs", [pagePath]);
  await writeStatus({
    status: shouldSubmit ? "validated" : "ready_to_submit",
    message: shouldSubmit ? "页面已通过校验，准备提交到 Figma Bridge。" : "页面已通过校验，可以提交到 Figma Bridge。"
  });

  if (!shouldSubmit) {
    console.log(status.message);
    await notifyFigmaIfPossible(status);
    process.exit(0);
  }

  const submitArgs = [
    pagePath,
    "--bridge-url",
    bridgeUrl,
    "--assets-root",
    packageDir
  ];
  if (shouldWait) {
    submitArgs.push("--wait");
  }
  const submitOutput = runNodeScript("submit to bridge", "submit-page.mjs", submitArgs);
  const submittedJobId = parseSubmittedJobId(submitOutput.stdout);
  await writeStatus({
    status: "submitted_to_figma_bridge",
    submittedJobId,
    message: submittedJobId
      ? `已提交到 Figma Bridge：${submittedJobId}。`
      : "已提交到 Figma Bridge。"
  });
  console.log(status.message);
} catch (error) {
  await writeStatus({
    status: "failed",
    message: error && error.message ? error.message : String(error)
  });
  console.error(status.message);
  process.exit(1);
}

async function findPendingImage2Assets({ packageDir: root, page, recognition, tasks }) {
  const result = [];
  const taskList = Array.isArray(tasks.tasks) ? tasks.tasks : [];
  for (const task of taskList) {
    if (!task || !task.targetAsset) {
      continue;
    }
    const target = resolve(root, task.targetAsset);
    if (!(await fileExists(target))) {
      result.push({
        id: task.id || null,
        label: task.label || task.id || task.targetAsset,
        type: task.type || "foregroundImage",
        targetAsset: task.targetAsset,
        bbox: task.bbox || null,
        reason: "missing image2 target asset"
      });
    }
  }

  const textCandidates = Array.isArray(recognition.textCandidates) ? recognition.textCandidates : [];
  for (const text of textCandidates) {
    if (!text || text.nodeType !== "textImage" || !text.asset) {
      continue;
    }
    const target = resolve(root, text.asset);
    if (!(await fileExists(target))) {
      result.push({
        id: text.id || null,
        label: text.label || text.id || text.asset,
        type: "textImage",
        targetAsset: text.asset,
        bbox: text.bbox || null,
        reason: "missing image2 text image asset"
      });
    }
  }

  const applied = page && page.metadata && page.metadata.recognitionApplied
    ? page.metadata.recognitionApplied.applied || {}
    : {};
  const appliedPending = numberOr(applied.pendingTextImages, 0) + numberOr(applied.pendingForegroundTasks, 0);
  const count = Math.max(result.length, appliedPending);

  return {
    count,
    items: result
  };
}

function runNodeScript(label, scriptName, scriptArgs) {
  const scriptPath = resolve(scriptDir, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  const record = {
    label,
    script: scriptPath,
    args: scriptArgs,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
  commandsRun.push(record);

  if (record.stdout) {
    process.stdout.write(record.stdout);
  }
  if (record.stderr) {
    process.stderr.write(record.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return record;
}

async function notifyFigmaIfPossible(publicStatus) {
  if (!shouldNotifyFigma) {
    return;
  }
  try {
    const payload = {
      status: publicStatus.status,
      message: publicStatus.message,
      packageDir: publicStatus.packageDir,
      pagePath: publicStatus.pagePath,
      statusPath: publicStatus.statusPath,
      pendingCount: publicStatus.pendingCount,
      pendingImage2Tasks: publicStatus.pendingImage2Tasks,
      image2TasksMarkdown: publicStatus.image2TasksMarkdown,
      submittedJobId: publicStatus.submittedJobId
    };
    const response = await fetch(`${bridgeUrl}/api/figma-bridge/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "codeui.handoff.status",
        source: "continue-handoff",
        assetsRoot: packageDir,
        payload
      })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} ${text}`);
    }
    const created = await response.json();
    console.log(`Queued Figma status job ${created.job.id}`);
  } catch (error) {
    console.warn(`Could not notify Figma plugin: ${error && error.message ? error.message : String(error)}`);
  }
}

async function writeStatus(patch) {
  Object.assign(status, patch, { updatedAt: new Date().toISOString() });
  await writeFile(statusPath, JSON.stringify(status, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path, fallback) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseSubmittedJobId(stdout) {
  const match = String(stdout || "").match(/Submitted\s+(\S+)/);
  return match ? match[1] : null;
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function getPositionalArg() {
  const optionsWithValues = new Set(["--package-dir", "--bridge-url"]);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      if (optionsWithValues.has(value)) {
        index += 1;
      }
      continue;
    }
    return value;
  }
  return null;
}

function printUsage() {
  console.log([
    "Usage: node packages/bridge/src/continue-handoff.mjs --package-dir <package-dir> [options]",
    "",
    "Options:",
    "  --bridge-url <url>       Bridge URL. Default: http://localhost:39217",
    "  --wait                   Wait for the Figma import job after submit.",
    "  --no-submit              Apply and validate only.",
    "  --skip-apply             Do not rerun apply:recognition.",
    "  --no-notify-figma        Do not queue a Figma status notification job."
  ].join("\n"));
}
