# CodeUi to Figma Architecture

CodeUi to Figma is an image2 activity-page-to-Figma bridge built from three cooperating pieces:

- Codex skill: drives recognition, validates `page.json`, plans image2 cutouts, and submits Bridge jobs.
- Local Bridge: stores packages, annotations, handoff files, assets, and Figma import jobs.
- Figma plugin: provides the built-in annotation workbench and executes queued Figma reconstruction jobs.

The first milestone does not implement image generation or visual parsing. It defines the execution contract that those later stages will use.

```text
image2 output + parser
  -> page.json + assets/
  -> Figma plugin annotation workbench
  -> Codex recognition + image2 cutout tasks
  -> Bridge job queue
  -> Figma plugin import executor
  -> Figma page reconstruction
  -> result metadata
```

## Contracts

`page.json` is the design source for the Figma importer. The Figma plugin should not infer page intent. It should only execute the structured scene graph.

The current schema is `activity-page.v0.1`:

- `canvas`: page size, background, optional source image reference.
- `sections`: absolute-positioned long-page visual blocks.
- `backgroundImage`: section or module background slices.
- `foregroundImage`: products, mascots, decorations, cutouts.
- `textImage`: art text preserved as clean transparent assets.
- `editableText`: text reconstructed as editable Figma text.
- `shape`: simple rectangles, buttons, cards, masks.
- `hotspot`: transparent click regions for development annotation.

## Principle

For campaign pages, visual fidelity is the first priority. Editability is layered in where the parser can extract stable text or shapes. Complex title art should stay as transparent cut assets instead of being forced into ordinary text.
