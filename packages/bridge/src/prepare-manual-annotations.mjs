import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { decodePng } from "./png-utils.mjs";

const args = process.argv.slice(2);
const packageDir = resolve(getRequiredArg("--package-dir", "Missing --package-dir"));
const outputDir = resolve(getArg("--out") || `${packageDir}/analysis`);
const annotationsPath = resolve(getArg("--annotations") || `${outputDir}/manual-annotations.json`);
const shouldForce = args.includes("--force");
const shouldSeedFromSections = args.includes("--from-sections");

const pagePath = resolve(packageDir, "page.json");
const page = JSON.parse(await readFile(pagePath, "utf8"));
const sourceImage = resolvePackageSourceImage(page, packageDir);
const image = decodePng(await readFile(sourceImage));

await mkdir(outputDir, { recursive: true });

let annotations;
if (!shouldForce && await fileExists(annotationsPath)) {
  annotations = JSON.parse(await readFile(annotationsPath, "utf8"));
} else {
  annotations = buildInitialAnnotations({ page, sourceImage, image, seedFromSections: shouldSeedFromSections });
  await writeFile(annotationsPath, JSON.stringify(annotations, null, 2));
}

const htmlPath = resolve(outputDir, "manual-annotations.html");
await writeFile(htmlPath, buildAnnotatorHtml({
  annotations,
  annotationsFile: basename(annotationsPath),
  imagePath: toPosix(relative(outputDir, sourceImage)),
  packageDir,
  pagePath
}));

console.log(`人工标注 JSON: ${annotationsPath}`);
console.log(`人工标注工作台: ${htmlPath}`);

function buildInitialAnnotations({ page: pageDocument, sourceImage: absoluteSourceImage, image: imageData, seedFromSections }) {
  const regions = [];
  if (seedFromSections) {
    for (const section of pageDocument.sections || []) {
      regions.push({
        id: section.id,
        role: "moduleBackground",
        label: section.name || section.id,
        bbox: {
          x: numberOr(section.x, 0),
          y: numberOr(section.y, 0),
          width: numberOr(section.width, imageData.width),
          height: numberOr(section.height, 300)
        },
        instruction: "检查这个粗略切片。如果它包含多个逻辑模块，请拆分或重命名。",
        priority: "normal"
      });
    }
  }

  return {
    version: "manual-annotations.v0.1",
    sourceImage: toPackageRelativeSource(absoluteSourceImage, packageDir),
    canvas: {
      width: imageData.width,
      height: imageData.height
    },
    regions,
    roleGuide: {
      heroImage: "完整保留这一块视觉图，不拆人物、产品或头图艺术字。",
      moduleBackground: "把这一块裁成有业务意义的区域/模块背景。",
      tabGroup: "识别 Tab 容器背景、每个 Tab 文本、分割线和状态。",
      selectedTab: "把选中态单独做成可编辑形状层。",
      artText: "使用 image2 去背景，输出透明底艺术字图层。",
      shape: "当样式明确时创建可编辑 Figma 矩形/圆角形状。",
      text: "创建可编辑文本，并补字体、字号、字重、颜色和坐标。",
      foreground: "使用 image2 去背景，输出透明底前景素材。",
      ignore: "忽略这个区域，不生成图层。"
    }
  };
}

function buildAnnotatorHtml({ annotations, annotationsFile, imagePath, packageDir: rootDir, pagePath: targetPagePath }) {
  const data = escapeScriptJson(JSON.stringify(annotations, null, 2));
  const packageDirJson = escapeScriptJson(JSON.stringify(rootDir));
  const handoffInstruction = "回到 Codex 对话输入：继续识别这个标注 handoff";
  const applyCommand = `npm run apply:recognition -- --package-dir "${rootDir}"`;
  const validateCommand = `npm run validate:page -- "${targetPagePath}"`;
  const submitCommand = `node packages/bridge/src/submit-page.mjs "${targetPagePath}"`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>活动页人工标注工作台</title>
  <style>
    :root { color-scheme: light; --line: #d9d9df; --muted: #6b7280; --blue: #1677ff; --danger: #b42318; --panel: #ffffff; --ink: #1f2328; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; background: #f5f5f7; color: var(--ink); }
    button, input, select, textarea { font: inherit; }
    button { border: 0; border-radius: 8px; padding: 9px 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 8px 9px; background: #fff; color: var(--ink); }
    textarea { min-height: 72px; resize: vertical; line-height: 1.45; }
    label { display: block; margin: 10px 0 5px; font-size: 12px; color: #565f6b; font-weight: 700; }
    .topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.94); backdrop-filter: blur(10px); }
    .title { display: flex; flex-direction: column; gap: 2px; }
    .title h1 { margin: 0; font-size: 18px; }
    .title span { font-size: 12px; color: var(--muted); }
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .app { display: grid; grid-template-columns: minmax(460px, 1fr) 440px; gap: 16px; padding: 16px; align-items: start; }
    .viewport { max-height: calc(100vh - 88px); overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #e9e9ed; padding: 18px; }
    .stage { position: relative; width: fit-content; background: white; box-shadow: 0 10px 34px rgba(0,0,0,.16); transform-origin: top left; }
    img { display: block; user-select: none; pointer-events: none; }
    canvas { position: absolute; inset: 0; cursor: crosshair; touch-action: none; }
    aside { position: sticky; top: 72px; max-height: calc(100vh - 88px); overflow: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
    .hint { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: #4b5563; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    .actions.three { grid-template-columns: 1fr 1fr 1fr; }
    .primary { background: var(--blue); color: white; }
    .secondary { background: #eef0f3; color: #1f2328; }
    .danger { background: #fee4e2; color: var(--danger); }
    .ghost { background: transparent; color: #344054; border: 1px solid var(--line); }
    .sectionTitle { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 14px; border-top: 1px solid #ececf0; }
    .sectionTitle h2 { margin: 0; font-size: 15px; }
    .count { color: var(--muted); font-size: 12px; }
    .region { border: 1px solid #ececf0; border-radius: 8px; padding: 9px; margin-top: 8px; cursor: pointer; background: #fff; }
    .region.active { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(22,119,255,.14); }
    .regionTop { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .region b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { margin-top: 4px; font-size: 12px; color: #667085; line-height: 1.45; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 7px; color: white; font-size: 11px; font-weight: 700; flex: 0 0 auto; }
    .warnings { display: grid; gap: 7px; margin-top: 10px; }
    .warning { border-radius: 8px; padding: 8px; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; font-size: 12px; line-height: 1.45; }
    .ok { border-radius: 8px; padding: 8px; background: #ecfdf3; color: #067647; border: 1px solid #abefc6; font-size: 12px; line-height: 1.45; }
    .cmd { white-space: pre-wrap; word-break: break-word; background: #18181b; color: #fafafa; border-radius: 8px; padding: 10px; font-size: 11px; line-height: 1.45; }
    pre { white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto; background: #18181b; color: #fafafa; padding: 10px; border-radius: 8px; font-size: 11px; line-height: 1.45; }
    .fileInput { padding: 8px; border: 1px dashed var(--line); border-radius: 8px; background: #fafafa; }
    .small { font-size: 12px; color: var(--muted); line-height: 1.45; }
    @media (max-width: 980px) {
      .app { grid-template-columns: 1fr; }
      aside { position: static; max-height: none; }
      .viewport { max-height: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="title">
      <h1>活动页人工标注工作台</h1>
      <span>先框选关键区域，再把约束交给 Codex 识别；网页不做模型识别或透明素材抠图。</span>
    </div>
    <div class="toolbar">
      <button class="ghost" id="fit">适配宽度</button>
      <button class="ghost" id="zoomOut">缩小</button>
      <strong id="zoomText">100%</strong>
      <button class="ghost" id="zoomIn">放大</button>
      <button class="secondary" id="copyJsonTop">复制 JSON</button>
      <button class="secondary" id="saveBridgeTop">保存标注</button>
      <button class="primary" id="handoffTop">保存并交给 Codex</button>
    </div>
  </header>
  <div class="app">
    <div class="viewport" id="viewport">
      <div class="stage" id="stage">
        <img id="source" src="${escapeHtml(imagePath)}" alt="活动页源图">
        <canvas id="overlay"></canvas>
      </div>
    </div>
    <aside>
      <p class="hint">操作顺序：拖拽画框，选择区域类型，填写备注，点击“新增/更新区域”。框选只是给 Codex 模型的识别约束；普通区域背景可以矩形裁切，艺术字和前景素材必须走 image2 去背景生成透明 PNG。</p>
      <div class="row">
        <div>
          <label for="role">区域类型</label>
          <select id="role">
            <option value="moduleBackground">区域背景</option>
            <option value="heroImage">完整头图</option>
            <option value="tabGroup">Tab 组背景</option>
            <option value="selectedTab">选中 Tab 状态</option>
            <option value="artText">艺术字切图</option>
            <option value="foreground">前景素材切图</option>
            <option value="shape">可编辑形状</option>
            <option value="text">可编辑文本</option>
            <option value="ignore">忽略区域</option>
          </select>
        </div>
        <div>
          <label for="priority">优先级</label>
          <select id="priority">
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="id">区域 ID</label>
          <input id="id" placeholder="例如 hero_full">
        </div>
        <div>
          <label for="label">中文名称</label>
          <input id="label" placeholder="例如 完整头图">
        </div>
      </div>
      <label>坐标和尺寸（源图像素）</label>
      <div class="row4">
        <input id="x" type="number" placeholder="x">
        <input id="y" type="number" placeholder="y">
        <input id="width" type="number" placeholder="宽">
        <input id="height" type="number" placeholder="高">
      </div>
      <label for="targetAsset">目标素材路径</label>
      <input id="targetAsset" placeholder="例如 assets/backgrounds/hero-full.png">
      <label for="instruction">给 Codex 的备注</label>
      <textarea id="instruction" placeholder="说明这个区域怎么处理，例如：头图完整保留，不拆奖杯和人物。"></textarea>
      <div class="sectionTitle"><h2>形状样式（可选）</h2><span class="small">Tab/按钮/卡片常用</span></div>
      <div class="row3">
        <div><label for="fill">填充色</label><input id="fill" placeholder="#073C20"></div>
        <div><label for="opacity">透明度</label><input id="opacity" type="number" step="0.01" min="0" max="1" placeholder="0.8"></div>
        <div><label for="cornerRadius">圆角</label><input id="cornerRadius" type="number" min="0" placeholder="12"></div>
      </div>
      <div class="row3">
        <div><label for="stroke">描边色</label><input id="stroke" placeholder="#F6D75B"></div>
        <div><label for="strokeOpacity">描边透明度</label><input id="strokeOpacity" type="number" step="0.01" min="0" max="1" placeholder="0.9"></div>
        <div><label for="strokeWeight">描边宽度</label><input id="strokeWeight" type="number" min="0" placeholder="2"></div>
      </div>
      <div class="actions">
        <button class="primary" id="saveRegion">新增/更新区域</button>
        <button class="secondary" id="newRegion">清空表单</button>
        <button class="danger" id="deleteRegion">删除选中</button>
        <button class="secondary" id="duplicateRegion">复制选中</button>
      </div>
      <div class="actions">
        <button class="secondary" id="moveUp">选中区域上移</button>
        <button class="secondary" id="moveDown">选中区域下移</button>
      </div>
      <div class="sectionTitle"><h2>标注检查</h2><span class="count" id="summary"></span></div>
      <div id="warnings" class="warnings"></div>
      <div class="sectionTitle"><h2>区域列表</h2><span class="count" id="regionCount"></span></div>
      <div id="regions"></div>
      <div class="sectionTitle"><h2>导入/导出</h2></div>
      <label for="importFile">导入已有 JSON</label>
      <input class="fileInput" id="importFile" type="file" accept="application/json,.json">
      <div class="actions three">
        <button class="secondary" id="copy">复制 JSON</button>
        <button class="primary" id="export">下载 JSON</button>
        <button class="secondary" id="saveBridge">保存标注</button>
      </div>
      <div class="actions">
        <button class="primary" id="handoff">保存并交给 Codex</button>
        <button class="secondary" id="copyCommands">复制后续命令</button>
      </div>
      <p class="small">推荐使用“保存并交给 Codex”。它会把标注写回本地 JSON，并生成 codex-handoff.json / .md。回到 Codex 后输入继续，Codex 会读取 handoff 执行元素分离、文字识别和 image2 去背景任务规划。下载 JSON 只是兜底导出。</p>
      <div id="bridgeStatus" class="small"></div>
      <div class="cmd" id="commands">${escapeHtml(handoffInstruction)}\n${escapeHtml(applyCommand)}\n${escapeHtml(validateCommand)}\n${escapeHtml(submitCommand)}</div>
      <div class="sectionTitle"><h2>JSON 预览</h2></div>
      <pre id="json"></pre>
    </aside>
  </div>
  <script>
    let data = ${data};
    const packageDir = ${packageDirJson};
    const bridgeUrl = 'http://localhost:39217';
    const roleLabels = {
      heroImage: '完整头图',
      moduleBackground: '区域背景',
      tabGroup: 'Tab 组背景',
      selectedTab: '选中 Tab 状态',
      artText: '艺术字切图',
      foreground: '前景素材切图',
      shape: '可编辑形状',
      text: '可编辑文本',
      ignore: '忽略区域'
    };
    const roleColors = {
      heroImage: '#ef4444',
      moduleBackground: '#1677ff',
      tabGroup: '#7c3aed',
      selectedTab: '#22c55e',
      artText: '#f97316',
      foreground: '#eab308',
      shape: '#14b8a6',
      text: '#0ea5e9',
      ignore: '#6b7280'
    };
    const img = document.getElementById('source');
    const canvas = document.getElementById('overlay');
    const ctx = canvas.getContext('2d');
    const stage = document.getElementById('stage');
    const viewport = document.getElementById('viewport');
    const regionsNode = document.getElementById('regions');
    const jsonNode = document.getElementById('json');
    const warningsNode = document.getElementById('warnings');
    const summaryNode = document.getElementById('summary');
    const regionCountNode = document.getElementById('regionCount');
    const zoomText = document.getElementById('zoomText');
    const bridgeStatus = document.getElementById('bridgeStatus');
    let draft = null;
    let start = null;
    let selectedIndex = -1;
    let dragMode = null;
    let dragHandle = null;
    let dragOrigin = null;
    let originalBox = null;
    let zoom = 1;

    img.addEventListener('load', () => {
      fitToWidth();
      render();
    });
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousedown', event => {
      const point = pointer(event);
      const handle = hitHandle(point);
      const hitIndex = handle ? selectedIndex : hitRegion(point);
      if (handle && selectedIndex >= 0) {
        dragMode = 'resize';
        dragHandle = handle;
        dragOrigin = point;
        originalBox = cloneBox(data.regions[selectedIndex].bbox);
      } else if (hitIndex >= 0) {
        selectedIndex = hitIndex;
        loadRegionToForm(data.regions[selectedIndex]);
        dragMode = 'move';
        dragOrigin = point;
        originalBox = cloneBox(data.regions[selectedIndex].bbox);
      } else {
        selectedIndex = -1;
        clearForm(false);
        start = point;
        dragMode = 'draw';
        draft = { x: point.x, y: point.y, width: 0, height: 0 };
      }
      draw();
    });
    canvas.addEventListener('mousemove', event => {
      const point = pointer(event);
      updateCursor(point);
      if (dragMode === 'draw' && start) {
        draft = normalizeRect(start.x, start.y, point.x, point.y);
        writeBboxToForm(draft);
      } else if (dragMode === 'move' && selectedIndex >= 0) {
        const dx = point.x - dragOrigin.x;
        const dy = point.y - dragOrigin.y;
        data.regions[selectedIndex].bbox = clampBox({
          x: originalBox.x + dx,
          y: originalBox.y + dy,
          width: originalBox.width,
          height: originalBox.height
        });
        writeBboxToForm(data.regions[selectedIndex].bbox);
      } else if (dragMode === 'resize' && selectedIndex >= 0) {
        data.regions[selectedIndex].bbox = resizeBox(originalBox, dragHandle, point);
        writeBboxToForm(data.regions[selectedIndex].bbox);
      }
      draw();
    });
    window.addEventListener('mouseup', () => {
      if (dragMode === 'draw' && draft) {
        writeBboxToForm(draft);
      }
      start = null;
      dragMode = null;
      dragHandle = null;
      dragOrigin = null;
      originalBox = null;
      render();
    });

    document.getElementById('saveRegion').onclick = () => {
      upsertFormRegion();
    };
    document.getElementById('newRegion').onclick = () => {
      selectedIndex = -1;
      draft = null;
      clearForm(true);
      render();
    };
    document.getElementById('deleteRegion').onclick = () => {
      if (selectedIndex < 0) return;
      data.regions.splice(selectedIndex, 1);
      selectedIndex = -1;
      draft = null;
      clearForm(true);
      render();
    };
    document.getElementById('duplicateRegion').onclick = () => {
      if (selectedIndex < 0) return;
      const source = JSON.parse(JSON.stringify(data.regions[selectedIndex]));
      source.id = nextRegionId(source.id + '_copy');
      source.label = (source.label || source.id) + ' 副本';
      source.bbox.x = Math.min(data.canvas.width - source.bbox.width, source.bbox.x + 12);
      source.bbox.y = Math.min(data.canvas.height - source.bbox.height, source.bbox.y + 12);
      data.regions.push(source);
      selectedIndex = data.regions.length - 1;
      loadRegionToForm(source);
      render();
    };
    document.getElementById('moveUp').onclick = () => moveSelected(-1);
    document.getElementById('moveDown').onclick = () => moveSelected(1);
    document.getElementById('copy').onclick = copyJson;
    document.getElementById('copyJsonTop').onclick = copyJson;
    document.getElementById('export').onclick = downloadJson;
    document.getElementById('saveBridge').onclick = saveToBridge;
    document.getElementById('saveBridgeTop').onclick = saveToBridge;
    document.getElementById('handoff').onclick = createHandoff;
    document.getElementById('handoffTop').onclick = createHandoff;
    document.getElementById('copyCommands').onclick = async () => {
      await copyText(document.getElementById('commands').textContent);
      alert('已复制后续命令。');
    };
    document.getElementById('importFile').onchange = async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported.regions)) {
        alert('这个 JSON 不是 manual-annotations 格式。');
        return;
      }
      data = imported;
      selectedIndex = -1;
      draft = null;
      clearForm(true);
      render();
    };
    document.getElementById('zoomIn').onclick = () => setZoom(zoom + 0.1);
    document.getElementById('zoomOut').onclick = () => setZoom(zoom - 0.1);
    document.getElementById('fit').onclick = fitToWidth;

    function upsertFormRegion() {
      const bbox = readBboxFromForm();
      if (!bbox || bbox.width < 4 || bbox.height < 4) {
        alert('请先框选区域，或填写有效的 x/y/宽/高。');
        return false;
      }
      const id = document.getElementById('id').value.trim() || nextRegionId();
      const region = cleanRegion({
        id,
        role: document.getElementById('role').value,
        label: document.getElementById('label').value.trim() || id,
        bbox,
        instruction: document.getElementById('instruction').value.trim(),
        priority: document.getElementById('priority').value,
        targetAsset: document.getElementById('targetAsset').value.trim(),
        style: readStyleFromForm()
      });
      draft = null;
      if (selectedIndex >= 0) {
        data.regions[selectedIndex] = region;
      } else {
        data.regions.push(region);
        selectedIndex = data.regions.length - 1;
      }
      render();
      return true;
    }

    function downloadJson() {
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = '${escapeJs(annotationsFile)}';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 1000);
        setStatus('已触发 JSON 下载。如果浏览器拦截下载，请使用“保存标注”或“复制 JSON”。', 'ok');
      } catch (error) {
        setStatus('下载失败：' + error.message + '。请使用“复制 JSON”。', 'error');
      }
    }
    async function copyJson() {
      await copyText(JSON.stringify(data, null, 2));
      alert('已复制标注 JSON。');
    }
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        window.prompt('复制失败，请手动复制：', text);
      }
    }
    async function saveToBridge() {
      syncSelectedFormIfUseful();
      setStatus('正在保存标注到本地文件...', 'pending');
      const result = await postBridge('/api/figma-bridge/annotations/save', {
        packageDir,
        annotations: data
      });
      setStatus('已保存：' + result.annotationsPath + '（' + result.regionCount + ' 个区域）', 'ok');
      return result;
    }
    async function createHandoff() {
      syncSelectedFormIfUseful();
      const warnings = validateData();
      if (warnings.length) {
        const shouldContinue = confirm('当前还有 ' + warnings.length + ' 个标注提醒，是否仍然继续？\\n\\n' + warnings.slice(0, 4).join('\\n'));
        if (!shouldContinue) return;
      }
      setPipelineButtonsDisabled(true);
      setStatus('正在保存标注并生成 Codex handoff...', 'pending');
      try {
        const result = await postBridge('/api/figma-bridge/annotations/handoff', {
          packageDir,
          annotations: data
        });
        setStatus('已生成 Codex handoff：' + result.handoffPath + '。回到 Codex 输入“继续识别这个标注 handoff”。', 'ok');
      } catch (error) {
        setStatus('生成 handoff 失败：' + error.message, 'error');
      } finally {
        setPipelineButtonsDisabled(false);
      }
    }
    function syncSelectedFormIfUseful() {
      const bbox = readBboxFromForm();
      const id = document.getElementById('id').value.trim();
      if (!bbox || bbox.width < 4 || bbox.height < 4) return;
      if (selectedIndex >= 0 || id || draft) {
        upsertFormRegion();
      }
    }
    async function postBridge(path, payload) {
      const response = await fetch(bridgeUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (error) {}
      if (!response.ok) {
        throw new Error((body && body.error) || text || ('HTTP ' + response.status));
      }
      return body || {};
    }
    function setStatus(message, tone) {
      bridgeStatus.className = tone === 'error' ? 'warning' : tone === 'ok' ? 'ok' : 'small';
      bridgeStatus.textContent = message;
    }
    function setPipelineButtonsDisabled(disabled) {
      for (const id of ['saveBridge', 'saveBridgeTop', 'handoff', 'handoffTop']) {
        const button = document.getElementById(id);
        if (button) button.disabled = disabled;
      }
    }
    function moveSelected(delta) {
      if (selectedIndex < 0) return;
      const next = selectedIndex + delta;
      if (next < 0 || next >= data.regions.length) return;
      const temp = data.regions[selectedIndex];
      data.regions[selectedIndex] = data.regions[next];
      data.regions[next] = temp;
      selectedIndex = next;
      render();
    }

    function resizeCanvas() {
      const displayWidth = Math.max(1, Math.round(data.canvas.width * zoom));
      const displayHeight = Math.max(1, Math.round(data.canvas.height * zoom));
      img.style.width = displayWidth + 'px';
      img.style.height = displayHeight + 'px';
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      stage.style.width = displayWidth + 'px';
      stage.style.height = displayHeight + 'px';
      zoomText.textContent = Math.round(zoom * 100) + '%';
      draw();
    }
    function setZoom(value) {
      zoom = Math.min(2.5, Math.max(0.2, Math.round(value * 100) / 100));
      resizeCanvas();
    }
    function fitToWidth() {
      const available = Math.max(320, viewport.clientWidth - 38);
      setZoom(available / data.canvas.width);
    }
    function pointer(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = data.canvas.width / rect.width;
      const scaleY = data.canvas.height / rect.height;
      return {
        x: Math.round((event.clientX - rect.left) * scaleX),
        y: Math.round((event.clientY - rect.top) * scaleY)
      };
    }
    function normalizeRect(x1, y1, x2, y2) {
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
      };
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      data.regions.forEach((region, index) => drawRegion(region, index === selectedIndex));
      if (draft) drawBox(draft, '#f97316', '草稿', true);
    }
    function drawRegion(region, active) {
      const color = roleColors[region.role] || '#1677ff';
      drawBox(region.bbox, color, region.id, active);
    }
    function drawBox(bbox, color, label, active) {
      const sx = canvas.width / data.canvas.width;
      const sy = canvas.height / data.canvas.height;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = active ? 3 : 2;
      ctx.setLineDash(active ? [] : [6, 4]);
      ctx.strokeRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.globalAlpha = active ? .18 : .1;
      ctx.fillRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);
      ctx.globalAlpha = 1;
      const labelText = label || '';
      const tx = bbox.x * sx + 4;
      const ty = Math.max(18, bbox.y * sy + 18);
      ctx.font = '12px Inter, Arial';
      const textWidth = ctx.measureText(labelText).width + 10;
      ctx.fillStyle = color;
      ctx.fillRect(tx - 2, ty - 14, textWidth, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, tx + 3, ty);
      if (active) drawHandles(bbox, sx, sy, color);
      ctx.restore();
    }
    function drawHandles(bbox, sx, sy, color) {
      const points = [
        [bbox.x, bbox.y],
        [bbox.x + bbox.width, bbox.y],
        [bbox.x, bbox.y + bbox.height],
        [bbox.x + bbox.width, bbox.y + bbox.height]
      ];
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = color;
      for (const point of points) {
        const x = point[0] * sx;
        const y = point[1] * sy;
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.strokeRect(x - 4, y - 4, 8, 8);
      }
    }
    function hitRegion(point) {
      for (let i = data.regions.length - 1; i >= 0; i -= 1) {
        const box = data.regions[i].bbox;
        if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return i;
      }
      return -1;
    }
    function hitHandle(point) {
      if (selectedIndex < 0) return null;
      const box = data.regions[selectedIndex].bbox;
      const tolerance = Math.max(6, Math.round(8 / zoom));
      const handles = {
        nw: [box.x, box.y],
        ne: [box.x + box.width, box.y],
        sw: [box.x, box.y + box.height],
        se: [box.x + box.width, box.y + box.height]
      };
      for (const key of Object.keys(handles)) {
        const h = handles[key];
        if (Math.abs(point.x - h[0]) <= tolerance && Math.abs(point.y - h[1]) <= tolerance) return key;
      }
      return null;
    }
    function updateCursor(point) {
      const handle = hitHandle(point);
      if (handle === 'nw' || handle === 'se') canvas.style.cursor = 'nwse-resize';
      else if (handle === 'ne' || handle === 'sw') canvas.style.cursor = 'nesw-resize';
      else if (hitRegion(point) >= 0) canvas.style.cursor = 'move';
      else canvas.style.cursor = 'crosshair';
    }
    function resizeBox(box, handle, point) {
      let x1 = box.x;
      let y1 = box.y;
      let x2 = box.x + box.width;
      let y2 = box.y + box.height;
      if (handle.includes('n')) y1 = point.y;
      if (handle.includes('s')) y2 = point.y;
      if (handle.includes('w')) x1 = point.x;
      if (handle.includes('e')) x2 = point.x;
      return clampBox(normalizeRect(x1, y1, x2, y2));
    }
    function cloneBox(box) {
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }
    function clampBox(box) {
      const x = Math.max(0, Math.min(data.canvas.width - 1, Math.round(box.x)));
      const y = Math.max(0, Math.min(data.canvas.height - 1, Math.round(box.y)));
      const width = Math.max(1, Math.min(data.canvas.width - x, Math.round(box.width)));
      const height = Math.max(1, Math.min(data.canvas.height - y, Math.round(box.height)));
      return { x, y, width, height };
    }
    function readBboxFromForm() {
      const box = {
        x: Number(document.getElementById('x').value),
        y: Number(document.getElementById('y').value),
        width: Number(document.getElementById('width').value),
        height: Number(document.getElementById('height').value)
      };
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) return null;
      return clampBox(box);
    }
    function writeBboxToForm(box) {
      document.getElementById('x').value = box.x;
      document.getElementById('y').value = box.y;
      document.getElementById('width').value = box.width;
      document.getElementById('height').value = box.height;
    }
    function readStyleFromForm() {
      const style = {};
      const fill = document.getElementById('fill').value.trim();
      const stroke = document.getElementById('stroke').value.trim();
      const opacity = optionalNumber('opacity');
      const cornerRadius = optionalNumber('cornerRadius');
      const strokeOpacity = optionalNumber('strokeOpacity');
      const strokeWeight = optionalNumber('strokeWeight');
      if (fill) style.fill = fill;
      if (opacity !== null) style.opacity = opacity;
      if (cornerRadius !== null) style.cornerRadius = cornerRadius;
      if (stroke) style.stroke = stroke;
      if (strokeOpacity !== null) style.strokeOpacity = strokeOpacity;
      if (strokeWeight !== null) style.strokeWeight = strokeWeight;
      return Object.keys(style).length ? style : undefined;
    }
    function optionalNumber(id) {
      const raw = document.getElementById(id).value;
      if (raw === '') return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    function loadRegionToForm(region) {
      document.getElementById('role').value = region.role || 'moduleBackground';
      document.getElementById('priority').value = region.priority || 'normal';
      document.getElementById('id').value = region.id || '';
      document.getElementById('label').value = region.label || '';
      document.getElementById('instruction').value = region.instruction || '';
      document.getElementById('targetAsset').value = region.targetAsset || '';
      writeBboxToForm(region.bbox || { x: 0, y: 0, width: 0, height: 0 });
      const style = region.style || {};
      document.getElementById('fill').value = style.fill || '';
      document.getElementById('opacity').value = style.opacity === undefined ? '' : style.opacity;
      document.getElementById('cornerRadius').value = style.cornerRadius === undefined ? '' : style.cornerRadius;
      document.getElementById('stroke').value = style.stroke || '';
      document.getElementById('strokeOpacity').value = style.strokeOpacity === undefined ? '' : style.strokeOpacity;
      document.getElementById('strokeWeight').value = style.strokeWeight === undefined ? '' : style.strokeWeight;
    }
    function clearForm(clearBox) {
      document.getElementById('role').value = 'moduleBackground';
      document.getElementById('priority').value = 'high';
      document.getElementById('id').value = '';
      document.getElementById('label').value = '';
      document.getElementById('instruction').value = '';
      document.getElementById('targetAsset').value = '';
      document.getElementById('fill').value = '';
      document.getElementById('opacity').value = '';
      document.getElementById('cornerRadius').value = '';
      document.getElementById('stroke').value = '';
      document.getElementById('strokeOpacity').value = '';
      document.getElementById('strokeWeight').value = '';
      if (clearBox) writeBboxToForm({ x: '', y: '', width: '', height: '' });
    }
    function cleanRegion(region) {
      if (!region.targetAsset) delete region.targetAsset;
      if (!region.instruction) delete region.instruction;
      if (!region.style) delete region.style;
      return region;
    }
    function nextRegionId(prefix) {
      const base = sanitizeId(prefix || document.getElementById('role').value || 'region');
      const used = new Set(data.regions.map(region => region.id));
      let index = data.regions.length + 1;
      let id = base + '_' + String(index).padStart(2, '0');
      while (used.has(id)) {
        index += 1;
        id = base + '_' + String(index).padStart(2, '0');
      }
      return id;
    }
    function sanitizeId(value) {
      return String(value || 'region').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'region';
    }
    function validateData() {
      const warnings = [];
      const ids = new Map();
      const roles = new Set();
      data.regions.forEach((region, index) => {
        roles.add(region.role);
        if (!region.id) warnings.push('第 ' + (index + 1) + ' 个区域缺少 ID。');
        if (region.id && ids.has(region.id)) warnings.push('区域 ID 重复：' + region.id);
        ids.set(region.id, true);
        if (!region.bbox || region.bbox.width <= 0 || region.bbox.height <= 0) warnings.push((region.id || '未命名区域') + ' 的坐标无效。');
        if (region.role !== 'ignore' && !region.instruction) warnings.push((region.id || '未命名区域') + ' 建议填写备注，说明区域内元素如何拆层或保留。');
        if ((region.role === 'tabGroup' || region.role === 'moduleBackground') && region.instruction && region.instruction.length < 12) warnings.push(region.id + ' 的备注过短，复杂区域建议写清楚内部多层级元素处理方式。');
        if ((region.role === 'heroImage' || region.role === 'moduleBackground') && !region.targetAsset) warnings.push(region.id + ' 建议填写目标素材路径 targetAsset。');
        if ((region.role === 'artText' || region.role === 'foreground') && !region.targetAsset) warnings.push(region.id + ' 需要填写 image2 输出素材路径。');
        if (region.role === 'selectedTab' && !region.style) warnings.push(region.id + ' 是选中 Tab，建议填写 fill/描边/圆角样式。');
      });
      if (roles.has('tabGroup') && !roles.has('selectedTab')) warnings.push('已有 Tab 组，但没有标注 selectedTab 选中态。');
      return warnings;
    }
    function render() {
      draw();
      const warnings = validateData();
      warningsNode.innerHTML = warnings.length
        ? warnings.map(text => '<div class="warning">' + escapeHtmlText(text) + '</div>').join('')
        : '<div class="ok">当前标注没有发现结构性问题。</div>';
      summaryNode.textContent = warnings.length ? warnings.length + ' 个提醒' : '通过';
      regionCountNode.textContent = data.regions.length + ' 个区域';
      regionsNode.innerHTML = data.regions.map((region, index) => {
        const color = roleColors[region.role] || '#1677ff';
        const bbox = region.bbox || { x: 0, y: 0, width: 0, height: 0 };
        return '<div class="region ' + (index === selectedIndex ? 'active' : '') + '" data-index="' + index + '">' +
          '<div class="regionTop"><b>' + escapeHtmlText(region.id || '未命名') + '</b><span class="badge" style="background:' + color + '">' + escapeHtmlText(roleLabels[region.role] || region.role || '未知') + '</span></div>' +
          '<div class="meta">' + escapeHtmlText(region.label || '') + '</div>' +
          '<div class="meta">x=' + bbox.x + ' y=' + bbox.y + ' 宽=' + bbox.width + ' 高=' + bbox.height + '</div>' +
          '<div class="meta">' + escapeHtmlText(region.instruction || '') + '</div>' +
        '</div>';
      }).join('');
      for (const node of regionsNode.querySelectorAll('.region')) {
        node.onclick = () => {
          selectedIndex = Number(node.dataset.index);
          draft = null;
          loadRegionToForm(data.regions[selectedIndex]);
          render();
        };
      }
      jsonNode.textContent = JSON.stringify(data, null, 2);
    }
    function escapeHtmlText(value) {
      return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    clearForm(true);
    render();
  </script>
</body>
</html>`;
}

function resolvePackageSourceImage(pageDocument, root) {
  const sourceImage = pageDocument.canvas && pageDocument.canvas.sourceImage;
  if (!sourceImage) {
    throw new Error(`page.json in ${root} has no canvas.sourceImage`);
  }
  return resolve(root, sourceImage);
}

function toPackageRelativeSource(path, root) {
  return toPosix(relative(root, path));
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function toPosix(path) {
  return path.split(sep).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJs(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeScriptJson(value) {
  return String(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
