const SEMANTIC_LAYER_TYPES = new Set([
  "editableText",
  "text",
  "textImage",
  "foregroundImage",
  "decorativeImage",
  "shape",
  "hotspot"
]);

export function analyzePageQuality(pageDocument) {
  const canvas = pageDocument && pageDocument.canvas ? pageDocument.canvas : {};
  const metadata = pageDocument && pageDocument.metadata ? pageDocument.metadata : {};
  const layers = collectLayers(pageDocument);
  const semanticLayers = layers.filter((layer) => SEMANTIC_LAYER_TYPES.has(layer.type));
  const textLayers = semanticLayers.filter((layer) =>
    layer.type === "editableText" || layer.type === "text" || layer.type === "textImage"
  );
  const foregroundLayers = semanticLayers.filter((layer) =>
    layer.type === "foregroundImage" || layer.type === "decorativeImage"
  );
  const fullCanvasImages = layers.filter((layer) => isFullCanvasImage(layer, canvas));
  const backgroundOnly =
    layers.length > 0 && layers.every((layer) => layer.type === "backgroundImage");

  return {
    canvas,
    metadata,
    layers,
    semanticLayers,
    textLayers,
    foregroundLayers,
    fullCanvasImages,
    backgroundOnly,
    counts: {
      sections: Array.isArray(pageDocument && pageDocument.sections) ? pageDocument.sections.length : 0,
      layers: layers.length,
      semantic: semanticLayers.length,
      text: textLayers.length,
      foreground: foregroundLayers.length,
      fullCanvasImages: fullCanvasImages.length
    }
  };
}

export function assertPageReadyForSubmit(pageDocument, sourcePath) {
  const report = analyzePageQuality(pageDocument);
  const metadata = report.metadata;
  const fromBaselineParser = metadata.parser === "parse-image-package.mjs";
  const flatImportMode = metadata.importMode === "flat-source-image";
  const hasRecognition = Boolean(metadata.recognitionApplied);
  const needsRecognition =
    metadata.requiresRecognition === true ||
    metadata.recognitionRequired === true ||
    metadata.baselineOnly === true ||
    metadata.pipelineState === "requires-codex-recognition" ||
    (fromBaselineParser && !hasRecognition);

  if (needsRecognition && !hasRecognition) {
    throwQualityError(sourcePath, [
      "unrecognized baseline package",
      "The page only contains coarse image scaffolding.",
      "Run recognize:prepare, fill analysis/recognition.json with Codex, create required image2 transparent assets, run apply:recognition, then submit again."
    ]);
  }

  if (hasRecognition && metadata.recognitionComplete === false) {
    throwQualityError(sourcePath, [
      "incomplete recognition package",
      "Some recognized text-image or foreground cutout assets are still pending.",
      "Finish the image2 background-removal assets and rerun apply:recognition before submitting."
    ]);
  }

  if (metadata.image2ForegroundRequired === true && report.counts.foreground === 0) {
    throwQualityError(sourcePath, [
      "missing image2 foreground layers",
      "Recognition identified foreground or art-text assets, but no clean image2 foreground layer is present.",
      "Create the required transparent assets with image2 background removal and rerun apply:recognition."
    ]);
  }

  if (flatImportMode || report.fullCanvasImages.length > 0) {
    throwQualityError(sourcePath, [
      "flat full-image import",
      "A full-canvas PNG/JPG layer is not an element-layered reconstruction.",
      "Split the page into module backgrounds, editable text, foreground/text-image assets, shapes, and hotspots before importing."
    ]);
  }

  if ((fromBaselineParser || hasRecognition) && report.counts.semantic === 0) {
    throwQualityError(sourcePath, [
      "non-layered parser package",
      "The page still contains only background images.",
      "Run real Codex element recognition and apply the resulting layers before submitting."
    ]);
  }

  if (hasRecognition && report.counts.semantic < 8) {
    throwQualityError(sourcePath, [
      "insufficient element layers",
      `Only ${report.counts.semantic} semantic layer(s) were found.`,
      "For activity pages, recognition must create multiple editable text, text-image, foreground, shape, or hotspot layers."
    ]);
  }

  return report;
}

export function collectLayers(pageDocument) {
  const result = [];
  const sections = Array.isArray(pageDocument && pageDocument.sections) ? pageDocument.sections : [];
  for (const section of sections) {
    collectLayerList(section.children || [], {
      x: numberOr(section.x, 0),
      y: numberOr(section.y, 0)
    }, result);
  }
  collectLayerList(pageDocument && pageDocument.nodes ? pageDocument.nodes : [], { x: 0, y: 0 }, result);
  return result;
}

function collectLayerList(nodes, parentOffset, result) {
  if (!Array.isArray(nodes)) {
    return;
  }
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const absolute = {
      ...node,
      absoluteX: parentOffset.x + numberOr(node.x, 0),
      absoluteY: parentOffset.y + numberOr(node.y, 0),
      width: numberOr(node.width, 0),
      height: numberOr(node.height, 0)
    };
    result.push(absolute);
    collectLayerList(node.children || [], {
      x: absolute.absoluteX,
      y: absolute.absoluteY
    }, result);
  }
}

function isFullCanvasImage(layer, canvas) {
  if (layer.type !== "image") {
    return false;
  }
  const canvasWidth = numberOr(canvas.width, 0);
  const canvasHeight = numberOr(canvas.height, 0);
  if (!canvasWidth || !canvasHeight) {
    return false;
  }
  const areaRatio = (layer.width * layer.height) / (canvasWidth * canvasHeight);
  const nearOrigin = Math.abs(layer.absoluteX) <= 2 && Math.abs(layer.absoluteY) <= 2;
  const coversWidth = layer.width >= canvasWidth * 0.9;
  const coversHeight = layer.height >= canvasHeight * 0.9;
  return nearOrigin && coversWidth && coversHeight && areaRatio >= 0.8;
}

function throwQualityError(sourcePath, parts) {
  throw new Error(`Refusing to submit ${parts.join(": ")} Source: ${sourcePath}`);
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
