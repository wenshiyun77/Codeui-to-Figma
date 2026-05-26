import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clampBbox, cropRgba, decodePng, encodePng } from "./png-utils.mjs";

const args = process.argv.slice(2);
const packageDir = resolve(getRequiredArg("--package-dir", "Missing --package-dir"));
const recognitionPath = resolve(getArg("--recognition") || `${packageDir}/analysis/recognition.json`);
const tasksPath = resolve(getArg("--tasks") || `${packageDir}/analysis/remove-background-tasks.json`);
const annotationsPath = resolve(getArg("--annotations") || `${packageDir}/analysis/manual-annotations.json`);
const pagePath = resolve(packageDir, "page.json");

const page = JSON.parse(await readFile(pagePath, "utf8"));
const recognition = JSON.parse(await readFile(recognitionPath, "utf8"));
const tasks = await readOptionalJson(tasksPath, { tasks: [] });
const annotations = await readOptionalJson(annotationsPath, { regions: [] });
const textCandidates = Array.isArray(recognition.textCandidates) ? recognition.textCandidates : [];
const shapeCandidates = Array.isArray(recognition.shapeCandidates) ? recognition.shapeCandidates : [];
const foregroundCandidates = Array.isArray(recognition.foregroundCandidates) ? recognition.foregroundCandidates : [];
const image2Tasks = Array.isArray(tasks.tasks) ? tasks.tasks : [];
const manualRegions = Array.isArray(annotations.regions) ? annotations.regions : [];

if (!Array.isArray(page.sections) || !page.sections.length) {
  throw new Error("page.json has no sections");
}

if (textCandidates.length === 0 && shapeCandidates.length === 0 && foregroundCandidates.length === 0 && image2Tasks.length === 0 && manualRegions.length === 0) {
  throw new Error(
    "Recognition is empty. Fill analysis/recognition.json with Codex-detected text/elements and analysis/remove-background-tasks.json with image2 cutout tasks before applying."
  );
}

const taskIds = new Set(image2Tasks.map((task) => task.id));
const missingForegroundTasks = foregroundCandidates
  .filter((candidate) => candidate.extractionMethod === "image2-remove-background")
  .filter((candidate) => !taskIds.has(candidate.id));
const manualImage2Regions = manualRegions.filter(regionRequiresImage2Task);
const missingManualTasks = manualImage2Regions.filter((region) => {
  return !taskIds.has(region.id) && !taskIds.has(region.taskId) && !taskIds.has(region.targetTaskId);
});

if (missingForegroundTasks.length > 0) {
  throw new Error(
    `Recognition has ${missingForegroundTasks.length} foreground candidate(s) without matching image2 remove-background tasks: ${missingForegroundTasks.map((candidate) => candidate.id).join(", ")}`
  );
}
if (missingManualTasks.length > 0) {
  throw new Error(
    `Manual annotations require image2 assets but have no matching remove-background tasks: ${missingManualTasks.map((region) => region.id).join(", ")}`
  );
}

removePreviouslyAppliedRecognition(page);

const applied = {
  manualBackgroundImage: 0,
  manualShape: 0,
  editableText: 0,
  textImage: 0,
  shape: 0,
  foregroundImage: 0,
  pendingTextImages: 0,
  pendingForegroundTasks: 0
};

let sourceImageData = null;
for (const region of manualRegions) {
  if (!isManualBackgroundRegion(region)) {
    continue;
  }
  if (!sourceImageData) {
    sourceImageData = await readSourceImageData(annotations.sourceImage || (page.canvas && page.canvas.sourceImage));
  }
  const asset = await writeManualBackgroundAsset(region, sourceImageData);
  const section = findSectionForBbox(page.sections, region.bbox);
  section.children.push(buildManualBackgroundNode(region, section, asset));
  applied.manualBackgroundImage += 1;
}

for (const region of manualRegions) {
  if (!isManualShapeRegion(region) || !region.style) {
    continue;
  }
  const section = findSectionForBbox(page.sections, region.bbox);
  section.children.push(buildManualShapeNode(region, section));
  applied.manualShape += 1;
}

for (const shape of shapeCandidates) {
  const section = findSectionForBbox(page.sections, shape.bbox);
  section.children.push(buildShapeNode(shape, section));
  applied.shape += 1;
}

for (const text of textCandidates) {
  if (text.nodeType === "textImage") {
    const asset = text.asset || "";
    const exists = asset ? await fileExists(resolve(packageDir, asset)) : false;
    if (!exists) {
      applied.pendingTextImages += 1;
      continue;
    }
  }
  const section = findSectionForBbox(page.sections, text.bbox);
  const node = buildTextNode(text, section);
  section.children.push(node);
  if (node.type === "editableText") {
    applied.editableText += 1;
  } else {
    applied.textImage += 1;
  }
}

for (const task of image2Tasks) {
  const exists = await fileExists(resolve(packageDir, task.targetAsset));
  if (!exists) {
    applied.pendingForegroundTasks += 1;
    continue;
  }
  const section = findSectionForBbox(page.sections, task.bbox);
  section.children.push(buildForegroundNode(task, section));
  applied.foregroundImage += 1;
}

page.metadata = page.metadata || {};
const pendingAssets = applied.pendingTextImages + applied.pendingForegroundTasks;
const appliedNodes = applied.manualShape + applied.editableText + applied.textImage + applied.shape + applied.foregroundImage;
const recognitionComplete = pendingAssets === 0 && appliedNodes > 0;
const image2ForegroundRequired = foregroundCandidates.length > 0 || image2Tasks.length > 0 || manualImage2Regions.length > 0;
page.metadata.pipelineState = recognitionComplete
  ? "codex-recognition-applied"
  : "recognition-pending-image2-assets";
page.metadata.baselineOnly = false;
page.metadata.requiresRecognition = !recognitionComplete;
page.metadata.recognitionRequired = !recognitionComplete;
page.metadata.recognitionComplete = recognitionComplete;
page.metadata.image2ForegroundRequired = image2ForegroundRequired;
page.metadata.recognitionApplied = {
  recognitionPath,
  tasksPath,
  annotationsPath,
  applied,
  policy: "codex-recognition-plus-image2-remove-background",
  updatedAt: new Date().toISOString()
};
page.metadata.manualAnnotationsApplied = manualRegions.length > 0
  ? {
      annotationsPath,
      regionCount: manualRegions.length,
      manualBackgroundImages: applied.manualBackgroundImage,
      manualShapes: applied.manualShape
    }
  : null;

await writeFile(pagePath, JSON.stringify(page, null, 2));

console.log(`Updated ${pagePath}`);
console.log(JSON.stringify(applied, null, 2));

function buildTextNode(text, section) {
  const bbox = text.bbox;
  const style = text.style || {};
  const fontSize = numberOr(style.fontSize, Math.max(12, Math.round(bbox.height * 0.72)));
  const nodeType = text.nodeType === "textImage" ? "textImage" : "editableText";
  const base = {
    id: `rec_text_${sanitizeId(text.id)}`,
    type: nodeType,
    x: round(bbox.x - section.x),
    y: round(bbox.y - section.y),
    width: round(bbox.width),
    height: round(bbox.height),
    recognition: {
      manualRegionId: text.manualRegionId,
      confidence: text.confidence,
      reason: text.reason
    }
  };

  if (nodeType === "textImage") {
    return {
      ...base,
      asset: text.asset || "",
      extractionMethod: "image2-remove-background",
      sourceImage: page.canvas && page.canvas.sourceImage,
      fit: "contain"
    };
  }

  return {
    ...base,
    text: text.text || "",
    fontFamily: style.fontFamily || "Inter",
    fontWeight: numberOr(style.fontWeight, 600),
    fontSize,
    lineHeight: numberOr(style.lineHeight, Math.round(fontSize * 1.18)),
    letterSpacing: numberOr(style.letterSpacing, 0),
    color: style.color || "#FFFFFF",
    align: style.align || "CENTER"
  };
}

function buildForegroundNode(task, section) {
  const bbox = task.bbox;
  return {
    id: `rec_fg_${sanitizeId(task.id)}`,
    type: "foregroundImage",
    asset: task.targetAsset,
    sourceImage: relativeSourceImage(task.sourceImage),
    extractionMethod: "image2-remove-background",
    x: round(bbox.x - section.x),
    y: round(bbox.y - section.y),
    width: round(bbox.width),
    height: round(bbox.height),
    fit: "contain",
    recognition: {
      manualRegionId: task.manualRegionId
    }
  };
}

function buildShapeNode(shape, section) {
  const bbox = shape.bbox;
  const style = shape.style || {};
  const node = {
    id: `rec_shape_${sanitizeId(shape.id)}`,
    type: "shape",
    x: round(bbox.x - section.x),
    y: round(bbox.y - section.y),
    width: round(bbox.width),
    height: round(bbox.height),
    fill: style.fill || "#000000",
    opacity: numberOr(style.opacity, 1),
    cornerRadius: numberOr(style.cornerRadius, 0),
    recognition: {
      manualRegionId: shape.manualRegionId,
      confidence: shape.confidence,
      reason: shape.reason
    }
  };
  if (style.stroke) {
    node.stroke = style.stroke;
    node.strokeOpacity = numberOr(style.strokeOpacity, 1);
    node.strokeWeight = numberOr(style.strokeWeight, 1);
  }
  return node;
}

function buildManualBackgroundNode(region, section, asset) {
  const bbox = region.bbox;
  return {
    id: `manual_bg_${sanitizeId(region.id)}`,
    name: region.label || region.id || "manual background",
    type: "backgroundImage",
    asset,
    sourceImage: page.canvas && page.canvas.sourceImage,
    x: round(bbox.x - section.x),
    y: round(bbox.y - section.y),
    width: round(bbox.width),
    height: round(bbox.height),
    fit: region.fit || "cover",
    recognition: {
      manualRegionId: region.id,
      role: region.role,
      instruction: region.instruction || ""
    }
  };
}

function buildManualShapeNode(region, section) {
  const bbox = region.bbox;
  const style = region.style || {};
  const node = {
    id: `manual_shape_${sanitizeId(region.id)}`,
    name: region.label || region.id || "manual shape",
    type: "shape",
    x: round(bbox.x - section.x),
    y: round(bbox.y - section.y),
    width: round(bbox.width),
    height: round(bbox.height),
    fill: style.fill || "#000000",
    opacity: numberOr(style.opacity, 1),
    cornerRadius: numberOr(style.cornerRadius, 0),
    recognition: {
      manualRegionId: region.id,
      role: region.role,
      instruction: region.instruction || ""
    }
  };
  if (style.stroke) {
    node.stroke = style.stroke;
    node.strokeOpacity = numberOr(style.strokeOpacity, 1);
    node.strokeWeight = numberOr(style.strokeWeight, 1);
  }
  return node;
}

function findSectionForBbox(sections, bbox) {
  const centerY = bbox.y + bbox.height / 2;
  const section = sections.find((candidate) => centerY >= candidate.y && centerY < candidate.y + candidate.height);
  return section || sections[sections.length - 1];
}

function removePreviouslyAppliedRecognition(pageDocument) {
  for (const section of pageDocument.sections || []) {
    section.children = (section.children || []).filter((node) => {
      return !(typeof node.id === "string" && (
        node.id.startsWith("rec_text_") ||
        node.id.startsWith("rec_shape_") ||
        node.id.startsWith("rec_fg_") ||
        node.id.startsWith("manual_bg_") ||
        node.id.startsWith("manual_shape_")
      ));
    });
  }
}

async function readSourceImageData(value) {
  const source = resolveSourceImage(value);
  return decodePng(await readFile(source));
}

async function writeManualBackgroundAsset(region, image) {
  const bbox = clampBbox(region.bbox, image);
  const asset = region.targetAsset || `assets/backgrounds/manual-${sanitizeId(region.id)}.png`;
  const crop = cropRgba(image, bbox.x, bbox.y, bbox.width, bbox.height);
  await mkdir(resolve(packageDir, dirname(asset)), { recursive: true });
  await writeFile(resolve(packageDir, asset), encodePng(crop));
  return asset;
}

function resolveSourceImage(value) {
  if (!value) {
    throw new Error("Missing source image for manual annotation backgrounds");
  }
  const source = String(value);
  if (source.startsWith("/")) {
    return source;
  }
  return resolve(packageDir, source);
}

function dirname(path) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index);
}

function isManualBackgroundRegion(region) {
  return isRole(region, ["heroImage", "moduleBackground", "sectionBackground", "regionBackground", "background"]);
}

function isManualShapeRegion(region) {
  return isRole(region, ["shape", "tabGroup", "tab", "selectedTab", "button", "card", "row"]);
}

function regionRequiresImage2Task(region) {
  if (region.requiresImage2 === false || region.skipImage2 === true) {
    return false;
  }
  return region.extractionMethod === "image2-remove-background" || isRole(region, ["artText", "foreground"]);
}

function isRole(region, roles) {
  return Boolean(region && roles.includes(region.role));
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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function relativeSourceImage(value) {
  if (!value) {
    return page.canvas && page.canvas.sourceImage;
  }
  const source = String(value);
  const marker = "/source/";
  const index = source.indexOf(marker);
  if (index !== -1) {
    return `source/${source.slice(index + marker.length)}`;
  }
  return source;
}

function sanitizeId(value) {
  return String(value || "node")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "node";
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getRequiredArg(name, message) {
  const value = getArg(name);
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
