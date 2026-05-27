# CodeUi-to-Figma

CodeUi-to-Figma is a local Codex + Bridge + Figma plugin workflow for turning image2-generated campaign/activity page visuals into layered Figma pages.

目标是把 AI 生成的静态活动页 UI 转成 Figma 页面，并产出完整标注信息和切图素材，供设计师和前端开发落地使用。

It currently includes:

- A local Bridge server on `http://localhost:39217`.
- A Figma plugin named `CodeUi-to-Figma` with import polling and a built-in Chinese annotation workbench.
- A Codex skill named `codeui-to-figma` for recognition, image2 cutout planning, validation, and Figma submission.
- A `page.json` scene graph contract for long-form activity pages.
- Bridge/setup documentation for team handoff.

## Recommended Team Rollout

Detailed bridge steps are documented in [docs/bridge-workflow.zh-CN.md](docs/bridge-workflow.zh-CN.md).

The current shareable package is:

```text
this project folder
+ Node.js on each Mac
+ Figma Desktop
+ one-time Bridge service install
+ one-time Figma development plugin import
```

For a more polished internal release, the next packaging step should be:

```text
macOS companion app or signed installer
+ private/team Figma plugin
+ Codex skill workflow
```

That removes most local setup friction. Figma still cannot start local processes by itself, so a local companion service is required on every teammate's machine.

## First-Time Setup

From the project folder:

```bash
npm run doctor
npm run bridge:install-service
npm run skill:install
```

Then import this manifest in Figma Desktop:

```text
packages/plugin/manifest.json
```

Run `CodeUi-to-Figma`, keep the Bridge URL as `http://localhost:39217`, and use `导入轮询` / `标注工作台`.

The Codex skill source is stored in:

```text
skills/codeui-to-figma
```

`npm run skill:install` copies it into:

```text
~/.codex/skills/codeui-to-figma
```

After installing the skill, restart Codex or start a new thread if the skill list was already loaded.

## No-Terminal Daily Setup

For normal use, install the Bridge as a macOS background service once:

```bash
npm run bridge:install-service
```

After that, the Bridge starts automatically when you log in. You only need to open the Figma plugin.

To uninstall the background service:

```bash
npm run bridge:uninstall-service
```

Logs are written to:

```text
~/Library/Logs/CodeUi-to-Figma/bridge.out.log
~/Library/Logs/CodeUi-to-Figma/bridge.err.log
```

The background service keeps its job queue outside the repository at:

```text
~/Library/Application Support/CodeUi-to-Figma/bridge
```

## Manual Development Run

```bash
npm run bridge
```

You can also double-click:

```text
scripts/macos/start-bridge.command
```

## Load the Figma Plugin

In Figma Desktop:

1. Open `Plugins > Development > Import plugin from manifest...`.
2. Select `packages/plugin/manifest.json`.
3. Run `CodeUi-to-Figma`.
4. Keep the Bridge URL as `http://localhost:39217`.
5. Use `导入轮询` to receive finished import jobs.
6. Use `标注工作台` to drag in or choose a UI image, draw annotation boxes, write Chinese instructions in the layer cards, and click `保存并提交给 Codex`.

The `标注工作台` tab is the preferred daily entry. It creates the package and Codex handoff from the uploaded image, so most users no longer need to paste a package directory or manually open `analysis/manual-annotations.html`.

## Submit the Sample Page

In another terminal:

```bash
npm run submit:sample
```

The plugin should create a new Figma page from `samples/activity-page/page.json`.

In the final workflow, Codex will submit generated `page.json + assets/` jobs directly, so this sample command is mainly for local testing.

## Validate Before Import

Every production package must pass the local quality gate before it can be submitted:

```bash
npm run validate:page -- var/generated/qixi-parsed/page.json
```

The validator rejects:

- one full-canvas PNG/JPG as a single `image` layer
- parser-only background slices with no semantic layers
- incomplete recognition with pending image2 transparent assets
- recognition output with too few element layers

This is the guardrail that prevents the failed “single long image” or “six section backgrounds” import from being treated as success.

Run the quality regression suite with:

```bash
npm run test:quality
```

## Generate A New Activity Page Package

The deterministic generator is a development/smoke-test path. Production activity pages should start from the image2 output image and then go through Codex recognition before Figma import.

Generate only:

```bash
npm run generate:activity -- --prompt "七夕珠宝品牌活动页" --out var/generated/qixi
```

Attach an image2 output as the visual source:

```bash
npm run generate:activity -- --prompt "七夕珠宝品牌活动页" --source-image /absolute/path/image2-screen.png --out var/generated/qixi
```

Generate and submit a structured smoke-test package to Figma:

```bash
npm run generate:activity:submit -- --prompt "七夕珠宝品牌活动页"
```

The current generator creates a deterministic structured package:

```text
page.json
assets/backgrounds/
assets/foregrounds/
assets/text-images/
source/image2-screen.svg
```

For production image2 fidelity, Codex should use the real image2 output as the source of truth, run recognition, create image2 transparent cutout assets, and submit only after recognition is complete.

## Parse A Real image2 PNG

Parse a flat PNG into section background slices and `page.json`:

```bash
npm run parse:image -- --input /absolute/path/image2-screen.png --prompt "七夕珠宝品牌活动页" --out var/generated/qixi-parsed
```

Parser v0.1 supports PNG input and section background slicing. This is only a baseline package, not a finished reconstruction.

This baseline package is intentionally blocked from submission/import. If it only contains `section_01_bg`, `section_02_bg`, etc., it has not satisfied the element-layering requirement yet.

Foreground cutouts must use image2 background removal. The local parser should not do chroma-key removal, threshold matting, OpenCV/Pillow matting, canvas masking, or other local background-removal algorithms for production assets. Local code should only organize the resulting transparent image2 assets into `assets/foregrounds/` and reference them from `page.json`.

## Prepare Codex Recognition

For complex pages, create manual region constraints before recognition. The preferred path is inside the Figma plugin:

1. Open `CodeUi-to-Figma`.
2. Switch to `标注工作台`.
3. Drag a PNG/JPG/WebP UI image into the canvas, or click `添加 UI 图`.
4. The workbench records all coordinates in a normalized 750px-wide page coordinate system.
5. Click `添加框选区域`, draw boxes, set each card's name/type, and fill the remark field.
6. Click `保存并提交给 Codex`.

The handoff tells Codex to process the page in this order: normalize to 750px width, detect the full-page base color, remove phone system bars, recognize text first, separate Tab/button/icon/art/foreground assets with image2 background removal, preserve the hero image by default, then finish module backgrounds.

The legacy standalone helper is still available for fallback:

```bash
npm run annotate:prepare -- --package-dir var/generated/qixi-parsed
```

The plugin path creates a package under the Bridge data directory and writes:

```text
page.json
source/image2-screen.*
analysis/manual-annotations.json
analysis/codex-handoff.json
analysis/codex-handoff.md
```

Both the Figma plugin workbench and the HTML helper save `analysis/manual-annotations.json` and create `analysis/codex-handoff.json` / `.md` with `保存并交给 Codex`, so the Codex session can read the constraints and perform recognition. `下载 JSON` is only a fallback export.

Manual boxes are recognition constraints, not final cut rules. They tell Codex where to inspect and what the region means; they do not authorize the browser or Bridge to fake semantic recognition. The region `instruction`/备注 field is mandatory context: Codex must read it completely because it may describe multi-layer handling inside the selected area. Ordinary rectangular backgrounds can be cropped locally, but every transparent `artText` or `foreground` PNG must come from image2 background removal.

These annotations let you explicitly mark regions such as:

- `heroImage`: preserve the whole top visual as one complete image
- `moduleBackground`: crop a meaningful area background
- `tabGroup`: force tab container, tab labels, and selected state separation
- `selectedTab`: force selected tab state as its own shape
- `button`: require a button shape/background and text/icon contents to be recognized separately
- `icon`: require an image2 transparent icon asset and exact placement
- `artText`: require an image2 transparent text-image asset
- `foreground`: require an image2 transparent foreground asset

Manual annotations are treated as higher-priority constraints than model-only guessing.

The annotation helper is a Chinese UI and supports:

- drawing new regions on the source image
- selecting existing regions from the canvas or list
- dragging regions to move them
- resizing selected regions from corner handles
- precise numeric x/y/width/height edits
- region role, priority, target asset, instruction, and optional shape style fields
- duplicate, delete, reorder up/down, JSON import, JSON copy/download, and built-in structure warnings

Recognition is performed by Codex directly, not by an OpenAI API script or the annotation web page:

```bash
npm run recognize:prepare -- --package-dir var/generated/qixi-parsed --prompt "七夕珠宝品牌活动页"
```

This writes:

```text
analysis/codex-recognition-prompt.md
analysis/manual-annotations.json
analysis/recognition.json
analysis/remove-background-tasks.json
```

Then Codex uses the current session model to inspect the image and fill those JSON files. If your workflow requires `gpt-5.5`, select `gpt-5.5` in the Codex client/session before running recognition; this repository cannot force the Codex runtime model from code.

Recognition must list the visible page elements, not only long background slices:

- ordinary text as `editableText`
- complex title/art text as transparent `textImage` assets
- icons, awards, people, products, decorations, and other foreground objects as image2 background-removal tasks
- module-level background regions that should stay as background slices
- tab group backgrounds and selected tab states as separate shapes when annotated

After Codex fills recognition files, apply them back into `page.json`:

```bash
npm run apply:recognition -- --package-dir var/generated/qixi-parsed
```

If `apply:recognition` reports pending text-image or foreground assets, create those clean transparent assets with image2 background removal and rerun the command. Submission remains blocked until `metadata.recognitionComplete` is `true`.

Then submit the recognized package:

```bash
python3 skills/codeui-to-figma/scripts/submit_activity_page.py var/generated/qixi-parsed/page.json --wait
```

## Reset Local Jobs

```bash
npm run reset:bridge
```

When the Bridge service is running, this command now clears the live in-memory queue through the Bridge reset API. If the Bridge is stopped, it falls back to removing the local `jobs.json` file from `BRIDGE_DATA_DIR`, or `var/bridge/jobs.json` when that environment variable is not set.

## Current Scope

This MVP can scaffold a package from a flat image2 PNG, but semantic element layering is Codex-driven and must happen before Figma import. The intended pipeline is:

```text
image2 screen.png
  -> parser produces temporary section scaffold
  -> Codex recognition produces text/object/module annotations
  -> image2 background removal produces clean transparent cutouts
  -> apply recognition writes layered page.json + assets
  -> Bridge submits import job
  -> Figma plugin reconstructs the page
  -> exported Figma screenshot is compared against image2 screen.png
```

The first target is activity landing pages, not app design systems. That means absolute layout, visual sections, clean cut assets, editable ordinary text, and preserved art text are favored over tokenized components.
