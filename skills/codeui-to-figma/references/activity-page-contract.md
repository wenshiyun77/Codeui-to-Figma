# Activity Page Contract

Use `activity-page.v0.1` for campaign or landing pages generated from image2 outputs.

Required package shape:

```text
activity-output/
  page.json
  assets/
    backgrounds/
    foregrounds/
    text-images/
    icons/
  source/
    image2-screen.png
```

Current deterministic generator:

```bash
npm run generate:activity -- --prompt "<activity page request>" --out var/generated/my-page
```

Generate and submit a structured smoke-test package:

```bash
npm run generate:activity:submit -- --prompt "<activity page request>"
```

Attach a real image2 output:

```bash
npm run generate:activity -- --prompt "<activity page request>" --source-image /absolute/path/image2-screen.png --out var/generated/my-page
```

Parse a real image2 PNG into section background slices:

```bash
npm run parse:image -- --input /absolute/path/image2-screen.png --prompt "<activity page request>" --out var/generated/parsed-page
```

The parser output is a temporary scaffold only. It must not be submitted or imported until Codex recognition and image2 transparent cutout assets have been applied.

Prepare a direct Codex recognition workspace:

```bash
npm run recognize:prepare -- --package-dir var/generated/parsed-page --prompt "<activity page request>"
```

Recognition must be done by Codex directly, not through OpenAI API scripts.

For complex pages, prepare manual region constraints before recognition:

```bash
npm run annotate:prepare -- --package-dir var/generated/parsed-page
```

This creates `analysis/manual-annotations.json` and `analysis/manual-annotations.html`. Manual annotations are used to constrain recognition and package assembly. Supported roles include:

- `heroImage`: preserve the whole region as a complete visual image.
- `moduleBackground`: crop a meaningful background region.
- `tabGroup`: distinguish tab container, labels, separators, and selected state.
- `selectedTab`: force the selected state as a separate shape.
- `artText`: require image2 background removal into a transparent `textImage`.
- `foreground`: require image2 background removal into a transparent `foregroundImage`.
- `shape`: create an editable Figma shape.
- `text`: create editable text metadata.
- `ignore`: skip this region.

Apply recognition to `page.json`:

```bash
npm run apply:recognition -- --package-dir var/generated/parsed-page
```

Only submit to Figma after recognition has been applied. Baseline section slicing alone is not a finished reconstruction.

A valid production import must include element-level layers where possible: editable ordinary text, transparent art-text/image layers, foreground cutouts, and module background regions. Six coarse full-width background sections alone are an invalid final output for this workflow.

Validate before submitting:

```bash
npm run validate:page -- /absolute/path/to/page.json
```

The validator rejects flat full-canvas image imports, parser-only backgrounds, incomplete recognition, and under-layered outputs.

Important node types:

- `section`: absolute long-page visual block.
- `backgroundImage`: sliced background for a section or module.
- `foregroundImage`: product, mascot, decoration, or transparent cutout.
- `textImage`: art text preserved as a transparent asset.
- `editableText`: ordinary OCR/editable text.
- `shape`: simple Figma rectangle layer, useful for buttons/cards.
- `hotspot`: transparent clickable development annotation.

Manual annotations use this shape:

```json
{
  "version": "manual-annotations.v0.1",
  "sourceImage": "source/image2-screen.png",
  "canvas": { "width": 750, "height": 1600 },
  "regions": [
    {
      "id": "tab_group",
      "role": "tabGroup",
      "label": "Main tab group",
      "bbox": { "x": 24, "y": 720, "width": 702, "height": 88 },
      "instruction": "Separate tab background, selected state, and tab text.",
      "priority": "high"
    }
  ]
}
```

Minimum `page.json`:

```json
{
  "schemaVersion": "activity-page.v0.1",
  "name": "Campaign Page",
  "canvas": {
    "width": 750,
    "height": 1600,
    "background": "#FFFFFF",
    "sourceImage": "source/image2-screen.png"
  },
  "sections": [
    {
      "id": "hero",
      "type": "section",
      "x": 0,
      "y": 0,
      "width": 750,
      "height": 800,
      "children": []
    }
  ]
}
```

Generation policy:

- Treat the image2 screen as the visual source of truth.
- Prefer visual fidelity over app-style design-system normalization.
- Preserve complex campaign title art as `textImage`.
- If a top campaign visual is annotated as `heroImage`, preserve it as a complete image and do not split inner trophy/people/title art.
- Convert only stable ordinary copy to `editableText`.
- Slice backgrounds by section/module, not as one full-page background.
- For tab controls, separate tab background from selected state.
- Use image2 background removal for every transparent foreground cutout.
- Do not use local chroma-key removal, thresholding, OpenCV/Pillow matting, canvas masking, or other local background-removal algorithms for production cutouts.
- Use transparent PNG/WebP/SVG for foreground cutouts after image2 has removed the background.
- Keep coordinates in pixels and use absolute positioning.

Foreground asset metadata example:

```json
{
  "id": "product_01",
  "type": "foregroundImage",
  "asset": "assets/foregrounds/product-01.png",
  "sourceImage": "source/image2-screen.png",
  "extractionMethod": "image2-remove-background",
  "x": 120,
  "y": 420,
  "width": 260,
  "height": 260,
  "fit": "contain"
}
```
