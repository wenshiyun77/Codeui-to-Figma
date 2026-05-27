import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";

let CRC_TABLE = null;

const args = process.argv.slice(2);
const inputPath = resolve(getRequiredArg("--input", "Missing --input <image.png>"));
const prompt = getArg("--prompt") || "";
const name = getArg("--name") || inferName(prompt, inputPath);
const outDir = resolve(getArg("--out") || `var/generated/parsed-${timestamp()}`);
const minSectionHeight = Number.parseInt(getArg("--min-section-height") || "260", 10);
const maxSectionHeight = Number.parseInt(getArg("--max-section-height") || "900", 10);
const fixedSectionHeight = getArg("--section-height") ? Number.parseInt(getArg("--section-height"), 10) : null;
const shouldSubmit = args.includes("--submit");

if (extname(inputPath).toLowerCase() !== ".png") {
  throw new Error("parse-image-package currently supports PNG input only. Convert image2 output to PNG before parsing.");
}

const source = await readFile(inputPath);
const image = decodePng(source);
const boundaries = fixedSectionHeight
  ? fixedBoundaries(image.height, fixedSectionHeight)
  : detectSectionBoundaries(image, { minSectionHeight, maxSectionHeight });
const packageData = buildPackage({ image, boundaries, name, prompt, inputPath });

await writePackage(outDir, inputPath, image, boundaries, packageData);

console.log(`Parsed image package: ${outDir}`);
console.log(`page.json: ${outDir}/page.json`);
console.log(`sections: ${boundaries.length - 1}`);

if (shouldSubmit) {
  throw new Error(
    "Refusing to submit baseline section slices. Run recognize:prepare, fill recognition.json with Codex, create required image2 transparent assets, then run handoff:continue."
  );
}

function buildPackage({ image, boundaries, name, prompt, inputPath }) {
  const sections = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const y = boundaries[i];
    const nextY = boundaries[i + 1];
    const sectionHeight = nextY - y;
    const index = String(i + 1).padStart(2, "0");
    sections.push({
      id: `section_${index}`,
      type: "section",
      name: `Section ${index}`,
      x: 0,
      y,
      width: image.width,
      height: sectionHeight,
      children: [
        {
          id: `section_${index}_bg`,
          type: "backgroundImage",
          asset: `assets/backgrounds/section-${index}-bg.png`,
          x: 0,
          y: 0,
          width: image.width,
          height: sectionHeight,
          fit: "cover"
        }
      ]
    });
  }

  return {
    schemaVersion: "activity-page.v0.1",
    name,
    canvas: {
      width: image.width,
      height: image.height,
      background: "#FFFFFF",
      sourceImage: `source/${basename(inputPath)}`
    },
    metadata: {
      id: `parsed_${randomUUID()}`,
      prompt,
      source: inputPath,
      parser: "parse-image-package.mjs",
      parserVersion: "0.1",
      pipelineState: "requires-codex-recognition",
      baselineOnly: true,
      requiresRecognition: true,
      recognitionRequired: true,
      recognitionGate: {
        requiredBeforeSubmit: true,
        reason: "Parser output contains only section background slices. It is not a layered Figma reconstruction until Codex recognition and image2 cutout assets have been applied."
      },
      limitations: [
        "PNG input only",
        "section background slicing only",
        "OCR text extraction not implemented",
        "foreground transparent cutout extraction not implemented"
      ]
    },
    sections
  };
}

async function writePackage(outDirPath, inputImagePath, image, boundaries, page) {
  await mkdir(resolve(outDirPath, "assets/backgrounds"), { recursive: true });
  await mkdir(resolve(outDirPath, "source"), { recursive: true });
  await copyFile(inputImagePath, resolve(outDirPath, "source", basename(inputImagePath)));
  await writeFile(resolve(outDirPath, "page.json"), JSON.stringify(page, null, 2));

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const y = boundaries[i];
    const height = boundaries[i + 1] - y;
    const index = String(i + 1).padStart(2, "0");
    const cropped = cropRgba(image, 0, y, image.width, height);
    await writeFile(
      resolve(outDirPath, `assets/backgrounds/section-${index}-bg.png`),
      encodePng(cropped)
    );
  }
}

function detectSectionBoundaries(image, options) {
  const rowAverages = computeRowAverages(image);
  const scores = [0];
  for (let y = 1; y < image.height; y += 1) {
    const previous = rowAverages[y - 1];
    const current = rowAverages[y];
    scores[y] =
      Math.abs(current.r - previous.r) +
      Math.abs(current.g - previous.g) +
      Math.abs(current.b - previous.b);
  }
  const smoothed = smooth(scores, 8);
  const boundaries = [0];
  let currentY = 0;

  while (image.height - currentY > options.maxSectionHeight) {
    const searchStart = Math.min(image.height - 1, currentY + options.minSectionHeight);
    const searchEnd = Math.min(image.height - options.minSectionHeight, currentY + options.maxSectionHeight);
    let bestY = currentY + options.maxSectionHeight;
    let bestScore = -1;

    for (let y = searchStart; y <= searchEnd; y += 1) {
      if (smoothed[y] > bestScore) {
        bestScore = smoothed[y];
        bestY = y;
      }
    }

    if (bestScore < 10) {
      bestY = currentY + options.maxSectionHeight;
    }

    boundaries.push(bestY);
    currentY = bestY;
  }

  boundaries.push(image.height);
  mergeSmallTail(boundaries, options.minSectionHeight);
  return boundaries;
}

function fixedBoundaries(height, sectionHeight) {
  const boundaries = [0];
  let y = sectionHeight;
  while (y < height) {
    boundaries.push(y);
    y += sectionHeight;
  }
  boundaries.push(height);
  return boundaries;
}

function mergeSmallTail(boundaries, minHeight) {
  if (boundaries.length < 3) {
    return;
  }
  const last = boundaries[boundaries.length - 1];
  const previous = boundaries[boundaries.length - 2];
  if (last - previous < minHeight) {
    boundaries.splice(boundaries.length - 2, 1);
  }
}

function computeRowAverages(image) {
  const result = [];
  const step = Math.max(1, Math.floor(image.width / 180));
  for (let y = 0; y < image.height; y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let x = 0; x < image.width; x += step) {
      const offset = (y * image.width + x) * 4;
      r += image.data[offset];
      g += image.data[offset + 1];
      b += image.data[offset + 2];
      count += 1;
    }
    result.push({ r: r / count, g: g / count, b: b / count });
  }
  return result;
}

function smooth(values, radius) {
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - radius);
    const end = Math.min(values.length - 1, i + radius);
    let total = 0;
    for (let j = start; j <= end; j += 1) {
      total += values[j];
    }
    result[i] = total / (end - start + 1);
  }
  return result;
}

function cropRgba(image, x, y, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * image.width + x) * 4;
    const targetStart = row * width * 4;
    image.data.copy(data, targetStart, sourceStart, sourceStart + width * 4);
  }
  return { width, height, data };
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

function encodePng(image) {
  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rawOffset = y * (stride + 1);
    raw[rawOffset] = 0;
    image.data.copy(raw, rawOffset + 1, y * stride, y * stride + stride);
  }

  const chunks = [
    pngChunk("IHDR", ihdr(image.width, image.height)),
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

function inferName(promptText, imagePath) {
  const clean = promptText.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
  if (clean) {
    return clean.slice(0, 36);
  }
  return basename(imagePath, extname(imagePath));
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

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}
