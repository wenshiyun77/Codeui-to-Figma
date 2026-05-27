import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

let CRC_TABLE = null;

const args = process.argv.slice(2);
const packageDir = resolve(getRequiredArg("--package-dir", "Missing --package-dir"));
const tasksPath = resolve(getArg("--tasks") || `${packageDir}/analysis/remove-background-tasks.json`);
const outDir = resolve(getArg("--out") || `${packageDir}/analysis/image2-cutouts`);
const tasks = JSON.parse(await readFile(tasksPath, "utf8"));
const sourceImage = resolveSourceImage(tasks.sourceImage, packageDir);
const image = decodePng(await readFile(sourceImage));

if (!Array.isArray(tasks.tasks) || tasks.tasks.length === 0) {
  throw new Error(`No image2 remove-background tasks found in ${tasksPath}`);
}
if (tasks.policy !== "image2-remove-background-only") {
  throw new Error(`Unexpected task policy: ${tasks.policy || "missing"}`);
}

await mkdir(resolve(outDir, "source-regions"), { recursive: true });
await mkdir(resolve(outDir, "image2-output"), { recursive: true });

const manifest = {
  policy: "image2-remove-background-only",
  sourceImage,
  tasks: []
};

for (const task of tasks.tasks) {
  validateTask(task);
  const bbox = clampBbox(task.bbox, image);
  const sourceRegion = `source-regions/${safeFileName(task.id)}-source.png`;
  const outputRegion = `image2-output/${safeFileName(task.id)}.png`;
  const crop = cropRgba(image, bbox.x, bbox.y, bbox.width, bbox.height);
  await writeFile(resolve(outDir, sourceRegion), encodePng(crop));
  await mkdir(resolve(packageDir, dirname(task.targetAsset)), { recursive: true });

  manifest.tasks.push({
    id: task.id,
    label: task.label,
    type: task.type,
    bbox,
    prompt: task.prompt,
    sourceRegion,
    suggestedImage2Output: outputRegion,
    finalTargetAsset: task.targetAsset
  });
}

await writeFile(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(resolve(outDir, "tasks.md"), buildMarkdown(manifest));

console.log(`Prepared ${manifest.tasks.length} image2 cutout task(s): ${outDir}`);
console.log(`Task list: ${resolve(outDir, "tasks.md")}`);
console.log(`Manifest: ${resolve(outDir, "manifest.json")}`);

function buildMarkdown(manifestData) {
  const lines = [
    "# Image2 Background Removal Tasks",
    "",
    "Use image2 background removal only. Do not use local chroma key, OpenCV, Pillow matting, Photoshop remove-background, or manual masking.",
    "",
    `Source image: ${manifestData.sourceImage}`,
    "",
    "For each task:",
    "1. Upload the source region PNG to image2 as the edit/input image.",
    "2. Apply the prompt exactly.",
    "3. Save the clean transparent PNG to `suggestedImage2Output` first.",
    "4. Copy the final approved PNG to `finalTargetAsset` inside the package.",
    "5. Rerun `npm run handoff:continue -- --package-dir <package-dir>`. It will apply recognition, validate, and submit to the Figma Bridge when all image2 assets exist.",
    ""
  ];

  for (const task of manifestData.tasks) {
    lines.push(`## ${task.id} - ${task.label}`);
    lines.push("");
    lines.push(`- Source region: ${task.sourceRegion}`);
    lines.push(`- Suggested image2 output: ${task.suggestedImage2Output}`);
    lines.push(`- Final target asset: ${task.finalTargetAsset}`);
    lines.push(`- BBox: x=${task.bbox.x}, y=${task.bbox.y}, width=${task.bbox.width}, height=${task.bbox.height}`);
    lines.push(`- Prompt: ${task.prompt}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function validateTask(task) {
  if (!task || typeof task !== "object") {
    throw new Error("Invalid task entry");
  }
  for (const key of ["id", "label", "bbox", "targetAsset", "extractionMethod", "prompt"]) {
    if (!task[key]) {
      throw new Error(`Task is missing ${key}`);
    }
  }
  if (task.extractionMethod !== "image2-remove-background") {
    throw new Error(`Task ${task.id} is not image2-remove-background`);
  }
}

function clampBbox(bbox, imageData) {
  const x = clamp(Math.floor(Number(bbox.x)), 0, imageData.width - 1);
  const y = clamp(Math.floor(Number(bbox.y)), 0, imageData.height - 1);
  const right = clamp(Math.ceil(Number(bbox.x) + Number(bbox.width)), x + 1, imageData.width);
  const bottom = clamp(Math.ceil(Number(bbox.y) + Number(bbox.height)), y + 1, imageData.height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

function cropRgba(imageData, x, y, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * imageData.width + x) * 4;
    const targetStart = row * width * 4;
    imageData.data.copy(data, targetStart, sourceStart, sourceStart + width * 4);
  }
  return { width, height, data };
}

function resolveSourceImage(value, root) {
  if (!value) {
    throw new Error("remove-background-tasks.json has no sourceImage");
  }
  const source = String(value);
  if (source.startsWith("/")) {
    return source;
  }
  return resolve(root, source);
}

function dirname(path) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index);
}

function safeFileName(value) {
  return String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "task";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Input is not a PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);
    offset = dataEnd + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) {
        throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
      }
      if (![0, 2, 6].includes(colorType)) {
        throw new Error(`Unsupported PNG color type: ${colorType}`);
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * bytesPerPixel;
  const unfiltered = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const scanline = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const outputOffset = y * stride;
    unfilterScanline(filter, scanline, unfiltered, outputOffset, stride, bytesPerPixel, y === 0 ? null : outputOffset - stride);
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < unfiltered.length; i += bytesPerPixel, p += 4) {
    if (colorType === 6) {
      rgba[p] = unfiltered[i];
      rgba[p + 1] = unfiltered[i + 1];
      rgba[p + 2] = unfiltered[i + 2];
      rgba[p + 3] = unfiltered[i + 3];
    } else if (colorType === 2) {
      rgba[p] = unfiltered[i];
      rgba[p + 1] = unfiltered[i + 1];
      rgba[p + 2] = unfiltered[i + 2];
      rgba[p + 3] = 255;
    } else {
      rgba[p] = unfiltered[i];
      rgba[p + 1] = unfiltered[i];
      rgba[p + 2] = unfiltered[i];
      rgba[p + 3] = 255;
    }
  }

  return { width, height, data: rgba };
}

function unfilterScanline(filter, scanline, output, outputOffset, stride, bpp, previousOffset) {
  for (let i = 0; i < stride; i += 1) {
    const x = scanline[i];
    const left = i >= bpp ? output[outputOffset + i - bpp] : 0;
    const up = previousOffset === null ? 0 : output[previousOffset + i];
    const upLeft = previousOffset !== null && i >= bpp ? output[previousOffset + i - bpp] : 0;
    let value;

    if (filter === 0) {
      value = x;
    } else if (filter === 1) {
      value = x + left;
    } else if (filter === 2) {
      value = x + up;
    } else if (filter === 3) {
      value = x + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      value = x + paeth(left, up, upLeft);
    } else {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }

    output[outputOffset + i] = value & 255;
  }
}

function encodePng(imageData) {
  const stride = imageData.width * 4;
  const raw = Buffer.alloc((stride + 1) * imageData.height);
  for (let y = 0; y < imageData.height; y += 1) {
    const rawOffset = y * (stride + 1);
    raw[rawOffset] = 0;
    imageData.data.copy(raw, rawOffset + 1, y * stride, y * stride + stride);
  }

  const chunks = [
    pngChunk("IHDR", ihdr(imageData.width, imageData.height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  if (!CRC_TABLE) {
    CRC_TABLE = makeCrcTable();
  }
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
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
