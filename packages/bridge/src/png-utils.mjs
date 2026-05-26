import { deflateSync, inflateSync } from "node:zlib";

let CRC_TABLE = null;

export function decodePng(buffer) {
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

export function encodePng(image) {
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

export function cropRgba(image, x, y, width, height) {
  const bbox = clampBbox({ x, y, width, height }, image);
  const data = Buffer.alloc(bbox.width * bbox.height * 4);
  for (let row = 0; row < bbox.height; row += 1) {
    const sourceStart = ((bbox.y + row) * image.width + bbox.x) * 4;
    const targetStart = row * bbox.width * 4;
    image.data.copy(data, targetStart, sourceStart, sourceStart + bbox.width * 4);
  }
  return { width: bbox.width, height: bbox.height, data };
}

export function clampBbox(bbox, image) {
  const x = clamp(Math.floor(Number(bbox.x)), 0, image.width - 1);
  const y = clamp(Math.floor(Number(bbox.y)), 0, image.height - 1);
  const right = clamp(Math.ceil(Number(bbox.x) + Number(bbox.width)), x + 1, image.width);
  const bottom = clamp(Math.ceil(Number(bbox.y) + Number(bbox.height)), y + 1, image.height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
