import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";

const PORT = Number.parseInt(process.env.BRIDGE_PORT || "39217", 10);
const HOST = process.env.BRIDGE_HOST || "localhost";
const ROOT_DIR = resolve(process.cwd());
const DATA_DIR = resolve(process.env.BRIDGE_DATA_DIR || resolve(ROOT_DIR, "var/bridge"));
const JOBS_FILE = resolve(DATA_DIR, "jobs.json");
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const ALLOWED_ASSET_ROOTS = [ROOT_DIR, resolve("/private/tmp"), resolve("/tmp")];

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

let state = {
  jobs: []
};

await loadState();

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", getRequestOrigin(req));

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "codeui-to-figma",
        queued: countJobs("queued"),
        inProgress: countJobs("in_progress")
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma-bridge/jobs") {
      sendJson(res, 200, {
        jobs: state.jobs.map((job) => publicJobSummary(job))
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma-bridge/annotations/workbench") {
      const result = await readAnnotationWorkbench(req, url);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma-bridge/packages/asset") {
      await servePackageAsset(res, url);
      return;
    }

    if ((req.method === "POST" || req.method === "DELETE") && url.pathname === "/api/figma-bridge/jobs/reset") {
      const count = state.jobs.length;
      state.jobs = [];
      await saveState();
      sendJson(res, 200, { ok: true, removed: count });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/figma-bridge/annotations/save") {
      const body = await readJsonBody(req);
      const saved = await saveManualAnnotations(body);
      sendJson(res, 200, saved);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/figma-bridge/annotations/handoff") {
      const body = await readJsonBody(req);
      const result = await createCodexHandoff(body);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/figma-bridge/jobs") {
      const body = await readJsonBody(req);
      const created = await createJob(body);
      sendJson(res, 201, { job: publicJobSummary(created) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma-bridge/jobs/next") {
      const clientId = url.searchParams.get("clientId") || "figma-plugin";
      const job = await claimNextJob(clientId);
      sendJson(res, 200, {
        job: job ? publicJobForExecutor(req, job) : null
      });
      return;
    }

    const assetMatch = url.pathname.match(/^\/api\/figma-bridge\/jobs\/([^/]+)\/assets\/(.+)$/);
    if (req.method === "GET" && assetMatch) {
      await serveJobAsset(res, assetMatch[1], assetMatch[2]);
      return;
    }

    const resultMatch = url.pathname.match(/^\/api\/figma-bridge\/jobs\/([^/]+)\/result$/);
    if (req.method === "POST" && resultMatch) {
      const body = await readJsonBody(req);
      const updated = await completeJob(resultMatch[1], body);
      sendJson(res, 200, { job: publicJobSummary(updated) });
      return;
    }

    const jobMatch = url.pathname.match(/^\/api\/figma-bridge\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = findJob(jobMatch[1]);
      if (!job) {
        sendJson(res, 404, { error: "Job not found" });
        return;
      }
      sendJson(res, 200, { job: publicJobSummary(job) });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, {
      error: error.message || "Internal server error"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CodeUi-to-Figma Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Workspace root: ${ROOT_DIR}`);
});

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(JOBS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.jobs)) {
      state = parsed;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function saveState() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(JOBS_FILE, JSON.stringify(state, null, 2));
}

async function createJob(body) {
  if (!body || typeof body !== "object") {
    throw badRequest("Expected a JSON object body");
  }

  const payload = body.payload || (body.page ? { page: body.page } : null);
  if (!payload || typeof payload !== "object") {
    throw badRequest("Expected payload or page in request body");
  }

  const assetsRoot = body.assetsRoot ? resolve(String(body.assetsRoot)) : null;
  if (assetsRoot) {
    assertAllowedAssetRoot(assetsRoot);
    await access(assetsRoot);
  }

  const now = new Date().toISOString();
  const job = {
    id: body.id || `job_${randomUUID()}`,
    type: body.type || "figma.activityPage.import",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    source: body.source || "local",
    attempts: 0,
    assetsRoot,
    payload,
    result: null,
    error: null,
    logs: []
  };

  state.jobs.push(job);
  await saveState();
  return job;
}

async function saveManualAnnotations(body) {
  const packageDir = resolvePackageDir(body && body.packageDir);
  const annotations = body && body.annotations;
  if (!annotations || typeof annotations !== "object") {
    throw badRequest("Expected annotations object");
  }
  if (!Array.isArray(annotations.regions)) {
    throw badRequest("annotations.regions must be an array");
  }

  const analysisDir = resolve(packageDir, "analysis");
  const annotationsPath = resolve(analysisDir, "manual-annotations.json");
  await mkdir(analysisDir, { recursive: true });
  await writeFile(annotationsPath, JSON.stringify(annotations, null, 2));

  return {
    ok: true,
    packageDir,
    annotationsPath,
    regionCount: annotations.regions.length
  };
}

async function readAnnotationWorkbench(req, url) {
  const packageDir = resolvePackageDir(url.searchParams.get("packageDir"));
  const pagePath = resolve(packageDir, "page.json");
  const page = JSON.parse(await readFile(pagePath, "utf8"));
  const sourceImage = page.canvas && page.canvas.sourceImage;
  if (!sourceImage) {
    throw badRequest("page.json has no canvas.sourceImage");
  }

  const sourceImagePath = resolve(packageDir, sourceImage);
  assertInsidePackage(packageDir, sourceImagePath);
  await access(sourceImagePath);

  const analysisDir = resolve(packageDir, "analysis");
  const annotationsPath = resolve(analysisDir, "manual-annotations.json");
  const annotations = await readOptionalJson(annotationsPath, buildEmptyAnnotations(page, sourceImage));
  const sourceImageUrl = `${getRequestOrigin(req)}/api/figma-bridge/packages/asset?packageDir=${encodeURIComponent(packageDir)}&path=${encodeURIComponent(sourceImage)}`;

  return {
    ok: true,
    packageDir,
    pagePath,
    annotationsPath,
    sourceImagePath,
    sourceImageUrl,
    canvas: annotations.canvas || page.canvas || null,
    annotations
  };
}

function resolvePackageDir(value) {
  if (!value) {
    throw badRequest("Missing packageDir");
  }
  const packageDir = resolve(String(value));
  if (!isInside(ROOT_DIR, packageDir) && packageDir !== ROOT_DIR) {
    throw Object.assign(new Error("packageDir must be inside the bridge workspace"), { statusCode: 403 });
  }
  return packageDir;
}

function buildEmptyAnnotations(page, sourceImage) {
  const canvas = page.canvas || {};
  return {
    version: "manual-annotations.v0.1",
    sourceImage,
    canvas: {
      width: Number(canvas.width || 0),
      height: Number(canvas.height || 0)
    },
    regions: []
  };
}

async function createCodexHandoff(body) {
  const saved = await saveManualAnnotations(body);
  const pagePath = resolve(saved.packageDir, "page.json");
  const page = JSON.parse(await readFile(pagePath, "utf8"));
  const analysisDir = resolve(saved.packageDir, "analysis");
  const recognitionPath = resolve(analysisDir, "recognition.json");
  const tasksPath = resolve(analysisDir, "remove-background-tasks.json");
  const handoffPath = resolve(analysisDir, "codex-handoff.json");
  const handoffMarkdownPath = resolve(analysisDir, "codex-handoff.md");
  const handoff = {
    type: "codeui-to-figma.manual-annotations-ready",
    createdAt: new Date().toISOString(),
    packageDir: saved.packageDir,
    pagePath,
    sourceImage: page.canvas && page.canvas.sourceImage ? resolve(saved.packageDir, page.canvas.sourceImage) : null,
    annotationsPath: saved.annotationsPath,
    recognitionPath,
    removeBackgroundTasksPath: tasksPath,
    prompt: page.metadata && page.metadata.prompt ? page.metadata.prompt : "",
    nextAction: "Codex must read source image plus every manual-annotations.json region, including the full instruction/备注 text, then update recognition.json and remove-background-tasks.json. Do not call OpenAI API from scripts. Do not let the workbench perform semantic recognition.",
    transparentCutoutPolicy: "All artText and foreground transparent PNG assets must be produced by image2 background removal. Local code may crop rectangular backgrounds only; it must not fake transparent cutouts with canvas, thresholding, masks, OpenCV, or Pillow.",
    afterCodexRecognition: [
      `npm run apply:recognition -- --package-dir "${saved.packageDir}"`,
      `npm run validate:page -- "${pagePath}"`,
      `node packages/bridge/src/submit-page.mjs "${pagePath}"`
    ],
    regionCount: saved.regionCount
  };
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2));
  await writeFile(handoffMarkdownPath, buildHandoffMarkdown(handoff));
  return {
    ok: true,
    ...saved,
    handoffPath,
    handoffMarkdownPath,
    nextAction: "回到 Codex 对话输入：继续识别这个标注 handoff。Codex 会读取 handoff 并执行元素分离和识别。"
  };
}

function buildHandoffMarkdown(handoff) {
  return [
    "# Codex 标注交接",
    "",
    "人工标注已经保存。下一步必须由 Codex 会话读取标注并执行元素分离和识别，不要在 Bridge 或网页里伪装模型识别。",
    "框选区域只是识别约束，不是最终切图规则。每个区域的备注/指引必须完整阅读，备注可能明确说明区域内多层级元素如何拆分、哪些元素保留为背景、哪些元素转成文字/形状/透明素材。艺术字和前景透明 PNG 必须由 image2 去背景生成；本地代码只允许裁普通矩形背景和装配 page.json。",
    "",
    `Package: ${handoff.packageDir}`,
    `Source image: ${handoff.sourceImage}`,
    `Annotations: ${handoff.annotationsPath}`,
    `Recognition output: ${handoff.recognitionPath}`,
    `Image2 tasks output: ${handoff.removeBackgroundTasksPath}`,
    `User prompt: ${handoff.prompt || "未提供"}`,
    "",
    "## Codex 下一步",
    "",
    "1. 读取 source image 和 manual-annotations.json，逐条完整阅读每个 region 的 instruction/备注。",
    "2. 按人工框选约束和备注里的多层级拆分要求补全 recognition.json。",
    "3. 如有 artText/foreground，写入 remove-background-tasks.json，并等待 image2 去背景素材；不要用本地抠图代替。",
    "4. 运行 apply:recognition 和 validate:page。",
    "5. 校验通过后提交到 Figma Bridge。",
    "",
    "## 后续命令",
    "",
    "```bash",
    ...handoff.afterCodexRecognition,
    "```",
    ""
  ].join("\n");
}

async function claimNextJob(clientId) {
  const job = state.jobs.find((candidate) => candidate.status === "queued");
  if (!job) {
    return null;
  }

  const now = new Date().toISOString();
  job.status = "in_progress";
  job.updatedAt = now;
  job.claimedAt = now;
  job.claimedBy = clientId;
  job.attempts += 1;
  await saveState();
  return job;
}

async function completeJob(jobId, body) {
  const job = findJob(jobId);
  if (!job) {
    throw notFound("Job not found");
  }

  const status = body.status === "failed" ? "failed" : "completed";
  job.status = status;
  job.updatedAt = new Date().toISOString();
  job.result = body.result || null;
  job.error = body.error || null;
  job.logs = Array.isArray(body.logs) ? body.logs : job.logs;
  await saveState();
  return job;
}

async function serveJobAsset(res, jobId, encodedAssetPath) {
  const job = findJob(jobId);
  if (!job) {
    sendJson(res, 404, { error: "Job not found" });
    return;
  }
  if (!job.assetsRoot) {
    sendJson(res, 404, { error: "Job has no assetsRoot" });
    return;
  }

  const assetPath = decodeURIComponent(encodedAssetPath);
  const fullPath = resolve(job.assetsRoot, assetPath);
  if (!isInside(job.assetsRoot, fullPath)) {
    sendJson(res, 403, { error: "Asset path escapes assetsRoot" });
    return;
  }

  const assetStat = await stat(fullPath);
  if (!assetStat.isFile()) {
    sendJson(res, 404, { error: "Asset is not a file" });
    return;
  }

  const contentType = MIME_TYPES[extname(fullPath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": assetStat.size,
    "Cache-Control": "no-store"
  });
  createReadStream(fullPath).pipe(res);
}

async function servePackageAsset(res, url) {
  const packageDir = resolvePackageDir(url.searchParams.get("packageDir"));
  const assetPath = url.searchParams.get("path");
  if (!assetPath) {
    sendJson(res, 400, { error: "Missing path" });
    return;
  }
  const fullPath = resolve(packageDir, String(assetPath));
  assertInsidePackage(packageDir, fullPath);

  const assetStat = await stat(fullPath);
  if (!assetStat.isFile()) {
    sendJson(res, 404, { error: "Asset is not a file" });
    return;
  }

  const contentType = MIME_TYPES[extname(fullPath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": assetStat.size,
    "Cache-Control": "no-store"
  });
  createReadStream(fullPath).pipe(res);
}

function publicJobForExecutor(req, job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    attempts: job.attempts,
    assetsBaseUrl: `${getRequestOrigin(req)}/api/figma-bridge/jobs/${job.id}/assets/`,
    payload: job.payload
  };
}

function publicJobSummary(job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    source: job.source,
    attempts: job.attempts,
    claimedBy: job.claimedBy || null,
    claimedAt: job.claimedAt || null,
    hasAssetsRoot: Boolean(job.assetsRoot),
    result: job.result,
    error: job.error,
    logs: job.logs
  };
}

function findJob(jobId) {
  return state.jobs.find((job) => job.id === jobId);
}

function countJobs(status) {
  return state.jobs.filter((job) => job.status === status).length;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Request body is not valid JSON");
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body, null, 2));
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getRequestOrigin(req) {
  const host = req.headers.host || `${HOST}:${PORT}`;
  return `http://${host}`;
}

function assertAllowedAssetRoot(assetRoot) {
  if (!ALLOWED_ASSET_ROOTS.some((root) => isInside(root, assetRoot) || root === assetRoot)) {
    throw Object.assign(
      new Error(`assetsRoot must be inside one of: ${ALLOWED_ASSET_ROOTS.join(", ")}`),
      { statusCode: 403 }
    );
  }
}

function assertInsidePackage(packageDir, fullPath) {
  if (!isInside(packageDir, fullPath)) {
    throw Object.assign(new Error("Asset path escapes packageDir"), { statusCode: 403 });
  }
}

async function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function isInside(parent, child) {
  const normalizedParent = resolve(parent);
  const normalizedChild = resolve(child);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${sep}`);
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

export const __filename = fileURLToPath(import.meta.url);
