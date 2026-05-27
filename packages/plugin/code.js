const UI_HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"utf-8\">\n  <style>\n    :root {\n      color-scheme: light;\n      font-family: Inter, \"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif;\n      --bg: #f5f6f8;\n      --panel: #ffffff;\n      --line: #d8dde6;\n      --ink: #1f2328;\n      --muted: #6b7280;\n      --blue: #1677ff;\n      --danger: #b42318;\n    }\n    * { box-sizing: border-box; }\n    html, body { width: 100%; height: 100%; }\n    body { margin: 0; background: var(--bg); color: var(--ink); font-size: 12px; overflow: hidden; }\n    button, input, select, textarea { font: inherit; }\n    button {\n      height: 32px;\n      border: 1px solid var(--line);\n      border-radius: 7px;\n      background: var(--blue);\n      color: #fff;\n      padding: 0 12px;\n      font-weight: 700;\n      cursor: pointer;\n      white-space: nowrap;\n    }\n    button.secondary { background: #fff; color: var(--ink); }\n    button.ghost { background: transparent; color: var(--ink); }\n    button.danger { background: #fee4e2; color: var(--danger); }\n    button:disabled { opacity: .45; cursor: default; }\n    input, select, textarea {\n      width: 100%;\n      border: 1px solid var(--line);\n      border-radius: 7px;\n      background: #fff;\n      color: var(--ink);\n      padding: 7px 9px;\n    }\n    textarea { min-height: 64px; resize: vertical; line-height: 1.45; }\n    label { display: block; margin: 0 0 5px; color: #565f6b; font-weight: 700; }\n    header {\n      height: 52px;\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      gap: 12px;\n      padding: 10px 12px;\n      background: #fff;\n      border-bottom: 1px solid var(--line);\n    }\n    h1 { margin: 0; font-size: 15px; line-height: 20px; }\n    .tabs { display: flex; gap: 6px; }\n    .tab { background: #f0f2f5; color: var(--ink); }\n    .tab.active { background: var(--blue); color: #fff; }\n    .view { display: none; }\n    .view.active { display: block; }\n    #importView { padding: 14px; }\n    .bridgeRow { display: grid; grid-template-columns: 110px minmax(240px, 1fr) auto auto auto; gap: 8px; align-items: end; margin-bottom: 12px; }\n    .status { display: grid; grid-template-columns: 80px 1fr; gap: 6px 10px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; max-width: 420px; }\n    .status span:nth-child(odd), .small { color: var(--muted); }\n    pre { margin: 0; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #fff; color: var(--ink); white-space: pre-wrap; overflow: auto; }\n    #log { min-height: 260px; max-height: 360px; }\n    #annotateView.active { height: calc(100vh - 52px); }\n    .annotateLayout {\n      width: 100%;\n      height: 100%;\n      display: grid;\n      grid-template-columns: minmax(0, 1fr) 340px;\n      min-height: 0;\n    }\n    .canvasPane { min-width: 0; min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }\n    .canvasToolbar {\n      height: 48px;\n      display: flex;\n      align-items: center;\n      gap: 8px;\n      padding: 8px 10px;\n      background: #fff;\n      border-bottom: 1px solid var(--line);\n    }\n    .canvasToolbar select { width: 118px; }\n    .sourceName { min-width: 0; flex: 1; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n    .canvasViewport {\n      flex: 1;\n      min-height: 0;\n      overflow: auto;\n      background: #e8eaee;\n      padding: 12px;\n      position: relative;\n    }\n    .dropEmpty {\n      min-height: 100%;\n      border: 1px dashed #aeb6c4;\n      border-radius: 12px;\n      background: rgba(255,255,255,.72);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      text-align: center;\n      color: var(--muted);\n      line-height: 1.8;\n    }\n    .stage {\n      position: relative;\n      width: fit-content;\n      background: #fff;\n      box-shadow: 0 10px 34px rgba(0,0,0,.18);\n      transform-origin: top left;\n    }\n    #sourceImage { display: none; user-select: none; pointer-events: none; }\n    #overlay { display: none; position: absolute; inset: 0; cursor: crosshair; touch-action: none; }\n    .sidePanel { min-height: 0; overflow: auto; background: #fff; padding: 10px; }\n    .sideHeader { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }\n    .sideHeader strong { font-size: 14px; }\n    .submit { width: 100%; margin-bottom: 10px; }\n    .layerList { display: grid; gap: 8px; }\n    .addCard {\n      border: 1px dashed #9ab8ef;\n      border-radius: 10px;\n      padding: 12px;\n      background: #f4f8ff;\n      color: #155eef;\n      font-weight: 800;\n      text-align: center;\n      cursor: pointer;\n    }\n    .layerCard {\n      border: 1px solid #e5e7eb;\n      border-radius: 10px;\n      padding: 9px;\n      background: #fff;\n    }\n    .layerCard.active { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(22,119,255,.14); }\n    .layerTop { display: grid; grid-template-columns: 12px minmax(0, 1fr) 118px 30px; gap: 7px; align-items: center; }\n    .swatch { width: 10px; height: 10px; border-radius: 50%; }\n    .layerName { height: 30px; font-weight: 700; }\n    .layerType { height: 30px; padding: 0 7px; }\n    .deleteBtn { width: 30px; height: 30px; padding: 0; }\n    .layerMeta { margin-top: 6px; color: var(--muted); font-size: 11px; }\n    .layerBody { display: none; margin-top: 8px; }\n    .layerCard.active .layerBody { display: block; }\n    .elementTools { display: flex; align-items: center; gap: 8px; margin: 8px 0; }\n    .elementBtn { flex: 0 0 auto; }\n    .hint { color: var(--muted); font-size: 11px; line-height: 1.45; }\n    .elementList { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 8px; }\n    .elementChip {\n      display: inline-flex;\n      align-items: center;\n      gap: 5px;\n      max-width: 100%;\n      min-height: 24px;\n      padding: 2px 4px 2px 7px;\n      border: 1px solid #fed7aa;\n      border-radius: 6px;\n      background: #fff7ed;\n      color: #9a3412;\n      font-weight: 800;\n    }\n    .elementChip::before {\n      content: \"\";\n      width: 10px;\n      height: 10px;\n      border: 2px solid #f97316;\n      border-radius: 2px;\n      background: #fff;\n    }\n    .elementDelete {\n      width: 20px;\n      height: 20px;\n      padding: 0;\n      border-radius: 5px;\n      background: #ffedd5;\n      color: #9a3412;\n      border-color: #fed7aa;\n      line-height: 18px;\n    }\n    .warning, .ok, .pending {\n      border-radius: 8px;\n      padding: 8px;\n      margin-bottom: 8px;\n      line-height: 1.45;\n    }\n    .warning { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }\n    .ok { background: #ecfdf3; color: #067647; border: 1px solid #abefc6; }\n    .pending { background: #eff6ff; color: #175cd3; border: 1px solid #b2ddff; }\n    .hidden { display: none; }\n    .resizeHandle { position: fixed; z-index: 50; background: transparent; }\n    .resizeHandle.n { top: 0; left: 14px; right: 14px; height: 8px; cursor: ns-resize; }\n    .resizeHandle.s { bottom: 0; left: 14px; right: 14px; height: 8px; cursor: ns-resize; }\n    .resizeHandle.e { top: 14px; right: 0; bottom: 14px; width: 8px; cursor: ew-resize; }\n    .resizeHandle.w { top: 14px; left: 0; bottom: 14px; width: 8px; cursor: ew-resize; }\n    .resizeHandle.ne { top: 0; right: 0; width: 16px; height: 16px; cursor: nesw-resize; }\n    .resizeHandle.nw { top: 0; left: 0; width: 16px; height: 16px; cursor: nwse-resize; }\n    .resizeHandle.se { right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }\n    .resizeHandle.sw { left: 0; bottom: 0; width: 16px; height: 16px; cursor: nesw-resize; }\n    body.resizingWindow, body.resizingWindow * { user-select: none; }\n  </style>\n</head>\n<body>\n  <header>\n    <div>\n      <h1>CodeUi-to-Figma</h1>\n    </div>\n    <div class=\"tabs\">\n      <button class=\"tab active\" id=\"tabImport\">导入轮询</button>\n      <button class=\"tab\" id=\"tabAnnotate\">标注工作台</button>\n    </div>\n  </header>\n\n  <section class=\"view active\" id=\"importView\">\n    <div class=\"bridgeRow\">\n      <label>Bridge URL</label>\n      <input id=\"bridgeUrl\" value=\"http://localhost:39217\">\n      <button id=\"startButton\">开始轮询</button>\n      <button id=\"onceButton\" class=\"secondary\">执行一次</button>\n      <button id=\"stopButton\" class=\"secondary\" disabled>停止</button>\n    </div>\n    <div class=\"status\">\n      <span>状态</span><strong id=\"state\">idle</strong>\n      <span>最后任务</span><strong id=\"lastJob\">none</strong>\n      <span>Bridge</span><strong id=\"bridgeState\">not checked</strong>\n    </div>\n    <div style=\"height:12px\"></div>\n    <pre id=\"log\"></pre>\n  </section>\n\n  <section class=\"view\" id=\"annotateView\">\n    <div class=\"annotateLayout\">\n      <div class=\"canvasPane\">\n        <div class=\"canvasToolbar\">\n          <button id=\"chooseImage\">添加 UI 图</button>\n          <input id=\"fileInput\" class=\"hidden\" type=\"file\" accept=\"image/png,image/jpeg,image/webp\">\n          <label style=\"margin:0\">预览比例</label>\n          <select id=\"scaleSelect\">\n            <option value=\"fit\" selected>适应宽度</option>\n            <option value=\"0.25\">25%</option>\n            <option value=\"0.5\">50%</option>\n            <option value=\"0.75\">75%</option>\n            <option value=\"1\">100%</option>\n            <option value=\"1.5\">150%</option>\n          </select>\n          <span class=\"sourceName\" id=\"sourceName\">拖拽 PNG/JPG/WebP 到画布，或点击添加。</span>\n        </div>\n        <div class=\"canvasViewport\" id=\"viewport\">\n          <div class=\"dropEmpty\" id=\"dropEmpty\">\n            <div>拖拽 UI 图到这里<br>页面会按 750px 宽度等比记录坐标</div>\n          </div>\n          <div class=\"stage\" id=\"stage\">\n            <img id=\"sourceImage\" alt=\"活动页源图\">\n            <canvas id=\"overlay\"></canvas>\n          </div>\n        </div>\n      </div>\n      <aside class=\"sidePanel\">\n        <div class=\"sideHeader\">\n          <strong>框选图层</strong>\n          <span class=\"small\" id=\"regionCount\">0 个区域</span>\n        </div>\n        <button class=\"submit\" id=\"saveHandoff\" disabled>保存并提交给 Codex</button>\n        <div id=\"annotationStatus\" class=\"small\"></div>\n        <div class=\"layerList\" id=\"regions\"></div>\n      </aside>\n    </div>\n  </section>\n\n  <div class=\"resizeHandle n\" data-resize=\"n\" title=\"向上拖拽调整窗口高度\"></div>\n  <div class=\"resizeHandle s\" data-resize=\"s\" title=\"向下拖拽调整窗口高度\"></div>\n  <div class=\"resizeHandle e\" data-resize=\"e\" title=\"向右拖拽调整窗口宽度\"></div>\n  <div class=\"resizeHandle w\" data-resize=\"w\" title=\"向左拖拽调整窗口宽度\"></div>\n  <div class=\"resizeHandle ne\" data-resize=\"ne\" title=\"拖拽调整窗口大小\"></div>\n  <div class=\"resizeHandle nw\" data-resize=\"nw\" title=\"拖拽调整窗口大小\"></div>\n  <div class=\"resizeHandle se\" data-resize=\"se\" title=\"拖拽调整窗口大小\"></div>\n  <div class=\"resizeHandle sw\" data-resize=\"sw\" title=\"拖拽调整窗口大小\"></div>\n\n  <script>\n    var bridgeInput = document.getElementById('bridgeUrl');\n    var startButton = document.getElementById('startButton');\n    var onceButton = document.getElementById('onceButton');\n    var stopButton = document.getElementById('stopButton');\n    var stateNode = document.getElementById('state');\n    var lastJobNode = document.getElementById('lastJob');\n    var bridgeStateNode = document.getElementById('bridgeState');\n    var logNode = document.getElementById('log');\n    var polling = false;\n    var busy = false;\n    var currentJob = null;\n    var timer = null;\n    bridgeInput.value = readStored('bridgeUrl') || bridgeInput.value;\n\n    bindClick(document.getElementById('tabImport'), function () { setTab('import'); });\n    bindClick(document.getElementById('tabAnnotate'), function () { setTab('annotate'); });\n    bindClick(startButton, function () { appendLog('开始轮询'); polling = true; startButton.disabled = true; stopButton.disabled = false; onceButton.disabled = true; tick(); });\n    bindClick(onceButton, function () { appendLog('执行一次'); if (!busy) tick({ single: true }); });\n    bindClick(stopButton, function () { polling = false; startButton.disabled = false; stopButton.disabled = true; onceButton.disabled = false; setState('stopped'); if (timer) { clearTimeout(timer); timer = null; } });\n    bridgeInput.onchange = function () { writeStored('bridgeUrl', bridgeInput.value.trim()); };\n\n    setTimeout(function () {\n      if (!polling) {\n        appendLog('自动轮询已启动');\n        polling = true;\n        startButton.disabled = true;\n        stopButton.disabled = false;\n        onceButton.disabled = true;\n        tick();\n      }\n    }, 300);\n\n    window.onmessage = async function (event) {\n      var message = event.data.pluginMessage;\n      if (!message || message.type !== 'job-result') return;\n      await postResult(message);\n      busy = false;\n      currentJob = null;\n      if (polling) timer = setTimeout(function () { tick(); }, 1000);\n      else setState('idle');\n    };\n\n    async function tick(options) {\n      options = options || {};\n      if (busy) return;\n      try {\n        setState('checking');\n        var response = await fetch(getBridgeUrl() + '/api/figma-bridge/jobs/next?clientId=figma-plugin');\n        bridgeStateNode.textContent = response.ok ? 'connected' : 'HTTP ' + response.status;\n        if (!response.ok) throw new Error('Bridge returned ' + response.status);\n        var queue = await response.json();\n        if (!queue.job) {\n          setState('idle');\n          appendLog('No queued job');\n          if (polling && !options.single) timer = setTimeout(function () { tick(); }, 1500);\n          return;\n        }\n        busy = true;\n        currentJob = queue.job;\n        lastJobNode.textContent = queue.job.id;\n        setState('executing');\n        appendLog('Claimed ' + queue.job.id);\n        parent.postMessage({ pluginMessage: { type: 'execute-job', job: queue.job } }, '*');\n      } catch (error) {\n        bridgeStateNode.textContent = 'error';\n        appendLog(error.message || String(error));\n        setState('error');\n        if (polling && !options.single) timer = setTimeout(function () { tick(); }, 2500);\n      }\n    }\n\n    async function postResult(message) {\n      var jobId = message.jobId || (currentJob && currentJob.id);\n      if (!jobId) { appendLog('Cannot post result without job id'); return; }\n      var response = await fetch(getBridgeUrl() + '/api/figma-bridge/jobs/' + jobId + '/result', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ status: message.status, result: message.result || null, error: message.error || null, logs: message.logs || [] })\n      });\n      if (!response.ok) { appendLog('Failed to post result for ' + jobId + ': HTTP ' + response.status); return; }\n      appendLog(jobId + ' ' + message.status);\n      if (message.error && message.error.message) appendLog(message.error.message);\n      setState(message.status);\n    }\n\n    var roleColors = { heroImage:'#ef4444', moduleBackground:'#1677ff', tabGroup:'#7c3aed', selectedTab:'#22c55e', button:'#22c55e', icon:'#eab308', artText:'#f97316', foreground:'#d97706', shape:'#14b8a6', text:'#0ea5e9', ignore:'#6b7280' };\n    var roleLabels = { heroImage:'完整头图', moduleBackground:'区域背景', tabGroup:'Tab 组', selectedTab:'选中态', button:'按钮', icon:'图标', artText:'艺术字', foreground:'前景素材', shape:'形状', text:'文字', ignore:'忽略' };\n    var roleOrder = ['moduleBackground','heroImage','tabGroup','selectedTab','button','icon','artText','foreground','shape','text','ignore'];\n    var sourceFile = null;\n    var sourceDataUrl = '';\n    var data = null;\n    var selectedIndex = -1;\n    var addMode = false;\n    var elementAddMode = false;\n    var dragMode = null;\n    var dragHandle = null;\n    var dragOrigin = null;\n    var originalBox = null;\n    var startPoint = null;\n    var draft = null;\n    var zoom = 1;\n    var undoStack = [];\n    var redoStack = [];\n    var fieldEditKey = '';\n    var caretByRegion = {};\n    var pendingDragSnapshot = null;\n    var elementDeleteHits = [];\n    var img = document.getElementById('sourceImage');\n    var canvas = document.getElementById('overlay');\n    var ctx = canvas.getContext('2d');\n    var stage = document.getElementById('stage');\n    var viewport = document.getElementById('viewport');\n    var fileInput = document.getElementById('fileInput');\n    var dropEmpty = document.getElementById('dropEmpty');\n    var pluginResizeState = null;\n\n    bindClick(document.getElementById('chooseImage'), function () { fileInput.click(); });\n    bindClick(document.getElementById('saveHandoff'), saveHandoff);\n    fileInput.onchange = function () { if (fileInput.files && fileInput.files[0]) loadImageFile(fileInput.files[0]); };\n    document.getElementById('scaleSelect').onchange = function () { applyZoomChoice(); };\n    window.onresize = function () { if (data && document.getElementById('scaleSelect').value === 'fit') applyZoomChoice(); };\n    viewport.ondragover = function (event) { event.preventDefault(); };\n    viewport.ondrop = function (event) {\n      event.preventDefault();\n      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];\n      if (file) loadImageFile(file);\n    };\n    Array.prototype.forEach.call(document.querySelectorAll('[data-resize]'), function (node) {\n      node.onmousedown = function (event) {\n        event.preventDefault();\n        event.stopPropagation();\n        pluginResizeState = {\n          edge: node.getAttribute('data-resize'),\n          x: event.clientX,\n          y: event.clientY,\n          width: window.innerWidth,\n          height: window.innerHeight\n        };\n        document.body.classList.add('resizingWindow');\n      };\n    });\n    window.addEventListener('mousemove', resizePluginWindow);\n    window.addEventListener('mouseup', stopPluginWindowResize);\n\n    canvas.onmousedown = function (event) {\n      var deleted = deleteElementFromCanvas(event);\n      if (deleted) return;\n      beginCanvasDrag(event, false);\n    };\n    canvas.onmousemove = function (event) {\n      if (!data || dragMode) return;\n      updateCursor(pointer(event));\n    };\n    viewport.addEventListener('mousedown', function (event) {\n      if (!data || event.button !== 0 || event.target !== viewport) return;\n      beginCanvasDrag(event, true);\n    });\n    window.addEventListener('mousemove', handleCanvasMove);\n    window.addEventListener('mouseup', finishCanvasDrag);\n    window.addEventListener('keydown', handleShortcut);\n\n    function beginCanvasDrag(event, fromViewport) {\n      if (!data || event.button !== 0) return;\n      event.preventDefault();\n      var point = pointer(event);\n      if (elementAddMode) {\n        if (selectedIndex < 0 || !data.regions[selectedIndex]) {\n          elementAddMode = false;\n          setAnnotationStatus('请先选中一个大区域，再添加元素引用框。', 'error');\n          render();\n          return;\n        }\n        var parentBox = data.regions[selectedIndex].bbox;\n        point = clampPointToBox(point, parentBox);\n        dragMode = 'drawElement';\n        startPoint = point;\n        draft = { x: point.x, y: point.y, width: 0, height: 0 };\n        draw();\n        return;\n      }\n\n      var handle = fromViewport || addMode ? null : hitHandle(point);\n      var hitIndex = handle ? selectedIndex : (fromViewport || addMode ? -1 : hitRegion(point));\n      if (handle && selectedIndex >= 0) {\n        dragMode = 'resize';\n        dragHandle = handle;\n        dragOrigin = point;\n        originalBox = cloneBox(data.regions[selectedIndex].bbox);\n        pendingDragSnapshot = snapshotState();\n      } else if (hitIndex >= 0 && !addMode) {\n        selectedIndex = hitIndex;\n        dragMode = 'move';\n        dragOrigin = point;\n        originalBox = cloneBox(data.regions[selectedIndex].bbox);\n        pendingDragSnapshot = snapshotState();\n      } else {\n        selectedIndex = -1;\n        addMode = true;\n        dragMode = 'draw';\n        startPoint = point;\n        draft = { x: point.x, y: point.y, width: 0, height: 0 };\n      }\n      render();\n    }\n\n    function handleCanvasMove(event) {\n      if (!data || !dragMode) return;\n      var point = pointer(event);\n      if (dragMode === 'draw' && startPoint) {\n        draft = normalizeRect(startPoint.x, startPoint.y, point.x, point.y);\n      } else if (dragMode === 'drawElement' && startPoint && selectedIndex >= 0) {\n        var parentBox = data.regions[selectedIndex].bbox;\n        var bounded = clampPointToBox(point, parentBox);\n        draft = normalizeRect(startPoint.x, startPoint.y, bounded.x, bounded.y, parentBox);\n      } else if (dragMode === 'move' && selectedIndex >= 0) {\n        data.regions[selectedIndex].bbox = clampBox({ x: originalBox.x + point.x - dragOrigin.x, y: originalBox.y + point.y - dragOrigin.y, width: originalBox.width, height: originalBox.height });\n      } else if (dragMode === 'resize' && selectedIndex >= 0) {\n        data.regions[selectedIndex].bbox = resizeBox(originalBox, dragHandle, point);\n      }\n      draw();\n    }\n\n    function finishCanvasDrag() {\n      if (!dragMode) return;\n      if (dragMode === 'draw' && draft && draft.width >= 4 && draft.height >= 4) {\n        addRegion(draft);\n      } else if (dragMode === 'drawElement' && draft && draft.width >= 3 && draft.height >= 3 && selectedIndex >= 0) {\n        addElementToRegion(selectedIndex, draft);\n      } else if ((dragMode === 'move' || dragMode === 'resize') && pendingDragSnapshot && pendingDragSnapshot !== snapshotState()) {\n        pushSnapshot(pendingDragSnapshot);\n      }\n      startPoint = null;\n      dragMode = null;\n      dragHandle = null;\n      dragOrigin = null;\n      originalBox = null;\n      draft = null;\n      addMode = false;\n      elementAddMode = false;\n      pendingDragSnapshot = null;\n      render();\n    }\n\n    async function loadImageFile(file) {\n      if (!/^image\\/(png|jpeg|webp)$/.test(file.type)) {\n        setAnnotationStatus('只支持 PNG、JPG、WebP。', 'error');\n        return;\n      }\n      sourceFile = file;\n      sourceDataUrl = await readFileAsDataUrl(file);\n      var probe = await loadImageProbe(sourceDataUrl);\n      var scale = 750 / probe.width;\n      var canvasHeight = Math.round(probe.height * scale);\n      data = {\n        version: 'manual-annotations.v0.3',\n        sourceImage: file.name,\n        canvas: { width: 750, height: canvasHeight },\n        sourceImageOriginal: { width: probe.width, height: probe.height, fileName: file.name, mimeType: file.type },\n        normalization: { targetWidth: 750, scale: scale, coordinateSystem: '所有 bbox 坐标均为按 750px 宽度等比缩放后的页面坐标。' },\n        recognitionWorkflow: buildRecognitionWorkflow(),\n        regions: []\n      };\n      undoStack = [];\n      redoStack = [];\n      caretByRegion = {};\n      fieldEditKey = '';\n      img.src = sourceDataUrl;\n      img.style.display = 'block';\n      canvas.style.display = 'block';\n      dropEmpty.style.display = 'none';\n      selectedIndex = -1;\n      setAnnotationStatus('已添加 UI 图。点击“添加框选区域”后在画布拖拽框选。', 'ok');\n      document.getElementById('sourceName').textContent = file.name + '，原始 ' + probe.width + ' x ' + probe.height + '，按 750px 宽记录。';\n      applyZoomChoice();\n      render();\n    }\n\n    function buildRecognitionWorkflow() {\n      return {\n        targetCanvasWidth: 750,\n        removePhoneSystemBars: true,\n        requireImage2ForTransparentAssets: true,\n        reconstructionRule: 'Codex 返回分层 page.json 后，Figma 拼接页面时应隐藏原图；所有元素必须按原图位置和尺寸完全覆盖源图。',\n        order: [\n          '页面先按 750px 宽度等比归一化，记录归一化后的坐标。',\n          '识别整页底色并作为 Figma 根 Frame 填充。',\n          '去除顶部电池条、底部安全条等手机系统元素。',\n          '按框选类型优先处理文字，识别文本内容、字体、字号、字重、颜色、坐标和尺寸。',\n          '从页面中清除已识别文字后，分离 Tab、按钮、图标，透明素材全部使用 image2 去背景。',\n          '识别完整头图位置；头图默认保持整张图，不拆内部人物、奖杯或艺术字。',\n          '最后识别每个区域背景，裁切为有业务意义的背景图。'\n        ]\n      };\n    }\n\n    function resizePluginWindow(event) {\n      if (!pluginResizeState) return;\n      event.preventDefault();\n      var dx = event.clientX - pluginResizeState.x;\n      var dy = event.clientY - pluginResizeState.y;\n      var width = pluginResizeState.width;\n      var height = pluginResizeState.height;\n      if (pluginResizeState.edge.indexOf('e') !== -1) width += dx;\n      if (pluginResizeState.edge.indexOf('w') !== -1) width -= dx;\n      if (pluginResizeState.edge.indexOf('s') !== -1) height += dy;\n      if (pluginResizeState.edge.indexOf('n') !== -1) height -= dy;\n      width = Math.max(760, Math.min(1800, Math.round(width)));\n      height = Math.max(560, Math.min(1300, Math.round(height)));\n      parent.postMessage({ pluginMessage: { type: 'resize-ui', width: width, height: height } }, '*');\n    }\n\n    function stopPluginWindowResize() {\n      if (!pluginResizeState) return;\n      pluginResizeState = null;\n      document.body.classList.remove('resizingWindow');\n      setTimeout(applyZoomChoice, 0);\n    }\n\n    function addRegion(bbox) {\n      if (!data) return;\n      pushHistory();\n      var role = 'moduleBackground';\n      var id = nextRegionId(role);\n      data.regions.push({ id: id, role: role, label: '未命名区域', bbox: clampBox(bbox), instruction: '', priority: 'high', elements: [] });\n      selectedIndex = data.regions.length - 1;\n      setAnnotationStatus('已新增框选区域，请在右侧填写名称、类型和备注。', 'pending');\n    }\n\n    function addElementToRegion(regionIndex, bbox) {\n      var region = data && data.regions && data.regions[regionIndex];\n      if (!region) return;\n      pushHistory();\n      if (!Array.isArray(region.elements)) region.elements = [];\n      var id = nextElementId();\n      region.elements.push({\n        id: id,\n        role: 'element',\n        label: id,\n        bbox: clampBoxTo(bbox, region.bbox),\n        reference: '[' + id + ']'\n      });\n      selectedIndex = regionIndex;\n      insertElementReference(regionIndex, id);\n      setAnnotationStatus('已添加元素引用框 [' + id + ']，备注里已插入引用。', 'ok');\n      focusInstruction(regionIndex);\n    }\n\n    function deleteElement(regionIndex, elementIndex) {\n      var region = data && data.regions && data.regions[regionIndex];\n      if (!region || !Array.isArray(region.elements) || !region.elements[elementIndex]) return;\n      pushHistory();\n      var removed = region.elements.splice(elementIndex, 1)[0];\n      removeElementReference(region, removed.id);\n      selectedIndex = regionIndex;\n      setAnnotationStatus('已删除元素引用框 [' + removed.id + ']。', 'pending');\n      render();\n      focusInstruction(regionIndex);\n    }\n\n    function render() {\n      draw();\n      renderLayerList();\n      updateSubmitState();\n    }\n\n    function renderLayerList() {\n      var list = document.getElementById('regions');\n      var count = data && Array.isArray(data.regions) ? data.regions.length : 0;\n      document.getElementById('regionCount').textContent = count + ' 个区域';\n      var html = '<div class=\"addCard\" data-add=\"1\">添加框选区域</div>';\n      if (!data) {\n        list.innerHTML = html;\n        return;\n      }\n      html += data.regions.map(function (region, index) {\n        var color = roleColors[region.role] || '#1677ff';\n        var active = index === selectedIndex;\n        var elements = Array.isArray(region.elements) ? region.elements : [];\n        return '<div class=\"layerCard ' + (active ? 'active' : '') + '\" data-index=\"' + index + '\">' +\n          '<div class=\"layerTop\">' +\n          '<span class=\"swatch\" style=\"background:' + color + '\"></span>' +\n          '<input class=\"layerName\" data-field=\"label\" data-index=\"' + index + '\" value=\"' + escapeAttr(region.label || '') + '\" placeholder=\"区域名称\">' +\n          '<select class=\"layerType\" data-field=\"role\" data-index=\"' + index + '\">' + roleOptions(region.role) + '</select>' +\n          '<button class=\"danger deleteBtn\" data-delete=\"' + index + '\">删</button>' +\n          '</div>' +\n          '<div class=\"layerMeta\">' + escapeHtml(region.id || '') + ' / ' + bboxText(region.bbox) + '</div>' +\n          '<div class=\"layerBody\">' +\n          '<label>备注</label>' +\n          '<textarea data-field=\"instruction\" data-index=\"' + index + '\" placeholder=\"写清楚这个区域怎么拆层：哪些转文字，哪些是按钮/Tab/图标，哪些需要 image2 透明素材，哪些保留背景。\">' + escapeHtml(region.instruction || '') + '</textarea>' +\n          '<div class=\"elementTools\">' +\n          '<button class=\"secondary elementBtn\" data-add-element=\"' + index + '\">框选元素引用</button>' +\n          '<span class=\"hint\">在当前区域内继续框选元素，自动插入 [元素ID]。</span>' +\n          '</div>' +\n          renderElementChips(elements, index) +\n          '</div>' +\n          '</div>';\n      }).join('');\n      list.innerHTML = html;\n    }\n\n    function markActiveCard(index) {\n      Array.prototype.forEach.call(document.querySelectorAll('.layerCard'), function (card) {\n        card.classList.toggle('active', Number(card.getAttribute('data-index')) === index);\n      });\n    }\n\n    function renderElementChips(elements, regionIndex) {\n      if (!elements.length) {\n        return '<div class=\"hint\">暂无元素引用框。适合标记区域内的按钮、Tab 选中态、图标、艺术字、局部前景。</div>';\n      }\n      return '<div class=\"elementList\">' + elements.map(function (element, elementIndex) {\n        return '<span class=\"elementChip\" title=\"' + escapeAttr(bboxText(element.bbox)) + '\">' +\n          escapeHtml(element.id || ('el_' + (elementIndex + 1))) +\n          '<button class=\"elementDelete\" data-delete-element=\"' + regionIndex + ':' + elementIndex + '\">×</button>' +\n          '</span>';\n      }).join('') + '</div>';\n    }\n\n    var regionsNode = document.getElementById('regions');\n    regionsNode.addEventListener('mousedown', function (event) {\n      if (event.target.closest('input,select,textarea')) event.stopPropagation();\n      rememberInstructionCaret(event.target);\n    });\n    regionsNode.addEventListener('focusin', function (event) {\n      var index = event.target.getAttribute('data-index');\n      if (index !== null) {\n        selectedIndex = Number(index);\n        markActiveCard(selectedIndex);\n        draw();\n      }\n      rememberInstructionCaret(event.target);\n    });\n    regionsNode.addEventListener('focusout', function (event) {\n      rememberInstructionCaret(event.target);\n      fieldEditKey = '';\n    });\n    regionsNode.addEventListener('keyup', function (event) {\n      rememberInstructionCaret(event.target);\n    });\n    regionsNode.addEventListener('click', function (event) {\n      rememberInstructionCaret(event.target);\n      var addNode = event.target.closest('[data-add]');\n      if (addNode) {\n        if (!data) { setAnnotationStatus('请先添加 UI 图。', 'error'); return; }\n        selectedIndex = -1;\n        addMode = true;\n        elementAddMode = false;\n        setAnnotationStatus('在画布上拖拽，创建新的框选区域。', 'pending');\n        render();\n        return;\n      }\n      var addElementNode = event.target.closest('[data-add-element]');\n      if (addElementNode) {\n        var addElementIndex = Number(addElementNode.getAttribute('data-add-element'));\n        if (!data || !data.regions[addElementIndex]) return;\n        rememberActiveInstructionCaret();\n        selectedIndex = addElementIndex;\n        addMode = false;\n        elementAddMode = true;\n        setAnnotationStatus('在左侧当前大区域内拖拽，创建元素引用框。', 'pending');\n        render();\n        return;\n      }\n      var delElement = event.target.closest('[data-delete-element]');\n      if (delElement) {\n        event.stopPropagation();\n        var parts = String(delElement.getAttribute('data-delete-element')).split(':');\n        deleteElement(Number(parts[0]), Number(parts[1]));\n        return;\n      }\n      var del = event.target.closest('[data-delete]');\n      if (del) {\n        event.stopPropagation();\n        var deleteIndex = Number(del.getAttribute('data-delete'));\n        pushHistory();\n        data.regions.splice(deleteIndex, 1);\n        selectedIndex = -1;\n        render();\n        return;\n      }\n      var card = event.target.closest('[data-index]');\n      if (card && !event.target.matches('input,select,textarea,button')) {\n        selectedIndex = Number(card.getAttribute('data-index'));\n        render();\n      }\n    });\n\n    regionsNode.oninput = function (event) {\n      updateRegionField(event.target);\n    };\n    regionsNode.onchange = function (event) {\n      updateRegionField(event.target);\n    };\n\n    function updateRegionField(target) {\n      if (!data || !target || target.getAttribute('data-index') === null) return;\n      var index = Number(target.getAttribute('data-index'));\n      var field = target.getAttribute('data-field');\n      if (!data.regions[index] || !field) return;\n      var fieldKey = index + ':' + field;\n      if (target.tagName === 'SELECT' || fieldEditKey !== fieldKey) {\n        pushHistory();\n        fieldEditKey = fieldKey;\n      }\n      data.regions[index][field] = target.value;\n      if (field === 'label' && !data.regions[index].id) data.regions[index].id = nextRegionId(data.regions[index].role || 'region');\n      selectedIndex = index;\n      rememberInstructionCaret(target);\n      draw();\n      updateSubmitState();\n    }\n\n    async function saveHandoff() {\n      if (!data || !sourceDataUrl || !data.regions.length) return;\n      var warnings = validateData();\n      if (warnings.length) {\n        setAnnotationStatus(warnings[0], 'error');\n        return;\n      }\n      setAnnotationStatus('正在保存标注并提交给 Codex...', 'pending');\n      var response = await fetch(getBridgeUrl() + '/api/figma-bridge/annotations/handoff-from-image', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({\n          sourceImageName: sourceFile ? sourceFile.name : 'image2-screen.png',\n          sourceImageDataUrl: sourceDataUrl,\n          annotations: data\n        })\n      });\n      var body = await response.json();\n      if (!response.ok) {\n        setAnnotationStatus((body && body.error) || ('提交失败 HTTP ' + response.status), 'error');\n        return;\n      }\n      setAnnotationStatus('已提交给 Codex。回到 Codex 输入：继续识别这个标注 handoff。Package: ' + body.packageDir, 'ok');\n    }\n\n    function validateData() {\n      if (!data || !data.regions.length) return ['请先框选至少一个区域。'];\n      for (var i = 0; i < data.regions.length; i += 1) {\n        var region = data.regions[i];\n        if (!region.label || !region.label.trim()) return ['第 ' + (i + 1) + ' 个区域缺少名称。'];\n        if (region.role !== 'ignore' && (!region.instruction || region.instruction.trim().length < 6)) return [region.label + ' 需要填写更明确的备注。'];\n      }\n      return [];\n    }\n\n    function updateSubmitState() {\n      var submit = document.getElementById('saveHandoff');\n      submit.disabled = !(data && sourceDataUrl && data.regions && data.regions.length);\n    }\n\n    function draw() {\n      if (!data) return;\n      elementDeleteHits = [];\n      ctx.clearRect(0, 0, canvas.width, canvas.height);\n      data.regions.forEach(function (region, index) { drawBox(region.bbox, roleColors[region.role] || '#1677ff', region.label || region.id, index === selectedIndex); });\n      data.regions.forEach(function (region, regionIndex) {\n        var elements = Array.isArray(region.elements) ? region.elements : [];\n        elements.forEach(function (element, elementIndex) {\n          drawElementBox(element.bbox, element.id, regionIndex === selectedIndex, regionIndex, elementIndex);\n        });\n      });\n      if (draft) drawBox(draft, dragMode === 'drawElement' ? '#f97316' : '#1677ff', dragMode === 'drawElement' ? '新元素' : '新区域', true);\n    }\n\n    function drawBox(bbox, color, label, active) {\n      if (!bbox) return;\n      var sx = canvas.width / data.canvas.width;\n      var sy = canvas.height / data.canvas.height;\n      ctx.save();\n      ctx.strokeStyle = color;\n      ctx.lineWidth = active ? 3 : 2;\n      ctx.setLineDash(active ? [] : [6, 4]);\n      ctx.strokeRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);\n      ctx.setLineDash([]);\n      ctx.fillStyle = color;\n      ctx.globalAlpha = active ? .18 : .1;\n      ctx.fillRect(bbox.x * sx, bbox.y * sy, bbox.width * sx, bbox.height * sy);\n      ctx.globalAlpha = 1;\n      ctx.font = '12px Inter, Arial';\n      var tx = bbox.x * sx + 5;\n      var ty = Math.max(18, bbox.y * sy + 18);\n      var text = String(label || '');\n      var tw = ctx.measureText(text).width + 10;\n      ctx.fillStyle = color;\n      ctx.fillRect(tx - 2, ty - 14, tw, 18);\n      ctx.fillStyle = '#fff';\n      ctx.fillText(text, tx + 3, ty);\n      if (active) drawHandles(bbox, sx, sy, color);\n      ctx.restore();\n    }\n\n    function drawHandles(bbox, sx, sy, color) {\n      var points = [[bbox.x,bbox.y],[bbox.x+bbox.width,bbox.y],[bbox.x,bbox.y+bbox.height],[bbox.x+bbox.width,bbox.y+bbox.height]];\n      ctx.fillStyle = '#fff';\n      ctx.strokeStyle = color;\n      points.forEach(function (p) { var x = p[0] * sx; var y = p[1] * sy; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeRect(x - 4, y - 4, 8, 8); });\n    }\n\n    function drawElementBox(bbox, id, active, regionIndex, elementIndex) {\n      if (!bbox) return;\n      var sx = canvas.width / data.canvas.width;\n      var sy = canvas.height / data.canvas.height;\n      var x = bbox.x * sx;\n      var y = bbox.y * sy;\n      var w = bbox.width * sx;\n      var h = bbox.height * sy;\n      var color = '#f97316';\n      ctx.save();\n      ctx.strokeStyle = color;\n      ctx.lineWidth = active ? 2 : 1.5;\n      ctx.setLineDash([4, 3]);\n      ctx.strokeRect(x, y, w, h);\n      ctx.setLineDash([]);\n      ctx.fillStyle = color;\n      ctx.globalAlpha = active ? .14 : .08;\n      ctx.fillRect(x, y, w, h);\n      ctx.globalAlpha = 1;\n      ctx.font = '11px Inter, Arial';\n      var label = '[' + String(id || '') + ']';\n      var labelWidth = ctx.measureText(label).width + 24;\n      var tagWidth = Math.min(Math.max(48, labelWidth), Math.max(48, w));\n      var tagX = Math.max(x, x + w - tagWidth);\n      var tagY = Math.max(y, y + 2);\n      ctx.fillStyle = '#fff7ed';\n      ctx.strokeStyle = color;\n      ctx.lineWidth = 1;\n      ctx.fillRect(tagX, tagY, tagWidth, 18);\n      ctx.strokeRect(tagX, tagY, tagWidth, 18);\n      ctx.fillStyle = '#9a3412';\n      ctx.fillText(label, tagX + 5, tagY + 13);\n      ctx.fillStyle = '#fed7aa';\n      ctx.fillRect(tagX + tagWidth - 18, tagY, 18, 18);\n      ctx.fillStyle = '#9a3412';\n      ctx.fillText('×', tagX + tagWidth - 13, tagY + 13);\n      elementDeleteHits.push({ regionIndex: regionIndex, elementIndex: elementIndex, x: tagX + tagWidth - 18, y: tagY, width: 18, height: 18 });\n      ctx.restore();\n    }\n\n    function applyZoomChoice() {\n      if (!data) return;\n      var choice = document.getElementById('scaleSelect').value;\n      if (choice === 'fit') {\n        zoom = Math.max(.1, Math.min(2, (viewport.clientWidth - 26) / data.canvas.width));\n      } else {\n        zoom = Number(choice);\n      }\n      resizeCanvas();\n    }\n\n    function resizeCanvas() {\n      if (!data) return;\n      var displayWidth = Math.max(1, Math.round(data.canvas.width * zoom));\n      var displayHeight = Math.max(1, Math.round(data.canvas.height * zoom));\n      img.style.width = displayWidth + 'px';\n      img.style.height = displayHeight + 'px';\n      canvas.width = displayWidth;\n      canvas.height = displayHeight;\n      stage.style.width = displayWidth + 'px';\n      stage.style.height = displayHeight + 'px';\n      draw();\n    }\n\n    function pointer(event) {\n      var rect = canvas.getBoundingClientRect();\n      var rawX = (event.clientX - rect.left) * data.canvas.width / rect.width;\n      var rawY = (event.clientY - rect.top) * data.canvas.height / rect.height;\n      return { x: clampNumber(Math.round(rawX), 0, data.canvas.width), y: clampNumber(Math.round(rawY), 0, data.canvas.height) };\n    }\n    function normalizeRect(x1, y1, x2, y2, bounds) { return clampBoxTo({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }, bounds || { x: 0, y: 0, width: data.canvas.width, height: data.canvas.height }); }\n    function hitRegion(point) { for (var i = data.regions.length - 1; i >= 0; i -= 1) { var b = data.regions[i].bbox; if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) return i; } return -1; }\n    function hitHandle(point) { if (selectedIndex < 0) return null; var b = data.regions[selectedIndex].bbox; var t = Math.max(6, Math.round(8 / zoom)); var h = { nw:[b.x,b.y], ne:[b.x+b.width,b.y], sw:[b.x,b.y+b.height], se:[b.x+b.width,b.y+b.height] }; for (var key in h) if (Math.abs(point.x - h[key][0]) <= t && Math.abs(point.y - h[key][1]) <= t) return key; return null; }\n    function updateCursor(point) { var handle = hitHandle(point); canvas.style.cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : handle === 'ne' || handle === 'sw' ? 'nesw-resize' : hitRegion(point) >= 0 ? 'move' : 'crosshair'; }\n    function resizeBox(box, handle, point) { var x1 = box.x, y1 = box.y, x2 = box.x + box.width, y2 = box.y + box.height; if (handle.indexOf('n') !== -1) y1 = point.y; if (handle.indexOf('s') !== -1) y2 = point.y; if (handle.indexOf('w') !== -1) x1 = point.x; if (handle.indexOf('e') !== -1) x2 = point.x; return normalizeRect(x1, y1, x2, y2); }\n    function cloneBox(box) { return { x: box.x, y: box.y, width: box.width, height: box.height }; }\n    function clampBox(box) { return clampBoxTo(box, { x: 0, y: 0, width: data.canvas.width, height: data.canvas.height }); }\n    function clampBoxTo(box, bounds) {\n      bounds = bounds || { x: 0, y: 0, width: data.canvas.width, height: data.canvas.height };\n      var width = Math.max(1, Math.min(Math.round(box.width), Math.round(bounds.width)));\n      var height = Math.max(1, Math.min(Math.round(box.height), Math.round(bounds.height)));\n      var x = clampNumber(Math.round(box.x), Math.round(bounds.x), Math.round(bounds.x + bounds.width - width));\n      var y = clampNumber(Math.round(box.y), Math.round(bounds.y), Math.round(bounds.y + bounds.height - height));\n      return { x: x, y: y, width: width, height: height };\n    }\n    function clampPointToBox(point, box) {\n      return { x: clampNumber(point.x, box.x, box.x + box.width), y: clampNumber(point.y, box.y, box.y + box.height) };\n    }\n    function clampNumber(value, min, max) {\n      if (max < min) max = min;\n      return Math.max(min, Math.min(max, value));\n    }\n    function nextRegionId(role) { var used = {}; data.regions.forEach(function (r) { used[r.id] = true; }); var i = data.regions.length + 1; var id = sanitizeId(role) + '_' + String(i).padStart(2, '0'); while (used[id]) { i += 1; id = sanitizeId(role) + '_' + String(i).padStart(2, '0'); } return id; }\n    function nextElementId() {\n      var used = {};\n      data.regions.forEach(function (region) {\n        (region.elements || []).forEach(function (element) { used[element.id] = true; });\n      });\n      var i = 1;\n      var id = 'el_' + String(i).padStart(2, '0');\n      while (used[id]) { i += 1; id = 'el_' + String(i).padStart(2, '0'); }\n      return id;\n    }\n    function deleteElementFromCanvas(event) {\n      if (!data || !elementDeleteHits.length) return false;\n      var rect = canvas.getBoundingClientRect();\n      var x = event.clientX - rect.left;\n      var y = event.clientY - rect.top;\n      for (var i = elementDeleteHits.length - 1; i >= 0; i -= 1) {\n        var hit = elementDeleteHits[i];\n        if (x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height) {\n          event.preventDefault();\n          event.stopPropagation();\n          deleteElement(hit.regionIndex, hit.elementIndex);\n          return true;\n        }\n      }\n      return false;\n    }\n    function insertElementReference(regionIndex, elementId) {\n      var region = data.regions[regionIndex];\n      var token = '[' + elementId + ']';\n      var text = region.instruction || '';\n      var caret = caretByRegion[regionIndex] || { start: text.length, end: text.length };\n      var start = clampNumber(caret.start, 0, text.length);\n      var end = clampNumber(caret.end, start, text.length);\n      var before = text.slice(0, start);\n      var after = text.slice(end);\n      var prefixSpace = before && !/\\s$/.test(before) ? ' ' : '';\n      var suffixSpace = after && !/^\\s/.test(after) ? ' ' : '';\n      region.instruction = before + prefixSpace + token + suffixSpace + after;\n      var position = (before + prefixSpace + token).length;\n      caretByRegion[regionIndex] = { start: position, end: position };\n    }\n    function removeElementReference(region, elementId) {\n      if (!region || !region.instruction) return;\n      var pattern = new RegExp('\\\\s*\\\\[' + escapeRegExp(elementId) + '\\\\]\\\\s*', 'g');\n      region.instruction = region.instruction.replace(pattern, ' ').replace(/\\s{2,}/g, ' ').trim();\n    }\n    function rememberInstructionCaret(target) {\n      if (!target || target.getAttribute('data-field') !== 'instruction') return;\n      var index = Number(target.getAttribute('data-index'));\n      caretByRegion[index] = { start: target.selectionStart || 0, end: target.selectionEnd || target.selectionStart || 0 };\n    }\n    function rememberActiveInstructionCaret() {\n      rememberInstructionCaret(document.activeElement);\n    }\n    function focusInstruction(regionIndex) {\n      setTimeout(function () {\n        var target = document.querySelector('textarea[data-field=\"instruction\"][data-index=\"' + regionIndex + '\"]');\n        if (!target) return;\n        var caret = caretByRegion[regionIndex] || { start: target.value.length, end: target.value.length };\n        target.focus();\n        target.setSelectionRange(caret.start, caret.end);\n      }, 0);\n    }\n    function snapshotState() {\n      return JSON.stringify({ data: data, selectedIndex: selectedIndex });\n    }\n    function pushHistory() {\n      if (!data) return;\n      pushSnapshot(snapshotState());\n    }\n    function pushSnapshot(snapshot) {\n      if (!snapshot) return;\n      if (undoStack.length && undoStack[undoStack.length - 1] === snapshot) return;\n      undoStack.push(snapshot);\n      if (undoStack.length > 80) undoStack.shift();\n      redoStack = [];\n    }\n    function restoreSnapshot(snapshot) {\n      var state = JSON.parse(snapshot);\n      data = state.data;\n      selectedIndex = typeof state.selectedIndex === 'number' ? state.selectedIndex : -1;\n      addMode = false;\n      elementAddMode = false;\n      dragMode = null;\n      draft = null;\n      fieldEditKey = '';\n      render();\n    }\n    function undo() {\n      if (!data || !undoStack.length) return;\n      redoStack.push(snapshotState());\n      restoreSnapshot(undoStack.pop());\n      setAnnotationStatus('已撤销。', 'pending');\n    }\n    function redo() {\n      if (!data || !redoStack.length) return;\n      undoStack.push(snapshotState());\n      restoreSnapshot(redoStack.pop());\n      setAnnotationStatus('已重做。', 'pending');\n    }\n    function handleShortcut(event) {\n      var key = String(event.key || '').toLowerCase();\n      if (!(event.metaKey || event.ctrlKey)) return;\n      var wantsUndo = key === 'z' && !event.shiftKey;\n      var wantsRedo = (key === 'z' && event.shiftKey) || key === 'y';\n      if (!wantsUndo && !wantsRedo) return;\n      if (isEditableTarget(event.target)) return;\n      event.preventDefault();\n      if (wantsRedo) redo();\n      else undo();\n    }\n    function isEditableTarget(target) {\n      return Boolean(target && target.closest && target.closest('input,textarea,select,[contenteditable=\"true\"]'));\n    }\n    function sanitizeId(value) { return String(value || 'region').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'region'; }\n    function bboxText(b) { return b ? Math.round(b.x) + ',' + Math.round(b.y) + ' / ' + Math.round(b.width) + 'x' + Math.round(b.height) : '无坐标'; }\n    function roleOptions(selected) { return roleOrder.map(function (role) { return '<option value=\"' + role + '\"' + (role === selected ? ' selected' : '') + '>' + roleLabels[role] + '</option>'; }).join(''); }\n    function readFileAsDataUrl(file) { return new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(String(reader.result)); }; reader.onerror = function () { reject(reader.error); }; reader.readAsDataURL(file); }); }\n    function loadImageProbe(url) { return new Promise(function (resolve, reject) { var probe = new Image(); probe.onload = function () { resolve({ width: probe.naturalWidth, height: probe.naturalHeight }); }; probe.onerror = reject; probe.src = url; }); }\n    function setAnnotationStatus(message, tone) { var node = document.getElementById('annotationStatus'); node.className = tone === 'error' ? 'warning' : tone === 'ok' ? 'ok' : tone === 'pending' ? 'pending' : 'small'; node.textContent = message || ''; }\n    function setTab(name) { document.getElementById('importView').classList.toggle('active', name === 'import'); document.getElementById('annotateView').classList.toggle('active', name === 'annotate'); document.getElementById('tabImport').classList.toggle('active', name === 'import'); document.getElementById('tabAnnotate').classList.toggle('active', name === 'annotate'); if (name === 'annotate') setTimeout(applyZoomChoice, 0); }\n    function bindClick(node, handler) { if (node.addEventListener) node.addEventListener('click', handler); else node.onclick = handler; }\n    function readStored(key) { try { return window.localStorage && localStorage.getItem(key); } catch (error) { return null; } }\n    function writeStored(key, value) { try { if (window.localStorage) localStorage.setItem(key, value); } catch (error) {} }\n    function getBridgeUrl() { var value = bridgeInput.value.trim().replace(/\\/+$/, ''); writeStored('bridgeUrl', value); return value; }\n    function setState(value) { stateNode.textContent = value; }\n    function appendLog(line) { var time = new Date().toLocaleTimeString(); logNode.textContent = time + ' ' + line + '\\n' + logNode.textContent; }\n    function escapeHtml(text) { return String(text || '').replace(/[&<>\"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', \"'\":'&#039;' })[char]; }); }\n    function escapeAttr(text) { return escapeHtml(text).replace(/`/g, '&#096;'); }\n    function escapeRegExp(text) { return String(text || '').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); }\n  </script>\n</body>\n</html>\n";

function buildPluginUiHtml() {
  return UI_HTML;
}

figma.showUI(buildPluginUiHtml(), {
  width: 1280,
  height: 860,
  themeColors: true
});

figma.ui.onmessage = async (message) => {
  if (message && message.type === "resize-ui") {
    figma.ui.resize(numberOr(message.width, 1280), numberOr(message.height, 860));
    return;
  }

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
  if (job && job.type === "codeui.handoff.status") {
    return executeHandoffStatusJob(job, logs);
  }

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

function executeHandoffStatusJob(job, logs) {
  const status = job.payload || {};
  const message = status.message || "CodeUi-to-Figma handoff 状态已更新。";
  logs.push(message);
  figma.notify(message, { timeout: 8000 });
  return {
    handoffStatus: status.status || "unknown",
    packageDir: status.packageDir || null,
    statusPath: status.statusPath || null,
    pendingCount: numberOr(status.pendingCount, 0),
    image2TasksMarkdown: status.image2TasksMarkdown || null,
    submittedJobId: status.submittedJobId || null
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
