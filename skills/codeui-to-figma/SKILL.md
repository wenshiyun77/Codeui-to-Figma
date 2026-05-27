---
name: codeui-to-figma
description: Generate or import image2-first campaign/activity landing pages into Figma through the local CodeUi-to-Figma Bridge. Use when the user asks to create an activity page, campaign page, promotion page, landing page, or visual UI page and send/import/rebuild it in Figma using the Bridge, page.json, assets, or the CodeUi-to-Figma workflow.
---

# CodeUi-to-Figma

## Overview

Use this skill to produce or submit an activity-page package to the local CodeUi-to-Figma Bridge. The Figma plugin polls `http://localhost:39217`, claims jobs, and reconstructs `page.json + assets/` into a Figma page.

This workflow is image2-first: the generated image is the visual source of truth, while `page.json` and assets are the structured reconstruction package.

Recognition is Codex-driven, not API-driven. Do not call the OpenAI API for recognition. Use the current Codex session's visual understanding directly, with the user-selected Codex model.

## Workflow

1. Confirm the local Bridge is available at `http://localhost:39217/health`.
2. If the Bridge is down and the bridge project is available, run `npm run bridge:install-service` once or start it with `npm run bridge`.
3. Ensure the user has the Figma plugin open and `Start polling` enabled.
4. Produce or locate the image2 source image for the activity page. The image2 image is the visual source of truth.
5. Parse the image2 PNG into a baseline package only as a temporary scaffold.
6. For complex pages, prepare or read `analysis/manual-annotations.json` first. Manual boxes and notes are higher-priority constraints than free recognition.
7. Use Codex vision directly to fill `analysis/recognition.json` and `analysis/remove-background-tasks.json`.
8. Use image2 background removal for every foreground or art-text transparent cutout listed by recognition or manual annotations.
9. Run `npm run handoff:continue -- --package-dir <package-dir>`. It applies recognition, prepares image2 cutout tasks when needed, validates the page, and submits to Bridge only when the package is complete.
10. Wait for the job result when the user expects Figma to update immediately.

Hard rule: never submit or import a parser-only baseline package as the final result. Baseline section slicing is blocked by the submit scripts and by the Figma plugin because it does not satisfy the element-layered reconstruction requirement.

Before submission, run:

```bash
npm run validate:page -- /absolute/path/to/page.json
```

The validator must pass. It rejects one full-page image layer, parser-only backgrounds, incomplete recognition, and recognition packages with too few semantic element layers.

## Creating A New Package

The deterministic generator is only for local development and smoke tests. It is not a replacement for image2 output.

When the bridge project is available, generate a development package with:

```bash
npm run generate:activity -- --prompt "<user request>" --out var/generated/my-page
```

For a smoke-test package, it can be submitted because it already contains structured sample layers:

```bash
npm run generate:activity:submit -- --prompt "<user request>"
```

This generator creates the standard package structure and is the current deterministic fallback. When true image2 output is available in the Codex session, use image2 as the visual source of truth and replace `source/image2-screen.*` plus the relevant sliced assets before submission.

If image2 has already produced a local image file, include it in the package:

```bash
npm run generate:activity -- --prompt "<user request>" --source-image /absolute/path/image2-screen.png --out var/generated/my-page
```

Then submit `var/generated/my-page/page.json`.

## Parsing A Real image2 PNG

When the user has a real image2 PNG and wants it rebuilt in Figma, use the parser:

```bash
npm run parse:image -- --input /absolute/path/image2-screen.png --prompt "<user request>" --out var/generated/parsed-page
```

Parser v0.1 slices the flat PNG into section background images and writes `activity-page.v0.1`. This is only a baseline package and must not be treated as a recognized reconstruction.

Do not submit this output directly. It must go through Codex recognition, image2 cutout generation, and `handoff:continue` first.

## Manual Annotation Constraints

For complex activity pages, prefer annotation-assisted recognition over model-only guessing:

```bash
npm run annotate:prepare -- --package-dir var/generated/parsed-page
```

This creates:

```text
analysis/manual-annotations.json
analysis/manual-annotations.html
```

Preferred daily workflow: use the Figma plugin's `标注工作台` tab. Drag in or choose the image2 UI image, draw boxes, set each layer card's name/type, fill the 备注 field, then click `保存并提交给 Codex`. The plugin normalizes the page to 750px width, creates a package under the Bridge data directory, and writes `analysis/manual-annotations.json` plus `analysis/codex-handoff.json` through the Bridge.

The standalone HTML helper is a fallback for debugging. Each region can include a role, bbox, label, instruction, priority, target asset, and optional style. Important roles:

- `heroImage`: keep the marked top/hero visual as one complete image. Do not split trophy, people, products, or rendered hero title art inside it unless the instruction explicitly asks for inner layers.
- `moduleBackground`: crop this region as a meaningful background layer.
- `tabGroup`: force the tab container, tab labels, separators, and selected state to be distinguished.
- `selectedTab`: create a separate selected-state shape.
- `button`: identify button background, text, icons, and state styling separately.
- `icon`: create a transparent icon asset with image2 background removal.
- `artText`: create a transparent `textImage` asset using image2 background removal.
- `foreground`: create a transparent `foregroundImage` asset using image2 background removal.
- `shape`: create an editable Figma shape when style is provided or clearly inferred.
- `text`: create editable text metadata.
- `ignore`: do not create layers from this region.

When annotations exist, recognition candidates should include `manualRegionId` when possible. Manual annotations are not optional hints; they are constraints for Codex recognition and package assembly. Read every region's `instruction`/备注 completely before recognizing that area, because it may describe exactly how to split multi-level elements inside the box.

Manual boxes are not final cut instructions. They constrain recognition. Local code may crop ordinary rectangular backgrounds, but transparent `artText`, `icon`, and `foreground` assets must be produced by image2 background removal.

When a handoff includes `recognitionWorkflow`, follow its order strictly: normalize the page to 750px width, detect the full-page base color for the Figma root frame, remove phone status/safe-area bars, recognize editable text first, separate tabs/buttons/icons/art/foreground assets with image2 background removal, preserve the hero image by default, then finish module backgrounds.

The visual annotation helper is a Chinese UI. It supports drawing, selecting, dragging, corner resizing, exact numeric coordinates, region roles, target assets, instructions, optional shape style, duplicate/delete, up/down ordering, JSON import/export, and structure warnings. Use this helper for complex pages before relying on free-form model recognition.

## Codex Recognition

For semantic recognition, prepare a Codex recognition workspace:

```bash
npm run recognize:prepare -- --package-dir var/generated/parsed-page --prompt "<user request>"
```

Or with a direct image:

```bash
npm run recognize:prepare -- --input /absolute/path/image2-screen.png --prompt "<user request>"
```

Then use Codex vision directly on the image and fill:

```text
analysis/recognition.json
analysis/remove-background-tasks.json
```

Recognition must enumerate the visible UI elements, not only sections. At minimum, identify ordinary editable text, art text that should become transparent `textImage` assets, foreground objects/decorations/icons that need image2 background removal, and module-level background areas that should remain as backgrounds.

If the user says the top image should stay whole, mark it as `heroImage` and do not create foreground cutout tasks for trophy/players/title inside it.

Also identify simple rectangular UI as `shapeCandidates`: panels, ranking rows, tabs, buttons, card backgrounds, pill controls, and separators. These should become editable Figma rectangles instead of being left only inside background bitmaps.

For tab controls, always distinguish the tab group background from the selected state. If a `tabGroup` or `selectedTab` annotation exists, make sure the selected state becomes its own shape layer.

After Codex fills recognition files, continue the package:

```bash
npm run handoff:continue -- --package-dir var/generated/parsed-page
```

If `handoff:continue` reports `waiting_for_image2_cutouts`, finish those image2 background-removal assets first and rerun the same command. Submission is blocked until recognition is complete.

Do not call OpenAI API from scripts. The required recognition model is controlled by the Codex client/session. If the user requires `gpt-5.5`, verify the Codex session is actually using `gpt-5.5`; if it is not, stop and ask the user to switch models. Code cannot force the Codex runtime model.

## Background Removal Policy

Use image2 background removal for all transparent foreground cutouts. Do not use local chroma-key removal, thresholding, OpenCV/Pillow matting, canvas masking, or hand-written background-removal code for production foreground assets.

For products, mascots, people, decorations, and art elements that need alpha:

1. Use image2 to remove the background from the selected source region or generated asset.
2. Save the clean transparent PNG/WebP under `assets/foregrounds/` or `assets/text-images/`.
3. Mark the asset node with `extractionMethod: "image2-remove-background"` when practical.
4. Use local code only to place assets, crop rectangular backgrounds, copy files, and assemble `page.json`.

## Bridge Project Location

Prefer these locations in order:

1. The current workspace if it contains `packages/bridge/src/server.mjs`.
2. `ACTIVITY_FIGMA_BRIDGE_HOME` if the environment variable is set.
3. Ask the user for the local bridge project folder.

Do not assume a hardcoded user path.

## Package Contract

Read `references/activity-page-contract.md` when creating or validating `page.json`.

Use `activity-page.v0.1` and keep coordinates in pixels. For campaign pages, favor section/module slicing, transparent foreground assets, editable ordinary text, and image layers for complex art text.

## Submitting To Figma

From the skill folder:

```bash
python3 scripts/submit_activity_page.py /absolute/path/to/page.json --wait
```

If running from another directory, use the script's absolute path.

The script defaults to:

```text
http://localhost:39217
```

Use `--assets-root` only when the assets root is not the parent directory of `page.json`.

The submit script refuses parser-only baseline packages and incomplete recognition packages. This is intentional; a Figma import that only contains six section backgrounds is a failed reconstruction for this workflow.

If an import job remains queued, verify the Figma plugin window is open with `Start polling` enabled. If stale jobs exist, run `npm run reset:bridge` before submitting again.

## Expected Success Signal

The plugin log should show:

```text
Claimed job_xxx
job_xxx completed
No queued job
```

`No queued job` after completion is normal. It means the plugin is polling and waiting for the next task.

## Failure Handling

- If submission fails with connection refused, start or install the Bridge service.
- If the job stays `queued`, ask the user to open the Figma plugin and click `Start polling`.
- If the plugin reports `failed`, inspect the job error and fix `page.json` or asset paths.
- If assets do not render, verify paths are relative to the package root and that files are readable.
