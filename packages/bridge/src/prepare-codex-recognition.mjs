import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const args = process.argv.slice(2);
const packageDir = getArg("--package-dir") ? resolve(getArg("--package-dir")) : null;
const inputArg = getArg("--input");
const inputPath = inputArg ? resolve(inputArg) : await resolvePackageSourceImage(packageDir);
const outputDir = resolve(getArg("--out") || (packageDir ? `${packageDir}/analysis` : "var/analysis/codex-recognition"));
const prompt = getArg("--prompt") || "";
const requiredModel = getArg("--required-model") || "gpt-5.5";
const annotationsPath = resolve(getArg("--annotations") || `${outputDir}/manual-annotations.json`);
const annotations = await readOptionalJson(annotationsPath, null);

if (!inputPath) {
  throw new Error("Missing --input <image> or --package-dir with canvas.sourceImage");
}

await mkdir(outputDir, { recursive: true });

const recognitionSchema = buildRecognitionSchema();
const tasksSchema = buildRemoveBackgroundTasksSchema();
const promptMarkdown = buildPromptMarkdown({
  inputPath,
  packageDir,
  outputDir,
  prompt,
  requiredModel,
  annotationsPath,
  annotations,
  recognitionSchema,
  tasksSchema
});

await writeFile(resolve(outputDir, "codex-recognition-prompt.md"), promptMarkdown);
await writeFile(resolve(outputDir, "recognition.schema.json"), JSON.stringify(recognitionSchema, null, 2));
await writeFile(resolve(outputDir, "remove-background-tasks.schema.json"), JSON.stringify(tasksSchema, null, 2));
await writeFile(resolve(outputDir, "recognition.json"), JSON.stringify(emptyRecognition(), null, 2));
await writeFile(resolve(outputDir, "remove-background-tasks.json"), JSON.stringify(emptyTasks(inputPath), null, 2));

console.log(`Prepared Codex recognition workspace: ${outputDir}`);
console.log(`Prompt: ${outputDir}/codex-recognition-prompt.md`);
console.log(`Image: ${inputPath}`);
console.log(`Required model: ${requiredModel}`);
if (annotations) {
  console.log(`Manual annotations: ${annotationsPath}`);
}

function buildPromptMarkdown({ inputPath, packageDir, outputDir, prompt, requiredModel, annotationsPath, annotations, recognitionSchema, tasksSchema }) {
  return [
    "# CodeUi-to-Figma Recognition Task",
    "",
    `Required Codex model: ${requiredModel}`,
    "",
    "Do not call the OpenAI API. Do not use local CV recognition for semantic decisions.",
    "Use Codex visual understanding directly on the image file.",
    "",
    "Before recognition, verify the current Codex session is running the required model. If it is not, stop and tell the user to switch models.",
    "",
    "## Input",
    "",
    `Image: ${inputPath}`,
    packageDir ? `Package directory: ${packageDir}` : "Package directory: not provided",
    prompt ? `User prompt: ${prompt}` : "User prompt: not provided",
    annotations ? `Manual annotations: ${annotationsPath}` : "Manual annotations: not provided",
    "",
    "## Required Outputs",
    "",
    `Write recognition JSON to: ${resolve(outputDir, "recognition.json")}`,
    `Write image2 background-removal task JSON to: ${resolve(outputDir, "remove-background-tasks.json")}`,
    "",
    "## Recognition Rules",
    "",
    "- Treat the image2 screen as the visual source of truth.",
    "- If manual annotations are provided, treat them as higher-priority constraints than free visual guessing.",
    "- For every manual region, read the full `instruction`/备注 text before making recognition decisions. Do not summarize it away.",
    "- If a manual region has nested `elements`, treat each element bbox as a precise reference target for any `[元素ID]` mentioned in the region instruction.",
    "- The instruction text may contain explicit multi-layer handling rules for elements inside that region. Follow those rules when deciding background, editable text, shapes, textImage, and foreground tasks.",
    "- Manual boxes are recognition constraints, not final cut instructions. Use them to decide what to recognize and where; do not blindly export every box as a flat image layer.",
    "- Do not split inside a `heroImage` manual region unless its instruction explicitly asks for inner layers. Keep campaign head art as one complete image when annotated that way.",
    "- For every `moduleBackground` manual region, keep it as a meaningful rectangular background region and recognize only the intentionally overlaid elements inside or around it.",
    "- For every `tabGroup` manual region, identify the tab-group background, the selected tab state, and individual tab text. The selected state must be separated as a shape candidate or a manual selectedTab region.",
    "- For every `artText` manual region, create a `textImage` candidate and a matching image2 background-removal task unless the instruction says it is already included in a larger preserved image.",
    "- For every `foreground` manual region, create a matching image2 background-removal task and a foreground candidate. The final transparent PNG must come from image2, not local cropping.",
    "- Include `manualRegionId` on candidates that come from or are constrained by a manual region.",
    "- This is not a coarse slicing task. Do not stop at 4-8 full-width sections.",
    "- Identify page sections, module background regions, ordinary text candidates, art-text candidates, icons, buttons, badges, people, products, decorations, and foreground objects.",
    "- Every visible UI element that should become an independent Figma layer needs either a text candidate or a foreground/background-removal task.",
    "- Simple UI panels, cards, rank rows, tabs, button backgrounds, and separators should become `shapeCandidates` when they can be represented as rectangles.",
    "- Ordinary readable copy should become `editableText` with estimated font family, size, weight, color, line height, letter spacing, alignment, and pixel bbox.",
    "- Complex campaign title art, stylized Arabic/Chinese text, trophy labels, and highly rendered type should become `textImage` candidates with transparent image2 assets.",
    "- Every `textImage` and foreground object must also appear in `remove-background-tasks.json` with a target asset path under `assets/text-images/` or `assets/foregrounds/`.",
    "- Foreground and art-text transparent cutouts must use image2 background removal.",
    "- Do not propose chroma key, OpenCV, Pillow, thresholding, canvas masking, or any local background removal.",
    "- Prefer high-confidence candidates, but do not omit major visible elements just because the page is visually dense.",
    "- Coordinates are pixels with origin at the top-left of the image.",
    annotations ? "\n## Manual Annotations\n\n```json\n" + JSON.stringify(annotations, null, 2) + "\n```" : "",
    "",
    "## recognition.json Schema",
    "",
    "```json",
    JSON.stringify(recognitionSchema, null, 2),
    "```",
    "",
    "## remove-background-tasks.json Schema",
    "",
    "```json",
    JSON.stringify(tasksSchema, null, 2),
    "```"
  ].join("\n");
}

async function resolvePackageSourceImage(root) {
  if (!root) {
    return null;
  }
  const pagePath = resolve(root, "page.json");
  const page = JSON.parse(await readFile(pagePath, "utf8"));
  const sourceImage = page.canvas && page.canvas.sourceImage;
  if (!sourceImage) {
    throw new Error(`page.json in ${root} has no canvas.sourceImage`);
  }
  return resolve(root, sourceImage);
}

function emptyRecognition() {
  return {
    summary: "",
    sections: [],
    shapeCandidates: [],
    foregroundCandidates: [],
    textCandidates: [],
    notes: []
  };
}

function emptyTasks(sourceImage) {
  return {
    policy: "image2-remove-background-only",
    sourceImage,
    tasks: []
  };
}

async function readOptionalJson(path, fallback) {
  try {
    await access(path);
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function buildRecognitionSchema() {
  const bbox = {
    type: "object",
    additionalProperties: false,
    required: ["x", "y", "width", "height"],
    properties: {
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "sections", "shapeCandidates", "foregroundCandidates", "textCandidates", "notes"],
    properties: {
      summary: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "bbox", "confidence"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            bbox,
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      },
      foregroundCandidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "type", "bbox", "extractionMethod", "confidence", "reason"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            type: { enum: ["product", "person", "mascot", "decoration", "icon", "artText", "other"] },
            bbox,
            manualRegionId: { type: "string" },
            extractionMethod: { const: "image2-remove-background" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" }
          }
        }
      },
      shapeCandidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "bbox", "style", "confidence", "reason"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            bbox,
            style: {
              type: "object",
              additionalProperties: false,
              required: ["fill", "opacity", "cornerRadius"],
              properties: {
                fill: { type: "string" },
                opacity: { type: "number", minimum: 0, maximum: 1 },
                cornerRadius: { type: "number", minimum: 0 },
                stroke: { type: "string" },
                strokeOpacity: { type: "number", minimum: 0, maximum: 1 },
                strokeWeight: { type: "number", minimum: 0 }
              }
            },
            manualRegionId: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" }
          }
        }
      },
      textCandidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text", "nodeType", "bbox", "confidence", "reason"],
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            nodeType: { enum: ["editableText", "textImage"] },
            asset: { type: "string" },
            bbox,
            manualRegionId: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" },
            style: {
              type: "object",
              additionalProperties: false,
              required: ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "align"],
              properties: {
                fontFamily: { type: "string" },
                fontSize: { type: "number" },
                fontWeight: { type: "number" },
                lineHeight: { type: "number" },
                letterSpacing: { type: "number" },
                color: { type: "string" },
                align: { enum: ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"] }
              }
            }
          }
        }
      },
      notes: { type: "array", items: { type: "string" } }
    }
  };
}

function buildRemoveBackgroundTasksSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["policy", "sourceImage", "tasks"],
    properties: {
      policy: { const: "image2-remove-background-only" },
      sourceImage: { type: "string" },
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "type", "bbox", "targetAsset", "extractionMethod", "prompt"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            type: { type: "string" },
            bbox: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y", "width", "height"],
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" }
              }
            },
            targetAsset: { type: "string" },
            manualRegionId: { type: "string" },
            extractionMethod: { const: "image2-remove-background" },
            prompt: { type: "string" }
          }
        }
      }
    }
  };
}

function getArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
