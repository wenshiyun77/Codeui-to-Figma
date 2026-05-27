import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { clampBbox, cropRgba, decodePng, encodePng } from "./png-utils.mjs";

const PORT = Number.parseInt(process.env.BRIDGE_PORT || "39217", 10);
const HOST = process.env.BRIDGE_HOST || "localhost";
const ROOT_DIR = resolve(process.cwd());
const DATA_DIR = resolve(process.env.BRIDGE_DATA_DIR || resolve(ROOT_DIR, "var/bridge"));
const JOBS_FILE = resolve(DATA_DIR, "jobs.json");
const MAX_BODY_BYTES = 100 * 1024 * 1024;
const ALLOWED_ASSET_ROOTS = [ROOT_DIR, DATA_DIR, resolve("/private/tmp"), resolve("/tmp")];

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

    if (req.method === "POST" && url.pathname === "/api/figma-bridge/annotations/handoff-from-image") {
      const body = await readJsonBody(req);
      const result = await createImageAnnotationHandoff(body);
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

async function createImageAnnotationHandoff(body) {
  if (!body || typeof body !== "object") {
    throw badRequest("Expected a JSON object body");
  }

  const image = parseImageDataUrl(body.sourceImageDataUrl);
  const sourceName = sanitizeFileBase(body.sourceImageName || "image2-screen");
  const annotations = body.annotations && typeof body.annotations === "object" ? body.annotations : null;
  if (!annotations || !Array.isArray(annotations.regions)) {
    throw badRequest("Expected annotations.regions");
  }

  const packageName = `manual-${timestamp()}-${sourceName}`;
  const packageDir = resolve(DATA_DIR, "packages", packageName);
  const sourceDir = resolve(packageDir, "source");
  const backgroundsDir = resolve(packageDir, "assets/backgrounds");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(backgroundsDir, { recursive: true });

  const sourceRelativePath = `source/image2-screen.${image.extension}`;
  const sourcePath = resolve(packageDir, sourceRelativePath);
  await writeFile(sourcePath, image.bytes);

  const canvas = annotations.canvas || {};
  const width = Number(canvas.width || 750);
  const height = Number(canvas.height || 0);
  const scaffold = await buildManualScaffold({
    image,
    annotations,
    width,
    height,
    backgroundsDir
  });
  const page = {
    schemaVersion: "activity-page.v0.1",
    name: body.name || sourceName || "CodeUi Manual Annotation",
    canvas: {
      width,
      height,
      background: scaffold.background,
      sourceImage: sourceRelativePath
    },
    metadata: {
      intent: body.prompt || "",
      prompt: body.prompt || "",
      unit: "px",
      source: "figma-plugin-manual-workbench",
      pipelineState: "manual-annotations-ready",
      requiresRecognition: true,
      recognitionRequired: true,
      baselineOnly: true,
      sourceImageOriginal: annotations.sourceImageOriginal || null,
      normalization: annotations.normalization || {
        targetWidth: 750,
        coordinateSystem: "All bboxes are normalized to a 750px-wide canvas."
      },
      recognitionWorkflow: annotations.recognitionWorkflow || defaultRecognitionWorkflow(),
      scaffold: scaffold.metadata
    },
    sections: scaffold.sections
  };
  const pagePath = resolve(packageDir, "page.json");
  await writeFile(pagePath, JSON.stringify(page, null, 2));

  const normalizedAnnotations = {
    ...annotations,
    sourceImage: sourceRelativePath,
    canvas: { width, height },
    recognitionWorkflow: annotations.recognitionWorkflow || defaultRecognitionWorkflow()
  };

  return createCodexHandoff({
    packageDir,
    annotations: normalizedAnnotations
  });
}

async function buildManualScaffold({ image, annotations, width, height, backgroundsDir }) {
  let decoded = null;
  try {
    if (image.extension === "png") {
      decoded = decodePng(image.bytes);
    }
  } catch {
    decoded = null;
  }

  const normalizedWidth = positiveNumber(width, decoded ? decoded.width : 750);
  const normalizedHeight = positiveNumber(
    height,
    decoded ? Math.round(decoded.height * (normalizedWidth / decoded.width)) : 1
  );
  const boundaries = buildScaffoldBoundaries(annotations.regions, normalizedHeight);
  const sections = [];
  const scaleX = decoded ? decoded.width / normalizedWidth : 1;
  const scaleY = decoded ? decoded.height / normalizedHeight : 1;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const y = boundaries[index];
    const nextY = boundaries[index + 1];
    const sectionHeight = nextY - y;
    const label = String(index + 1).padStart(2, "0");
    const children = [];

    if (decoded) {
      const asset = `assets/backgrounds/scaffold-section-${label}-bg.png`;
      const cropBox = clampBbox({
        x: 0,
        y: Math.round(y * scaleY),
        width: Math.round(normalizedWidth * scaleX),
        height: Math.round(sectionHeight * scaleY)
      }, decoded);
      const crop = cropRgba(decoded, cropBox.x, cropBox.y, cropBox.width, cropBox.height);
      await writeFile(resolve(backgroundsDir, `scaffold-section-${label}-bg.png`), encodePng(crop));
      children.push({
        id: `section_${label}_scaffold_bg`,
        type: "backgroundImage",
        asset,
        x: 0,
        y: 0,
        width: normalizedWidth,
        height: sectionHeight,
        fit: "cover",
        recognition: {
          scaffold: true,
          reason: "Baseline source-image crop generated so apply:recognition has stable target sections."
        }
      });
    }

    sections.push({
      id: `section_${label}`,
      type: "section",
      name: `Section ${label}`,
      x: 0,
      y,
      width: normalizedWidth,
      height: sectionHeight,
      children
    });
  }

  return {
    background: decoded ? samplePageBackground(decoded) : "#FFFFFF",
    sections,
    metadata: {
      generatedFrom: "manual-annotations-handoff",
      sectionCount: sections.length,
      hasBackgroundAssets: Boolean(decoded),
      reason: "Manual handoff packages must contain base sections before Codex recognition is applied."
    }
  };
}

function buildScaffoldBoundaries(regions, height) {
  const boundaries = new Set([0, Math.max(1, Math.round(height))]);
  const candidates = Array.isArray(regions)
    ? regions.filter((region) => region && region.bbox && region.role !== "ignore")
    : [];

  for (const region of candidates) {
    const y = clampRange(Math.round(region.bbox.y || 0), 0, height);
    const bottom = clampRange(Math.round((region.bbox.y || 0) + (region.bbox.height || 0)), 0, height);
    if (bottom > y) {
      boundaries.add(y);
      boundaries.add(bottom);
    }
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const merged = [sorted[0]];
  for (const value of sorted.slice(1)) {
    if (value - merged[merged.length - 1] < 24 && value !== height) {
      continue;
    }
    merged.push(value);
  }
  if (merged[merged.length - 1] !== height) {
    merged.push(height);
  }
  return merged.length > 1 ? merged : [0, height];
}

function samplePageBackground(image) {
  const samples = [];
  const patch = Math.max(4, Math.min(24, Math.round(Math.min(image.width, image.height) * 0.025)));
  samples.push(samplePatch(image, 0, 0, patch, patch));
  samples.push(samplePatch(image, image.width - patch, 0, patch, patch));
  samples.push(samplePatch(image, 0, image.height - patch, patch, patch));
  samples.push(samplePatch(image, image.width - patch, image.height - patch, patch, patch));
  const avg = samples.reduce((acc, color) => ({
    r: acc.r + color.r,
    g: acc.g + color.g,
    b: acc.b + color.b
  }), { r: 0, g: 0, b: 0 });
  return rgbToHex(
    Math.round(avg.r / samples.length),
    Math.round(avg.g / samples.length),
    Math.round(avg.b / samples.length)
  );
}

function samplePatch(image, startX, startY, width, height) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = Math.max(0, startY); y < Math.min(image.height, startY + height); y += 1) {
    for (let x = Math.max(0, startX); x < Math.min(image.width, startX + width); x += 1) {
      const offset = (y * image.width + x) * 4;
      r += image.data[offset];
      g += image.data[offset + 1];
      b += image.data[offset + 2];
      count += 1;
    }
  }
  return count ? { r: r / count, g: g / count, b: b / count } : { r: 255, g: 255, b: 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clampRange(value, 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  if (!isInside(ROOT_DIR, packageDir) && packageDir !== ROOT_DIR && !isInside(DATA_DIR, packageDir) && packageDir !== DATA_DIR) {
    throw Object.assign(new Error("packageDir must be inside the bridge workspace or Bridge data directory"), { statusCode: 403 });
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
  const annotations = body && body.annotations && typeof body.annotations === "object" ? body.annotations : {};
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
    canvas: page.canvas || null,
    normalization: annotations.normalization || (page.metadata && page.metadata.normalization) || null,
    sourceImageOriginal: annotations.sourceImageOriginal || (page.metadata && page.metadata.sourceImageOriginal) || null,
    recognitionWorkflow: annotations.recognitionWorkflow || (page.metadata && page.metadata.recognitionWorkflow) || defaultRecognitionWorkflow(),
    nextAction: "Codex must read source image plus every manual-annotations.json region, including the full instruction/备注 text and any nested region.elements reference boxes, then update recognition.json and remove-background-tasks.json. Do not call OpenAI API from scripts. Do not let the workbench perform semantic recognition.",
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
    "框选区域只是识别约束，不是最终切图规则。每个区域的备注/指引必须完整阅读，备注可能明确说明区域内多层级元素如何拆分、哪些元素保留为背景、哪些元素转成文字/形状/透明素材。如果 region.elements 存在，它们是备注中 [元素ID] 引用的内部元素框，必须按对应 bbox 精确读取。艺术字和前景透明 PNG 必须由 image2 去背景生成；本地代码只允许裁普通矩形背景和装配 page.json。",
    "",
    `Package: ${handoff.packageDir}`,
    `Source image: ${handoff.sourceImage}`,
    `Annotations: ${handoff.annotationsPath}`,
    `Recognition output: ${handoff.recognitionPath}`,
    `Image2 tasks output: ${handoff.removeBackgroundTasksPath}`,
    `User prompt: ${handoff.prompt || "未提供"}`,
    `Canvas: ${handoff.canvas ? `${handoff.canvas.width} x ${handoff.canvas.height}` : "未提供"}`,
    `Normalization: ${handoff.normalization ? JSON.stringify(handoff.normalization) : "未提供"}`,
    "",
    "## Codex 下一步",
    "",
    "1. 如果源图不是 750px 宽，先按 handoff normalization 等比归一化到 750px 宽；所有坐标以归一化后的页面坐标为准。",
    "2. 先识别整页底色，作为 Figma 根 Frame 填充。",
    "3. 去除顶部电池条、底部安全条等手机系统元素，不作为业务 UI 图层。",
    "4. 逐条读取 source image 和 manual-annotations.json，完整阅读每个 region 的 instruction/备注；如果备注引用 [元素ID]，必须查找同一 region.elements 里的 bbox。",
    "5. 先处理文字：识别文本内容、字体、字号、字重、颜色、坐标和尺寸，并写入 editableText。",
    "6. 再分离 Tab、按钮、图标、艺术字和前景素材；所有透明 PNG/WebP 必须由 image2 去背景生成，不要用本地抠图代替。",
    "7. 完整头图默认保持一整张图；之后再处理区域背景和模块背景。",
    "8. 补全 recognition.json 和 remove-background-tasks.json，运行 apply:recognition 和 validate:page。",
    "9. 校验通过后提交到 Figma Bridge；Figma 拼接时隐藏原图，所有元素必须按正确位置和尺寸覆盖源图。",
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

function parseImageDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw badRequest("sourceImageDataUrl must be a PNG, JPG, or WebP data URL");
  }
  const mimeType = match[1].toLowerCase();
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  return {
    mimeType,
    extension,
    bytes: Buffer.from(match[2], "base64")
  };
}

function sanitizeFileBase(value) {
  const base = String(value || "image2-screen")
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "image2-screen";
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function defaultRecognitionWorkflow() {
  return {
    targetCanvasWidth: 750,
    removePhoneSystemBars: true,
    requireImage2ForTransparentAssets: true,
    reconstructionRule: "Codex returns layered page.json; Figma reconstruction hides the source image and all layers must cover the source image at the correct position and size.",
    order: [
      "Normalize the source image proportionally to a 750px page width before recording coordinates.",
      "Detect the full-page base color and use it as the Figma root frame fill.",
      "Remove phone system UI such as top battery/status bars and bottom safe-area bars before semantic layering.",
      "Process text first by recognizing content, font family, font size, font weight, color, position, and size.",
      "After text is removed from consideration, separate tabs, buttons, and icons; transparent assets must use image2 background removal.",
      "Identify the hero image position; preserve the hero as a complete image unless a manual note explicitly says otherwise.",
      "Finally identify module and section backgrounds from the annotated regions."
    ]
  };
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
