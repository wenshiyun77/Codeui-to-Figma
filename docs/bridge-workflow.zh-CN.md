# CodeUi-to-Figma 桥接流程说明

这份文档说明 CodeUi-to-Figma 里各个系统如何协作。目标是让同事能够复用同一套流程，而不是依赖某个人手动记命令。

## 角色分工

- Codex：负责读取图像和人工标注，执行元素识别、结构化 `page.json`、规划 image2 去背景任务、校验质量、提交 Figma 导入任务。
- image2：负责生成活动页主视觉，以及所有艺术字/前景素材的透明底去背景结果。
- Local Bridge：运行在 `http://localhost:39217`，负责存储 package、人工标注、handoff、素材读取、任务队列和 Figma 执行结果。
- Figma 插件：名为 `CodeUi-to-Figma`，内置 `导入轮询` 和 `标注工作台` 两个入口。
- page package：一个本地目录，包含 `page.json`、`assets/`、`source/`、`analysis/`。

## 文件结构

典型 package 结构：

```text
var/generated/example-page/
  page.json
  source/
    image2-screen.png
  assets/
    backgrounds/
    foregrounds/
    text-images/
  analysis/
    manual-annotations.json
    codex-handoff.json
    codex-handoff.md
    recognition.json
    remove-background-tasks.json
```

## 标准流程

1. Codex 生成或接收 image2 输出图。
2. 用户打开 Figma 插件 `CodeUi-to-Figma`。
3. 用户进入 `标注工作台`，拖拽或选择 UI 图。
4. 插件按 750px 页面宽度等比归一化坐标。
5. 用户通过右侧图层卡片新增框选区域、选择区域类型、填写中文备注。
6. 用户点击 `保存并提交给 Codex`。
7. Bridge 在运行数据目录创建 page package，写入 `page.json`、`source/image2-screen.*`、`analysis/manual-annotations.json`、`codex-handoff.json` 和 `codex-handoff.md`。
8. 用户回到 Codex 输入：`继续识别这个标注 handoff`。
9. Codex 读取 handoff、源图和人工标注，完整阅读每个区域的备注。
10. Codex 按顺序执行：750px 归一化、识别底色、去除手机系统条、先识别文字、再分离 Tab/按钮/图标/艺术字/前景透明素材、最后处理头图和区域背景。
11. Codex 写入 `recognition.json` 和 `remove-background-tasks.json`。
12. 对于 `artText`、`icon` 和 `foreground`，必须用 image2 去背景生成透明 PNG，不能用本地代码抠图代替。
13. Codex 运行 `handoff:continue`，把识别结果写回 `page.json`，自动准备 image2 去背景任务，并在素材完整时继续校验和提交。
14. 如果 `handoff:continue` 返回 `waiting_for_image2_cutouts`，说明只缺 image2 透明 PNG；必须用 image2 生成后放回指定目标路径，再重新运行同一条命令。
15. 校验通过后，`handoff:continue` 自动提交 Bridge job。
16. Figma 插件的 `导入轮询` 领取任务，在 Figma 画布中重建页面并隐藏原图。
17. Figma 插件把结果回传 Bridge。

## 标注规则

框选区域只是识别约束，不是最终切图规则。

区域备注必须完整填写，尤其是复杂模块。备注里应该明确说明：

- 哪些内容保留在区域背景里。
- 哪些普通文字需要变成可编辑文本。
- 哪些按钮、Tab、卡片、列表行需要变成可编辑形状。
- 哪些艺术字需要走 image2 去背景生成 `textImage`。
- 哪些人物、奖杯、产品、装饰素材需要走 image2 去背景生成 `foregroundImage`。

重要区域类型：

- `heroImage`：完整头图，默认不拆内部人物、奖杯和标题艺术字。
- `moduleBackground`：业务模块背景，可本地矩形裁切。
- `tabGroup`：Tab 容器背景和文字识别区域。
- `selectedTab`：选中态单独形状。
- `artText`：艺术字透明素材，必须 image2 去背景。
- `foreground`：前景透明素材，必须 image2 去背景。
- `shape`：可编辑形状。
- `text`：可编辑文本。
- `ignore`：忽略区域。

## 质量门禁

提交 Figma 前必须通过：

```bash
npm run validate:page -- /absolute/path/to/page.json
```

质量门禁会拒绝：

- 整页只有一张长图。
- 只有固定 4 到 8 个粗切背景块。
- 识别未完成。
- image2 透明素材还没生成。
- 语义层数量过少。

## 日常使用命令

首次设置：

```bash
npm run doctor
npm run bridge:install-service
npm run skill:install
```

开发检查：

```bash
npm run check
npm run test:manual-workbench
npm run test:quality
```

提交示例包：

```bash
npm run submit:sample
```

## 团队复制要点

每位同事需要：

- Node.js。
- Figma Desktop。
- 安装一次 Bridge 后台服务。
- 导入一次 `packages/plugin/manifest.json`。
- 安装一次 Codex skill。

Figma 插件不能自己启动本机服务，所以 Bridge 服务仍然必须在每台机器上安装一次。
