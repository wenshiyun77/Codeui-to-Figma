const UI_HTML = [
  "<!doctype html>",
  "<html>",
  "<head>",
  "  <meta charset=\"utf-8\" />",
  "  <style>",
  "    :root { color-scheme: light dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
  "    body { margin: 0; background: var(--figma-color-bg, #fff); color: var(--figma-color-text, #222); font-size: 12px; }",
  "    main { display: flex; flex-direction: column; gap: 14px; padding: 16px; }",
  "    h1 { margin: 0; font-size: 15px; line-height: 20px; font-weight: 650; }",
  "    label { display: flex; flex-direction: column; gap: 6px; color: var(--figma-color-text-secondary, #666); }",
  "    input { height: 32px; border: 1px solid var(--figma-color-border, #ddd); border-radius: 6px; background: var(--figma-color-bg, #fff); color: var(--figma-color-text, #222); padding: 0 10px; font: inherit; }",
  "    .row { display: flex; gap: 8px; }",
  "    button { height: 32px; border: 1px solid var(--figma-color-border, #ddd); border-radius: 6px; background: var(--figma-color-bg-brand, #18a0fb); color: var(--figma-color-text-onbrand, #fff); padding: 0 12px; font: inherit; font-weight: 600; }",
  "    button.secondary { background: var(--figma-color-bg, #fff); color: var(--figma-color-text, #222); }",
  "    button:disabled { opacity: 0.5; }",
  "    .status { display: grid; grid-template-columns: 80px 1fr; gap: 6px 10px; border: 1px solid var(--figma-color-border, #ddd); border-radius: 8px; padding: 12px; }",
  "    .status span:nth-child(odd) { color: var(--figma-color-text-secondary, #666); }",
  "    pre { min-height: 180px; max-height: 220px; overflow: auto; margin: 0; border: 1px solid var(--figma-color-border, #ddd); border-radius: 8px; padding: 10px; background: var(--figma-color-bg-secondary, #f6f6f6); color: var(--figma-color-text, #222); white-space: pre-wrap; }",
  "  </style>",
  "</head>",
  "<body>",
  "  <main>",
  "    <h1>CodeUi-to-Figma</h1>",
  "    <label>Bridge URL<input id=\"bridgeUrl\" value=\"http://localhost:39217\" /></label>",
  "    <div class=\"row\">",
  "      <button id=\"startButton\">Start polling</button>",
  "      <button id=\"onceButton\" class=\"secondary\">Run once</button>",
  "      <button id=\"stopButton\" class=\"secondary\" disabled>Stop</button>",
  "    </div>",
  "    <div class=\"status\">",
  "      <span>State</span><strong id=\"state\">idle</strong>",
  "      <span>Last job</span><strong id=\"lastJob\">none</strong>",
  "      <span>Bridge</span><strong id=\"bridgeState\">not checked</strong>",
  "    </div>",
  "    <pre id=\"log\"></pre>",
  "  </main>",
  "  <script>",
  "    var bridgeInput = document.getElementById('bridgeUrl');",
  "    var startButton = document.getElementById('startButton');",
  "    var onceButton = document.getElementById('onceButton');",
  "    var stopButton = document.getElementById('stopButton');",
  "    var stateNode = document.getElementById('state');",
  "    var lastJobNode = document.getElementById('lastJob');",
  "    var bridgeStateNode = document.getElementById('bridgeState');",
  "    var logNode = document.getElementById('log');",
  "    var polling = false;",
  "    var busy = false;",
  "    var currentJob = null;",
  "    var timer = null;",
  "    bridgeInput.value = readStoredBridgeUrl() || bridgeInput.value;",
  "    bindClick(startButton, function () { appendLog('Start clicked'); polling = true; startButton.disabled = true; stopButton.disabled = false; onceButton.disabled = true; tick(); });",
  "    bindClick(onceButton, function () { appendLog('Run once clicked'); if (!busy) tick({ single: true }); });",
  "    bindClick(stopButton, function () { polling = false; startButton.disabled = false; stopButton.disabled = true; onceButton.disabled = false; setState('stopped'); if (timer) { clearTimeout(timer); timer = null; } });",
  "    bridgeInput.onchange = function () { writeStoredBridgeUrl(bridgeInput.value.trim()); };",
  "    appendLog('UI ready');",
  "    setTimeout(function () {",
  "      if (!polling) {",
  "        appendLog('Auto polling started');",
  "        polling = true;",
  "        startButton.disabled = true;",
  "        stopButton.disabled = false;",
  "        onceButton.disabled = true;",
  "        tick();",
  "      }",
  "    }, 300);",
  "    window.onmessage = async function (event) {",
  "      var message = event.data.pluginMessage;",
  "      if (!message || message.type !== 'job-result') return;",
  "      await postResult(message);",
  "      busy = false;",
  "      currentJob = null;",
  "      if (polling) timer = setTimeout(function () { tick(); }, 1000);",
  "      else setState('idle');",
  "    };",
  "    async function tick(options) {",
  "      options = options || {};",
  "      if (busy) return;",
  "      try {",
  "        setState('checking');",
  "        var bridgeUrl = getBridgeUrl();",
  "        var response = await fetch(bridgeUrl + '/api/figma-bridge/jobs/next?clientId=figma-plugin');",
  "        bridgeStateNode.textContent = response.ok ? 'connected' : 'HTTP ' + response.status;",
  "        if (!response.ok) throw new Error('Bridge returned ' + response.status);",
  "        var data = await response.json();",
  "        if (!data.job) {",
  "          setState('idle');",
  "          appendLog('No queued job');",
  "          if (polling && !options.single) timer = setTimeout(function () { tick(); }, 1500);",
  "          return;",
  "        }",
  "        busy = true;",
  "        currentJob = data.job;",
  "        lastJobNode.textContent = data.job.id;",
  "        setState('executing');",
  "        appendLog('Claimed ' + data.job.id);",
  "        parent.postMessage({ pluginMessage: { type: 'execute-job', job: data.job } }, '*');",
  "      } catch (error) {",
  "        bridgeStateNode.textContent = 'error';",
  "        appendLog(error.message || String(error));",
  "        setState('error');",
  "        if (polling && !options.single) timer = setTimeout(function () { tick(); }, 2500);",
  "      }",
  "    }",
  "    async function postResult(message) {",
  "      var bridgeUrl = getBridgeUrl();",
  "      var jobId = message.jobId || (currentJob && currentJob.id);",
  "      if (!jobId) { appendLog('Cannot post result without job id'); return; }",
  "      var response = await fetch(bridgeUrl + '/api/figma-bridge/jobs/' + jobId + '/result', {",
  "        method: 'POST',",
  "        headers: { 'Content-Type': 'application/json' },",
  "        body: JSON.stringify({ status: message.status, result: message.result || null, error: message.error || null, logs: message.logs || [] })",
  "      });",
  "      if (!response.ok) { appendLog('Failed to post result for ' + jobId + ': HTTP ' + response.status); return; }",
  "      appendLog(jobId + ' ' + message.status);",
  "      if (message.error && message.error.message) appendLog(message.error.message);",
  "      setState(message.status);",
  "    }",
  "    function bindClick(node, handler) { if (node.addEventListener) node.addEventListener('click', handler); else node.onclick = handler; }",
  "    function readStoredBridgeUrl() { try { return window.localStorage && localStorage.getItem('bridgeUrl'); } catch (error) { return null; } }",
  "    function writeStoredBridgeUrl(value) { try { if (window.localStorage) localStorage.setItem('bridgeUrl', value); } catch (error) {} }",
  "    function getBridgeUrl() { var value = bridgeInput.value.trim().replace(/\\/+$/, ''); writeStoredBridgeUrl(value); return value; }",
  "    function setState(value) { stateNode.textContent = value; }",
  "    function appendLog(line) { var time = new Date().toLocaleTimeString(); logNode.textContent = time + ' ' + line + '\\n' + logNode.textContent; }",
  "  </script>",
  "</body>",
  "</html>"
].join("\n");

function buildPluginUiHtml() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    :root { color-scheme: light; font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; --line:#d9d9df; --muted:#6b7280; --blue:#1677ff; --danger:#b42318; --bg:#f6f7f9; --ink:#1f2328; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-size: 12px; }
    button, input, select, textarea { font: inherit; }
    button { height: 32px; border: 1px solid var(--line); border-radius: 7px; background: var(--blue); color: #fff; padding: 0 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    button.secondary { background: #fff; color: var(--ink); }
    button.danger { background: #fee4e2; color: var(--danger); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 7px; background: #fff; color: var(--ink); padding: 7px 9px; }
    textarea { min-height: 70px; resize: vertical; line-height: 1.45; }
    label { display: block; margin: 8px 0 4px; color: #565f6b; font-weight: 700; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; background: #fff; border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: 15px; line-height: 20px; }
    .tabs { display: flex; gap: 6px; }
    .tab { background: #f0f2f5; color: var(--ink); }
    .tab.active { background: var(--blue); color: #fff; }
    .view { display: none; padding: 14px; }
    .view.active { display: block; }
    .bridgeRow { display: grid; grid-template-columns: 110px minmax(240px, 1fr) auto auto auto; gap: 8px; align-items: end; margin-bottom: 12px; }
    .status { display: grid; grid-template-columns: 80px 1fr; gap: 6px 10px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; max-width: 420px; }
    .status span:nth-child(odd), .small { color: var(--muted); }
    pre { margin: 0; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #fff; color: var(--ink); white-space: pre-wrap; overflow: auto; }
    #log { min-height: 260px; max-height: 360px; }
    .workbench { display: grid; grid-template-columns: minmax(420px, 1fr) 360px; gap: 12px; align-items: start; }
    .canvasPanel, .sidePanel { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
    .workTop { display: grid; grid-template-columns: minmax(260px,1fr) auto auto auto; gap: 8px; align-items: end; margin-bottom: 10px; }
    .viewport { height: 560px; overflow: auto; background: #e9e9ed; border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .stage { position: relative; width: fit-content; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.15); transform-origin: top left; }
    #sourceImage { display: block; user-select: none; pointer-events: none; }
    #overlay { position: absolute; inset: 0; cursor: crosshair; touch-action: none; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .regionList { max-height: 120px; overflow: auto; display: grid; gap: 6px; margin-top: 8px; }
    .region { border: 1px solid #ececf0; border-radius: 8px; padding: 8px; cursor: pointer; background: #fff; }
    .region.active { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(22,119,255,.14); }
    .regionTop { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .region b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { display: inline-flex; border-radius: 999px; padding: 2px 7px; color: #fff; font-size: 11px; font-weight: 700; }
    .meta { margin-top: 4px; color: #667085; line-height: 1.4; }
    .warning, .ok { border-radius: 8px; padding: 8px; margin-top: 8px; line-height: 1.45; }
    .warning { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
    .ok { background: #ecfdf3; color: #067647; border: 1px solid #abefc6; }
    .jsonPreview { max-height: 120px; font-size: 11px; margin-top: 8px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>CodeUi-to-Figma</h1>
      <div class="small">导入轮询 + Figma 内置人工标注工作台</div>
    </div>
    <div class="tabs">
      <button class="tab active" id="tabImport">导入轮询</button>
      <button class="tab" id="tabAnnotate">标注工作台</button>
    </div>
  </header>

  <section class="view active" id="importView">
    <div class="bridgeRow">
      <label>Bridge URL</label>
      <input id="bridgeUrl" value="http://localhost:39217">
      <button id="startButton">开始轮询</button>
      <button id="onceButton" class="secondary">执行一次</button>
      <button id="stopButton" class="secondary" disabled>停止</button>
    </div>
    <div class="status">
      <span>状态</span><strong id="state">idle</strong>
      <span>最后任务</span><strong id="lastJob">none</strong>
      <span>Bridge</span><strong id="bridgeState">not checked</strong>
    </div>
    <div style="height:12px"></div>
    <pre id="log"></pre>
  </section>

  <section class="view" id="annotateView">
    <div class="workTop">
      <label>Package 目录<input id="packageDir" placeholder="/Users/mac/Documents/CodeUi-to-Figma/var/generated/xxx"></label>
      <button id="loadPackage">加载源图</button>
      <button id="fitButton" class="secondary">适配宽度</button>
      <button id="saveHandoff">保存并交给 Codex</button>
    </div>
    <div class="workbench">
      <div class="canvasPanel">
        <p class="small">框选区域只是给 Codex 模型的识别约束。备注必须写清楚区域内多层级元素如何处理；艺术字和前景透明 PNG 必须走 image2 去背景。</p>
        <div class="viewport" id="viewport">
          <div class="stage" id="stage">
            <img id="sourceImage" alt="活动页源图">
            <canvas id="overlay"></canvas>
          </div>
        </div>
      </div>
      <aside class="sidePanel">
        <div class="row2">
          <div><label>区域类型</label><select id="role">
            <option value="moduleBackground">区域背景</option>
            <option value="heroImage">完整头图</option>
            <option value="tabGroup">Tab 组背景</option>
            <option value="selectedTab">选中 Tab 状态</option>
            <option value="artText">艺术字切图</option>
            <option value="foreground">前景素材切图</option>
            <option value="shape">可编辑形状</option>
            <option value="text">可编辑文本</option>
            <option value="ignore">忽略区域</option>
          </select></div>
          <div><label>优先级</label><select id="priority"><option value="high">高</option><option value="normal">普通</option><option value="low">低</option></select></div>
        </div>
        <div class="row2">
          <div><label>区域 ID</label><input id="regionId" placeholder="hero_full"></div>
          <div><label>中文名称</label><input id="labelText" placeholder="完整头图"></div>
        </div>
        <label>坐标和尺寸（源图像素）</label>
        <div class="row4"><input id="x" type="number" placeholder="x"><input id="y" type="number" placeholder="y"><input id="width" type="number" placeholder="宽"><input id="height" type="number" placeholder="高"></div>
        <label>目标素材路径</label><input id="targetAsset" placeholder="assets/backgrounds/hero-full.png">
        <label>给 Codex 的备注</label><textarea id="instruction" placeholder="必须完整描述区域内元素如何拆层、哪些保留背景、哪些转文字/形状/透明素材。"></textarea>
        <div class="row3">
          <div><label>填充色</label><input id="fill" placeholder="#073C20"></div>
          <div><label>透明度</label><input id="opacity" type="number" step="0.01" min="0" max="1"></div>
          <div><label>圆角</label><input id="cornerRadius" type="number" min="0"></div>
        </div>
        <div class="row3">
          <div><label>描边色</label><input id="stroke" placeholder="#F6D75B"></div>
          <div><label>描边透明度</label><input id="strokeOpacity" type="number" step="0.01" min="0" max="1"></div>
          <div><label>描边宽度</label><input id="strokeWeight" type="number" min="0"></div>
        </div>
        <div class="actions">
          <button id="saveRegion">新增/更新区域</button>
          <button id="newRegion" class="secondary">清空表单</button>
          <button id="deleteRegion" class="danger">删除选中</button>
          <button id="copyJson" class="secondary">复制 JSON</button>
        </div>
        <div id="annotationStatus" class="small" style="margin-top:8px"></div>
        <div id="warnings"></div>
        <div class="regionList" id="regions"></div>
        <pre class="jsonPreview" id="jsonPreview"></pre>
      </aside>
    </div>
  </section>

  <script>
    var bridgeInput = document.getElementById('bridgeUrl');
    var startButton = document.getElementById('startButton');
    var onceButton = document.getElementById('onceButton');
    var stopButton = document.getElementById('stopButton');
    var stateNode = document.getElementById('state');
    var lastJobNode = document.getElementById('lastJob');
    var bridgeStateNode = document.getElementById('bridgeState');
    var logNode = document.getElementById('log');
    var polling = false;
    var busy = false;
    var currentJob = null;
    var timer = null;
    bridgeInput.value = readStored('bridgeUrl') || bridgeInput.value;
    document.getElementById('packageDir').value = readStored('packageDir') || '';

    bindClick(document.getElementById('tabImport'), function () { setTab('import'); });
    bindClick(document.getElementById('tabAnnotate'), function () { setTab('annotate'); });
    bindClick(startButton, function () { appendLog('开始轮询'); polling = true; startButton.disabled = true; stopButton.disabled = false; onceButton.disabled = true; tick(); });
    bindClick(onceButton, function () { appendLog('执行一次'); if (!busy) tick({ single: true }); });
    bindClick(stopButton, function () { polling = false; startButton.disabled = false; stopButton.disabled = true; onceButton.disabled = false; setState('stopped'); if (timer) { clearTimeout(timer); timer = null; } });
    bridgeInput.onchange = function () { writeStored('bridgeUrl', bridgeInput.value.trim()); };

    setTimeout(function () {
      if (!polling) {
        appendLog('自动轮询已启动');
        polling = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        onceButton.disabled = true;
        tick();
      }
    }, 300);

    window.onmessage = async function (event) {
      var message = event.data.pluginMessage;
      if (!message || message.type !== 'job-result') return;
      await postResult(message);
      busy = false;
      currentJob = null;
      if (polling) timer = setTimeout(function () { tick(); }, 1000);
      else setState('idle');
    };

    async function tick(options) {
      options = options || {};
      if (busy) return;
      try {
        setState('checking');
        var response = await fetch(getBridgeUrl() + '/api/figma-bridge/jobs/next?clientId=figma-plugin');
        bridgeStateNode.textContent = response.ok ? 'connected' : 'HTTP ' + response.status;
        if (!response.ok) throw new Error('Bridge returned ' + response.status);
        var data = await response.json();
        if (!data.job) {
          setState('idle');
          appendLog('No queued job');
          if (polling && !options.single) timer = setTimeout(function () { tick(); }, 1500);
          return;
        }
        busy = true;
        currentJob = data.job;
        lastJobNode.textContent = data.job.id;
        setState('executing');
        appendLog('Claimed ' + data.job.id);
        parent.postMessage({ pluginMessage: { type: 'execute-job', job: data.job } }, '*');
      } catch (error) {
        bridgeStateNode.textContent = 'error';
        appendLog(error.message || String(error));
        setState('error');
        if (polling && !options.single) timer = setTimeout(function () { tick(); }, 2500);
      }
    }
    async function postResult(message) {
      var jobId = message.jobId || (currentJob && currentJob.id);
      if (!jobId) { appendLog('Cannot post result without job id'); return; }
      var response = await fetch(getBridgeUrl() + '/api/figma-bridge/jobs/' + jobId + '/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: message.status, result: message.result || null, error: message.error || null, logs: message.logs || [] })
      });
      if (!response.ok) { appendLog('Failed to post result for ' + jobId + ': HTTP ' + response.status); return; }
      appendLog(jobId + ' ' + message.status);
      if (message.error && message.error.message) appendLog(message.error.message);
      setState(message.status);
    }

    var data = null;
    var packageDir = '';
    var selectedIndex = -1;
    var draft = null;
    var dragMode = null;
    var dragHandle = null;
    var dragOrigin = null;
    var originalBox = null;
    var startPoint = null;
    var zoom = 1;
    var roleColors = { heroImage:'#ef4444', moduleBackground:'#1677ff', tabGroup:'#7c3aed', selectedTab:'#22c55e', artText:'#f97316', foreground:'#eab308', shape:'#14b8a6', text:'#0ea5e9', ignore:'#6b7280' };
    var roleLabels = { heroImage:'完整头图', moduleBackground:'区域背景', tabGroup:'Tab 组背景', selectedTab:'选中 Tab 状态', artText:'艺术字切图', foreground:'前景素材切图', shape:'可编辑形状', text:'可编辑文本', ignore:'忽略区域' };
    var img = document.getElementById('sourceImage');
    var canvas = document.getElementById('overlay');
    var ctx = canvas.getContext('2d');
    var stage = document.getElementById('stage');
    var viewport = document.getElementById('viewport');

    bindClick(document.getElementById('loadPackage'), loadPackage);
    bindClick(document.getElementById('fitButton'), fitToWidth);
    bindClick(document.getElementById('saveHandoff'), saveHandoff);
    bindClick(document.getElementById('saveRegion'), upsertFormRegion);
    bindClick(document.getElementById('newRegion'), function () { selectedIndex = -1; draft = null; clearForm(true); renderWorkbench(); });
    bindClick(document.getElementById('deleteRegion'), function () { if (!data || selectedIndex < 0) return; data.regions.splice(selectedIndex, 1); selectedIndex = -1; draft = null; clearForm(true); renderWorkbench(); });
    bindClick(document.getElementById('copyJson'), async function () { if (!data) return; await copyText(JSON.stringify(data, null, 2)); setAnnotationStatus('已复制 JSON。', 'ok'); });
    img.onload = function () {
      if (!data) return;
      if (!data.canvas || !data.canvas.width || !data.canvas.height) data.canvas = { width: img.naturalWidth, height: img.naturalHeight };
      fitToWidth();
      renderWorkbench();
    };
    canvas.onmousedown = function (event) {
      if (!data) return;
      var point = pointer(event);
      var handle = hitHandle(point);
      var hitIndex = handle ? selectedIndex : hitRegion(point);
      if (handle && selectedIndex >= 0) {
        dragMode = 'resize'; dragHandle = handle; dragOrigin = point; originalBox = cloneBox(data.regions[selectedIndex].bbox);
      } else if (hitIndex >= 0) {
        selectedIndex = hitIndex; loadRegionToForm(data.regions[selectedIndex]); dragMode = 'move'; dragOrigin = point; originalBox = cloneBox(data.regions[selectedIndex].bbox);
      } else {
        selectedIndex = -1; clearForm(false); startPoint = point; dragMode = 'draw'; draft = { x: point.x, y: point.y, width: 0, height: 0 };
      }
      draw();
    };
    canvas.onmousemove = function (event) {
      if (!data) return;
      var point = pointer(event);
      updateCursor(point);
      if (dragMode === 'draw' && startPoint) {
        draft = normalizeRect(startPoint.x, startPoint.y, point.x, point.y); writeBboxToForm(draft);
      } else if (dragMode === 'move' && selectedIndex >= 0) {
        data.regions[selectedIndex].bbox = clampBox({ x: originalBox.x + point.x - dragOrigin.x, y: originalBox.y + point.y - dragOrigin.y, width: originalBox.width, height: originalBox.height }); writeBboxToForm(data.regions[selectedIndex].bbox);
      } else if (dragMode === 'resize' && selectedIndex >= 0) {
        data.regions[selectedIndex].bbox = resizeBox(originalBox, dragHandle, point); writeBboxToForm(data.regions[selectedIndex].bbox);
      }
      draw();
    };
    window.onmouseup = function () {
      if (dragMode === 'draw' && draft) writeBboxToForm(draft);
      startPoint = null; dragMode = null; dragHandle = null; dragOrigin = null; originalBox = null;
      renderWorkbench();
    };

    async function loadPackage() {
      packageDir = document.getElementById('packageDir').value.trim();
      if (!packageDir) { setAnnotationStatus('请先填写 package 目录。', 'error'); return; }
      writeStored('packageDir', packageDir);
      setAnnotationStatus('正在加载 package...', 'pending');
      var response = await fetch(getBridgeUrl() + '/api/figma-bridge/annotations/workbench?packageDir=' + encodeURIComponent(packageDir));
      var body = await response.json();
      if (!response.ok) { setAnnotationStatus((body && body.error) || ('加载失败 HTTP ' + response.status), 'error'); return; }
      data = body.annotations;
      if (!Array.isArray(data.regions)) data.regions = [];
      if (!data.canvas) data.canvas = body.canvas || { width: 0, height: 0 };
      selectedIndex = -1; draft = null; clearForm(true);
      img.src = body.sourceImageUrl + '&t=' + Date.now();
      setAnnotationStatus('已加载：' + body.sourceImagePath, 'ok');
      renderWorkbench();
    }
    async function saveHandoff() {
      if (!data || !packageDir) { setAnnotationStatus('请先加载 package。', 'error'); return; }
      syncSelectedFormIfUseful();
      var warnings = validateData();
      if (warnings.length && !confirm('当前还有 ' + warnings.length + ' 个提醒，是否继续？\\n\\n' + warnings.slice(0, 4).join('\\n'))) return;
      setAnnotationStatus('正在保存标注并生成 Codex handoff...', 'pending');
      var response = await fetch(getBridgeUrl() + '/api/figma-bridge/annotations/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageDir: packageDir, annotations: data })
      });
      var body = await response.json();
      if (!response.ok) { setAnnotationStatus((body && body.error) || ('保存失败 HTTP ' + response.status), 'error'); return; }
      setAnnotationStatus('已生成 handoff。回到 Codex 输入“继续识别这个标注 handoff”。' + body.handoffPath, 'ok');
    }
    function upsertFormRegion() {
      if (!data) return;
      var bbox = readBboxFromForm();
      if (!bbox || bbox.width < 4 || bbox.height < 4) { alert('请先框选区域，或填写有效坐标。'); return; }
      var id = document.getElementById('regionId').value.trim() || nextRegionId();
      var region = cleanRegion({ id: id, role: valueOf('role'), label: valueOf('labelText') || id, bbox: bbox, instruction: valueOf('instruction'), priority: valueOf('priority'), targetAsset: valueOf('targetAsset'), style: readStyleFromForm() });
      draft = null;
      if (selectedIndex >= 0) data.regions[selectedIndex] = region;
      else { data.regions.push(region); selectedIndex = data.regions.length - 1; }
      renderWorkbench();
    }
    function syncSelectedFormIfUseful() {
      var bbox = readBboxFromForm();
      var id = valueOf('regionId');
      if (!bbox || bbox.width < 4 || bbox.height < 4) return;
      if (selectedIndex >= 0 || id || draft) upsertFormRegion();
    }
    function renderWorkbench() {
      draw();
      if (!data) return;
      var warnings = validateData();
      document.getElementById('warnings').innerHTML = warnings.length ? warnings.map(function (text) { return '<div class="warning">' + escapeHtml(text) + '</div>'; }).join('') : '<div class="ok">当前标注没有发现结构性问题。</div>';
      document.getElementById('regions').innerHTML = data.regions.map(function (region, index) {
        var box = region.bbox || { x:0, y:0, width:0, height:0 };
        var color = roleColors[region.role] || '#1677ff';
        return '<div class="region ' + (index === selectedIndex ? 'active' : '') + '" data-index="' + index + '"><div class="regionTop"><b>' + escapeHtml(region.label || region.id || '未命名') + '</b><span class="badge" style="background:' + color + '">' + escapeHtml(roleLabels[region.role] || region.role || '区域') + '</span></div><div class="meta">' + box.x + ',' + box.y + ' / ' + box.width + 'x' + box.height + '</div><div class="meta">' + escapeHtml(region.instruction || '') + '</div></div>';
      }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('.region'), function (node) {
        node.onclick = function () { selectedIndex = Number(node.getAttribute('data-index')); loadRegionToForm(data.regions[selectedIndex]); renderWorkbench(); };
      });
      document.getElementById('jsonPreview').textContent = JSON.stringify(data, null, 2);
    }
    function validateData() {
      var warnings = [];
      if (!data) return warnings;
      var ids = {};
      var hasTab = false;
      var hasSelected = false;
      data.regions.forEach(function (region, index) {
        if (region.role === 'tabGroup') hasTab = true;
        if (region.role === 'selectedTab') hasSelected = true;
        if (!region.id) warnings.push('第 ' + (index + 1) + ' 个区域缺少 ID。');
        if (region.id && ids[region.id]) warnings.push('区域 ID 重复：' + region.id);
        ids[region.id] = true;
        if (!region.bbox || region.bbox.width <= 0 || region.bbox.height <= 0) warnings.push((region.id || '未命名区域') + ' 的坐标无效。');
        if (region.role !== 'ignore' && !region.instruction) warnings.push((region.id || '未命名区域') + ' 建议填写备注，说明区域内元素如何拆层或保留。');
        if ((region.role === 'tabGroup' || region.role === 'moduleBackground') && region.instruction && region.instruction.length < 12) warnings.push(region.id + ' 的备注过短，复杂区域建议写清楚内部多层级元素处理方式。');
        if ((region.role === 'artText' || region.role === 'foreground') && !region.targetAsset) warnings.push(region.id + ' 需要填写 image2 输出素材路径。');
      });
      if (hasTab && !hasSelected) warnings.push('已有 Tab 组，但没有标注 selectedTab 选中态。');
      return warnings;
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!data) return;
      data.regions.forEach(function (region, index) { drawBox(region.bbox, roleColors[region.role] || '#1677ff', region.id, index === selectedIndex); });
      if (draft) drawBox(draft, '#f97316', '草稿', true);
    }
    function drawBox(bbox, color, label, active) {
      if (!bbox) return;
      var sx = canvas.width / data.canvas.width;
      var sy = canvas.height / data.canvas.height;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = active ? 3 : 2; ctx.setLineDash(active ? [] : [6,4]);
      ctx.strokeRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.globalAlpha = active ? .18 : .1;
      ctx.fillRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);
      ctx.globalAlpha = 1; ctx.font = '12px Inter, Arial';
      var tx = bbox.x * sx + 4; var ty = Math.max(18, bbox.y * sy + 18);
      var tw = ctx.measureText(label || '').width + 10;
      ctx.fillStyle = color; ctx.fillRect(tx - 2, ty - 14, tw, 18);
      ctx.fillStyle = '#fff'; ctx.fillText(label || '', tx + 3, ty);
      if (active) drawHandles(bbox, sx, sy, color);
      ctx.restore();
    }
    function drawHandles(bbox, sx, sy, color) {
      var points = [[bbox.x,bbox.y],[bbox.x+bbox.width,bbox.y],[bbox.x,bbox.y+bbox.height],[bbox.x+bbox.width,bbox.y+bbox.height]];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = color;
      points.forEach(function (p) { var x = p[0] * sx; var y = p[1] * sy; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeRect(x - 4, y - 4, 8, 8); });
    }
    function fitToWidth() { if (!data || !data.canvas.width) return; var available = Math.max(320, viewport.clientWidth - 30); setZoom(available / data.canvas.width); }
    function setZoom(value) { zoom = Math.min(2.5, Math.max(0.2, Math.round(value * 100) / 100)); resizeCanvas(); }
    function resizeCanvas() {
      if (!data || !data.canvas) return;
      var displayWidth = Math.max(1, Math.round(data.canvas.width * zoom));
      var displayHeight = Math.max(1, Math.round(data.canvas.height * zoom));
      img.style.width = displayWidth + 'px'; img.style.height = displayHeight + 'px';
      canvas.width = displayWidth; canvas.height = displayHeight;
      stage.style.width = displayWidth + 'px'; stage.style.height = displayHeight + 'px';
      draw();
    }
    function pointer(event) { var rect = canvas.getBoundingClientRect(); return { x: Math.round((event.clientX - rect.left) * data.canvas.width / rect.width), y: Math.round((event.clientY - rect.top) * data.canvas.height / rect.height) }; }
    function normalizeRect(x1,y1,x2,y2) { return { x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) }; }
    function hitRegion(point) { for (var i = data.regions.length - 1; i >= 0; i -= 1) { var b = data.regions[i].bbox; if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) return i; } return -1; }
    function hitHandle(point) { if (selectedIndex < 0) return null; var b = data.regions[selectedIndex].bbox; var t = Math.max(6, Math.round(8 / zoom)); var h = { nw:[b.x,b.y], ne:[b.x+b.width,b.y], sw:[b.x,b.y+b.height], se:[b.x+b.width,b.y+b.height] }; for (var k in h) if (Math.abs(point.x - h[k][0]) <= t && Math.abs(point.y - h[k][1]) <= t) return k; return null; }
    function updateCursor(point) { var handle = hitHandle(point); canvas.style.cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : handle === 'ne' || handle === 'sw' ? 'nesw-resize' : hitRegion(point) >= 0 ? 'move' : 'crosshair'; }
    function resizeBox(box, handle, point) { var x1 = box.x, y1 = box.y, x2 = box.x + box.width, y2 = box.y + box.height; if (handle.indexOf('n') !== -1) y1 = point.y; if (handle.indexOf('s') !== -1) y2 = point.y; if (handle.indexOf('w') !== -1) x1 = point.x; if (handle.indexOf('e') !== -1) x2 = point.x; return clampBox(normalizeRect(x1,y1,x2,y2)); }
    function cloneBox(box) { return { x: box.x, y: box.y, width: box.width, height: box.height }; }
    function clampBox(box) { var x = Math.max(0, Math.min(data.canvas.width - 1, Math.round(box.x))); var y = Math.max(0, Math.min(data.canvas.height - 1, Math.round(box.y))); return { x: x, y: y, width: Math.max(1, Math.min(data.canvas.width - x, Math.round(box.width))), height: Math.max(1, Math.min(data.canvas.height - y, Math.round(box.height))) }; }
    function readBboxFromForm() { var box = { x: Number(valueOf('x')), y: Number(valueOf('y')), width: Number(valueOf('width')), height: Number(valueOf('height')) }; if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) return null; return clampBox(box); }
    function writeBboxToForm(box) { setValue('x', box.x); setValue('y', box.y); setValue('width', box.width); setValue('height', box.height); }
    function readStyleFromForm() { var style = {}; ['fill','stroke'].forEach(function (id) { var v = valueOf(id); if (v) style[id] = v; }); [['opacity','opacity'],['cornerRadius','cornerRadius'],['strokeOpacity','strokeOpacity'],['strokeWeight','strokeWeight']].forEach(function (pair) { var raw = valueOf(pair[0]); var num = Number(raw); if (raw !== '' && Number.isFinite(num)) style[pair[1]] = num; }); return Object.keys(style).length ? style : undefined; }
    function loadRegionToForm(region) { setValue('role', region.role || 'moduleBackground'); setValue('priority', region.priority || 'normal'); setValue('regionId', region.id || ''); setValue('labelText', region.label || ''); setValue('instruction', region.instruction || ''); setValue('targetAsset', region.targetAsset || ''); writeBboxToForm(region.bbox || { x:0, y:0, width:0, height:0 }); var s = region.style || {}; setValue('fill', s.fill || ''); setValue('opacity', s.opacity === undefined ? '' : s.opacity); setValue('cornerRadius', s.cornerRadius === undefined ? '' : s.cornerRadius); setValue('stroke', s.stroke || ''); setValue('strokeOpacity', s.strokeOpacity === undefined ? '' : s.strokeOpacity); setValue('strokeWeight', s.strokeWeight === undefined ? '' : s.strokeWeight); }
    function clearForm(clearBox) { ['regionId','labelText','instruction','targetAsset','fill','opacity','cornerRadius','stroke','strokeOpacity','strokeWeight'].forEach(function (id) { setValue(id, ''); }); setValue('role', 'moduleBackground'); setValue('priority', 'high'); if (clearBox) ['x','y','width','height'].forEach(function (id) { setValue(id, ''); }); }
    function cleanRegion(region) { if (!region.targetAsset) delete region.targetAsset; if (!region.instruction) delete region.instruction; if (!region.style) delete region.style; return region; }
    function nextRegionId() { var base = sanitizeId(valueOf('role') || 'region'); var used = {}; data.regions.forEach(function (r) { used[r.id] = true; }); var i = data.regions.length + 1; var id = base + '_' + String(i).padStart(2, '0'); while (used[id]) { i += 1; id = base + '_' + String(i).padStart(2, '0'); } return id; }
    function sanitizeId(value) { return String(value || 'region').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'region'; }
    function valueOf(id) { return document.getElementById(id).value.trim(); }
    function setValue(id, value) { document.getElementById(id).value = value; }
    function setAnnotationStatus(message, tone) { var node = document.getElementById('annotationStatus'); node.className = tone === 'error' ? 'warning' : tone === 'ok' ? 'ok' : 'small'; node.textContent = message; }
    function setTab(name) { document.getElementById('importView').classList.toggle('active', name === 'import'); document.getElementById('annotateView').classList.toggle('active', name === 'annotate'); document.getElementById('tabImport').classList.toggle('active', name === 'import'); document.getElementById('tabAnnotate').classList.toggle('active', name === 'annotate'); if (name === 'annotate') setTimeout(function () { resizeCanvas(); }, 0); }
    function bindClick(node, handler) { if (node.addEventListener) node.addEventListener('click', handler); else node.onclick = handler; }
    function readStored(key) { try { return window.localStorage && localStorage.getItem(key); } catch (error) { return null; } }
    function writeStored(key, value) { try { if (window.localStorage) localStorage.setItem(key, value); } catch (error) {} }
    function getBridgeUrl() { var value = bridgeInput.value.trim().replace(/\/+$/, ''); writeStored('bridgeUrl', value); return value; }
    function setState(value) { stateNode.textContent = value; }
    function appendLog(line) { var time = new Date().toLocaleTimeString(); logNode.textContent = time + ' ' + line + '\\n' + logNode.textContent; }
    function escapeHtml(text) { return String(text || '').replace(/[&<>"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]; }); }
    async function copyText(text) { try { await navigator.clipboard.writeText(text); } catch (error) { window.prompt('复制失败，请手动复制：', text); } }
  </script>
</body>
</html>`;
}

figma.showUI(buildPluginUiHtml(), {
  width: 980,
  height: 720
});

figma.ui.onmessage = async (message) => {
  if (!message || message.type !== "execute-job") {
    return;
  }

  const logs = [];
  const warnings = [];

  try {
    const result = await executeJob(message.job, logs, warnings);
    figma.ui.postMessage({
      type: "job-result",
      jobId: message.job.id,
      status: "completed",
      result,
      logs
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "job-result",
      jobId: message.job.id,
      status: "failed",
      error: {
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : null
      },
      logs
    });
  }
};

async function executeJob(job, logs, warnings) {
  if (!job || job.type !== "figma.activityPage.import") {
    throw new Error(`Unsupported job type: ${job && job.type}`);
  }

  const pageDocument = job.payload && job.payload.page;
  if (!pageDocument || typeof pageDocument !== "object") {
    throw new Error("Job payload is missing page");
  }
  assertPageReadyForImport(pageDocument);

  const registry = {};
  const pageName = pageDocument.name || "Activity Page";
  const figmaPage = figma.createPage();
  figmaPage.name = uniquePageName(pageName);
  await figma.setCurrentPageAsync(figmaPage);

  const canvas = pageDocument.canvas || {};
  const root = figma.createFrame();
  root.name = pageName;
  resizeNode(root, numberOr(canvas.width, 750), numberOr(canvas.height, 1600));
  root.x = 0;
  root.y = 0;
  root.clipsContent = false;
  root.fills = canvas.background ? [solidPaint(canvas.background)] : [];
  figmaPage.appendChild(root);

  registry[root.name] = root.id;
  const context = {
    job,
    registry,
    warnings,
    logs
  };

  const sections = Array.isArray(pageDocument.sections) ? pageDocument.sections : [];
  for (const section of sections) {
    await createSection(section, root, context);
  }

  const looseNodes = Array.isArray(pageDocument.nodes) ? pageDocument.nodes : [];
  for (const node of looseNodes) {
    await createLayer(node, root, context);
  }

  figma.viewport.scrollAndZoomIntoView([root]);
  logs.push(`Created page ${figmaPage.name} with ${Object.keys(registry).length} tracked nodes`);

  return {
    pageId: figmaPage.id,
    rootFrameId: root.id,
    nodeIds: registry,
    warnings
  };
}

function assertPageReadyForImport(pageDocument) {
  const report = analyzePageQuality(pageDocument);
  const metadata = pageDocument && pageDocument.metadata ? pageDocument.metadata : {};
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
    throw new Error(
      "This package is only baseline section slices. Run Codex recognition, create image2 transparent cutout assets, and apply recognition before importing to Figma."
    );
  }

  if (hasRecognition && metadata.recognitionComplete === false) {
    throw new Error(
      "This package has incomplete recognition. Finish pending image2 text-image or foreground cutout assets, rerun apply:recognition, then import again."
    );
  }

  if (metadata.image2ForegroundRequired === true && report.foregroundLayers === 0) {
    throw new Error(
      "This package is missing required image2 foreground layers. Create clean transparent assets with image2 background removal and rerun apply:recognition."
    );
  }

  if (flatImportMode || report.fullCanvasImages > 0) {
    throw new Error(
      "This package is a flat full-image import. A single full-canvas PNG/JPG layer is not an element-layered reconstruction."
    );
  }

  if ((fromBaselineParser || hasRecognition) && report.semanticLayers === 0) {
    throw new Error(
      "This parser package still has no element layers. Run real Codex recognition and apply text, text-image, foreground, shape, or hotspot layers before importing."
    );
  }

  if (hasRecognition && report.semanticLayers < 8) {
    throw new Error(
      `This package has only ${report.semanticLayers} semantic layer(s). Activity-page recognition must create multiple editable text, text-image, foreground, shape, or hotspot layers before importing.`
    );
  }
}

function analyzePageQuality(pageDocument) {
  const sections = Array.isArray(pageDocument.sections) ? pageDocument.sections : [];
  const canvas = pageDocument.canvas || {};
  let semanticLayers = 0;
  let fullCanvasImages = 0;
  let foregroundLayers = 0;
  for (const section of sections) {
    const report = analyzeLayerList(section.children || [], {
      x: numberOr(section.x, 0),
      y: numberOr(section.y, 0)
    }, canvas);
    semanticLayers += report.semanticLayers;
    fullCanvasImages += report.fullCanvasImages;
    foregroundLayers += report.foregroundLayers;
  }
  const looseReport = analyzeLayerList(pageDocument.nodes || [], { x: 0, y: 0 }, canvas);
  semanticLayers += looseReport.semanticLayers;
  fullCanvasImages += looseReport.fullCanvasImages;
  foregroundLayers += looseReport.foregroundLayers;
  return { semanticLayers, fullCanvasImages, foregroundLayers };
}

function analyzeLayerList(nodes, parentOffset, canvas) {
  const report = {
    semanticLayers: 0,
    fullCanvasImages: 0,
    foregroundLayers: 0
  };
  if (!Array.isArray(nodes)) {
    return report;
  }
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const layer = {
      type: node.type,
      absoluteX: parentOffset.x + numberOr(node.x, 0),
      absoluteY: parentOffset.y + numberOr(node.y, 0),
      width: numberOr(node.width, 0),
      height: numberOr(node.height, 0)
    };
    if (isSemanticLayerType(layer.type)) {
      report.semanticLayers += 1;
    }
    if (layer.type === "foregroundImage" || layer.type === "decorativeImage") {
      report.foregroundLayers += 1;
    }
    if (isFullCanvasImage(layer, canvas)) {
      report.fullCanvasImages += 1;
    }
    if (Array.isArray(node.children)) {
      const childReport = analyzeLayerList(node.children, {
        x: layer.absoluteX,
        y: layer.absoluteY
      }, canvas);
      report.semanticLayers += childReport.semanticLayers;
      report.fullCanvasImages += childReport.fullCanvasImages;
      report.foregroundLayers += childReport.foregroundLayers;
    }
  }
  return report;
}

function isSemanticLayerType(type) {
  return (
    type === "editableText" ||
    type === "text" ||
    type === "textImage" ||
    type === "foregroundImage" ||
    type === "decorativeImage" ||
    type === "shape" ||
    type === "hotspot"
  );
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

async function createSection(section, parent, context) {
  const frame = figma.createFrame();
  frame.name = section.name || section.id || "section";
  parent.appendChild(frame);
  positionNode(frame, section);
  resizeNode(frame, numberOr(section.width, parent.width), numberOr(section.height, 300));
  frame.clipsContent = Boolean(section.clipContent);
  frame.fills = section.fill ? [solidPaint(section.fill, section.opacity)] : [];
  applyEffects(frame, section);
  applyCornerRadius(frame, section);
  rememberNode(context.registry, section, frame);

  const children = Array.isArray(section.children) ? section.children : [];
  for (const child of children) {
    await createLayer(child, frame, context);
  }
}

async function createLayer(node, parent, context) {
  if (!node || typeof node !== "object") {
    return null;
  }

  switch (node.type) {
    case "backgroundImage":
    case "foregroundImage":
    case "decorativeImage":
    case "textImage":
    case "image":
      return createAssetLayer(node, parent, context);
    case "editableText":
    case "text":
      return createTextLayer(node, parent, context);
    case "shape":
      return createShapeLayer(node, parent, context);
    case "hotspot":
      return createHotspotLayer(node, parent, context);
    default:
      context.warnings.push(`Unsupported node type: ${node.type || "unknown"}`);
      return null;
  }
}

async function createAssetLayer(node, parent, context) {
  if (!node.asset) {
    context.warnings.push(`Asset node ${node.id || node.name || "unknown"} has no asset path`);
    return null;
  }

  const url = resolveAssetUrl(context.job, node.asset);
  const lowerUrl = url.split("?")[0].toLowerCase();
  if (lowerUrl.endsWith(".svg")) {
    const svg = await fetchText(url);
    const imported = figma.createNodeFromSvg(svg);
    imported.name = node.name || node.id || node.type;
    parent.appendChild(imported);
    positionNode(imported, node);
    resizeNode(imported, numberOr(node.width, imported.width), numberOr(node.height, imported.height));
    applyOpacity(imported, node);
    rememberNode(context.registry, node, imported);
    return imported;
  }

  const bytes = await fetchBytes(url);
  const image = figma.createImage(bytes);
  const rect = figma.createRectangle();
  rect.name = node.name || node.id || node.type;
  parent.appendChild(rect);
  positionNode(rect, node);
  resizeNode(rect, numberOr(node.width, 1), numberOr(node.height, 1));
  rect.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: imageScaleMode(node.fit)
    }
  ];
  applyCornerRadius(rect, node);
  applyOpacity(rect, node);
  rememberNode(context.registry, node, rect);
  return rect;
}

async function createTextLayer(node, parent, context) {
  const text = figma.createText();
  text.name = node.name || node.id || "text";
  parent.appendChild(text);

  const font = await loadBestFont(node, context.warnings);
  text.fontName = font;
  text.characters = String(node.text || "");
  text.fontSize = numberOr(node.fontSize, 16);
  text.lineHeight = node.lineHeight ? { unit: "PIXELS", value: Number(node.lineHeight) } : { unit: "AUTO" };
  text.letterSpacing = { unit: "PIXELS", value: numberOr(node.letterSpacing, 0) };
  text.textAlignHorizontal = node.textAlignHorizontal || node.align || "LEFT";
  text.textAlignVertical = node.textAlignVertical || "TOP";
  text.fills = [solidPaint(node.color || "#111111", node.opacity)];

  positionNode(text, node);
  if (node.width || node.height) {
    resizeTextNode(text, node);
  }

  rememberNode(context.registry, node, text);
  return text;
}

function createShapeLayer(node, parent, context) {
  const shape = figma.createRectangle();
  shape.name = node.name || node.id || "shape";
  parent.appendChild(shape);
  positionNode(shape, node);
  resizeNode(shape, numberOr(node.width, 1), numberOr(node.height, 1));
  shape.fills = node.fill ? [solidPaint(node.fill, node.opacity)] : [];
  if (node.stroke) {
    shape.strokes = [solidPaint(node.stroke, node.strokeOpacity)];
    shape.strokeWeight = numberOr(node.strokeWeight, 1);
  }
  applyCornerRadius(shape, node);
  applyEffects(shape, node);
  rememberNode(context.registry, node, shape);
  return shape;
}

function createHotspotLayer(node, parent, context) {
  const hotspot = figma.createRectangle();
  hotspot.name = node.name || node.id || "hotspot";
  parent.appendChild(hotspot);
  positionNode(hotspot, node);
  resizeNode(hotspot, numberOr(node.width, 1), numberOr(node.height, 1));
  hotspot.fills = [
    {
      type: "SOLID",
      color: { r: 1, g: 0, b: 0 },
      opacity: 0.01
    }
  ];
  rememberNode(context.registry, node, hotspot);
  return hotspot;
}

async function loadBestFont(node, warnings) {
  const requestedFamily = node.fontFamily || "Inter";
  const requestedStyle = node.fontStyle || styleFromWeight(node.fontWeight);
  const candidates = [
    { family: requestedFamily, style: requestedStyle },
    { family: requestedFamily, style: "Regular" },
    { family: "Inter", style: requestedStyle },
    { family: "Inter", style: "Regular" }
  ];

  const seen = {};
  for (const candidate of candidates) {
    const key = `${candidate.family}/${candidate.style}`;
    if (seen[key]) {
      continue;
    }
    seen[key] = true;
    try {
      await figma.loadFontAsync(candidate);
      if (candidate.family !== requestedFamily || candidate.style !== requestedStyle) {
        warnings.push(`Font fallback for "${node.text || node.id || "text"}": ${requestedFamily}/${requestedStyle} -> ${candidate.family}/${candidate.style}`);
      }
      return candidate;
    } catch (error) {
      // Try the next candidate.
    }
  }

  throw new Error(`Unable to load a usable font for ${requestedFamily}/${requestedStyle}`);
}

function styleFromWeight(weight) {
  const numeric = Number(weight || 400);
  if (numeric >= 700) {
    return "Bold";
  }
  if (numeric >= 600) {
    return "Semi Bold";
  }
  if (numeric >= 500) {
    return "Medium";
  }
  return "Regular";
}

function resolveAssetUrl(job, asset) {
  if (/^https?:\/\//i.test(asset) || /^data:/i.test(asset)) {
    return asset;
  }

  const base = job.assetsBaseUrl || "";
  const encoded = String(asset)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}${encoded}`;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function solidPaint(hex, opacity) {
  return {
    type: "SOLID",
    color: parseHexColor(hex),
    opacity: opacity === undefined ? 1 : Number(opacity)
  };
}

function parseHexColor(input) {
  const value = String(input || "#000000").trim();
  const shortMatch = value.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    const chars = shortMatch[1].split("");
    return {
      r: Number.parseInt(chars[0] + chars[0], 16) / 255,
      g: Number.parseInt(chars[1] + chars[1], 16) / 255,
      b: Number.parseInt(chars[2] + chars[2], 16) / 255
    };
  }

  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return { r: 0, g: 0, b: 0 };
  }

  const raw = match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16) / 255,
    g: Number.parseInt(raw.slice(2, 4), 16) / 255,
    b: Number.parseInt(raw.slice(4, 6), 16) / 255
  };
}

function imageScaleMode(fit) {
  if (fit === "contain") {
    return "FIT";
  }
  if (fit === "crop") {
    return "CROP";
  }
  if (fit === "tile") {
    return "TILE";
  }
  return "FILL";
}

function positionNode(figmaNode, source) {
  figmaNode.x = numberOr(source.x, 0);
  figmaNode.y = numberOr(source.y, 0);
  if (source.rotation) {
    figmaNode.rotation = Number(source.rotation);
  }
}

function resizeNode(figmaNode, width, height) {
  if (typeof figmaNode.resizeWithoutConstraints === "function") {
    figmaNode.resizeWithoutConstraints(width, height);
    return;
  }
  if (typeof figmaNode.resize === "function") {
    figmaNode.resize(width, height);
  }
}

function resizeTextNode(text, node) {
  const width = numberOr(node.width, text.width);
  const height = numberOr(node.height, text.height);
  text.resize(width, height);
}

function applyCornerRadius(figmaNode, source) {
  if (source.cornerRadius === undefined || figmaNode.cornerRadius === undefined) {
    return;
  }
  figmaNode.cornerRadius = Number(source.cornerRadius);
}

function applyOpacity(figmaNode, source) {
  if (source.opacity !== undefined) {
    figmaNode.opacity = Number(source.opacity);
  }
}

function applyEffects(figmaNode, source) {
  if (!Array.isArray(source.effects)) {
    return;
  }

  figmaNode.effects = source.effects
    .filter((effect) => effect && effect.type === "dropShadow")
    .map((effect) => {
      const color = parseHexColor(effect.color || "#000000");
      return {
        type: "DROP_SHADOW",
        color: {
          r: color.r,
          g: color.g,
          b: color.b,
          a: effect.opacity === undefined ? 0.2 : Number(effect.opacity)
        },
        offset: {
          x: numberOr(effect.x, 0),
          y: numberOr(effect.y, 4)
        },
        radius: numberOr(effect.blur, 12),
        spread: numberOr(effect.spread, 0),
        visible: true,
        blendMode: "NORMAL"
      };
    });
}

function rememberNode(registry, source, figmaNode) {
  if (source.id) {
    registry[source.id] = figmaNode.id;
  }
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function uniquePageName(baseName) {
  const existing = {};
  for (const page of figma.root.children) {
    existing[page.name] = true;
  }
  if (!existing[baseName]) {
    return baseName;
  }

  let index = 2;
  while (existing[`${baseName} ${index}`]) {
    index += 1;
  }
  return `${baseName} ${index}`;
}
