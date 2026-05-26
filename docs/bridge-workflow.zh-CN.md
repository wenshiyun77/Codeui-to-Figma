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

1. Codex 生成或接收 image2 输出图，并创建 page package。
2. Codex 运行解析脚本，得到临时 `page.json` 和源图引用。
3. 用户打开 Figma 插件 `CodeUi-to-Figma`。
4. 用户进入 `标注工作台`，填写 package 绝对路径，点击 `加载源图`。
5. 用户在 Figma 插件里框选区域、选择区域类型、填写中文备注。
6. 用户点击 `保存并交给 Codex`。
7. Bridge 写入 `analysis/manual-annotations.json`，同时生成 `codex-handoff.json` 和 `codex-handoff.md`。
8. 用户回到 Codex 输入：`继续识别这个标注 handoff`。
9. Codex 读取 handoff、源图和人工标注，完整阅读每个区域的备注。
10. Codex 写入 `recognition.json` 和 `remove-background-tasks.json`。
11. 对于 `artText` 和 `foreground`，必须用 image2 去背景生成透明 PNG，不能用本地代码抠图代替。
12. Codex 运行 `apply:recognition`，把识别结果写回 `page.json`。
13. Codex 运行 `validate:page`。不通过则继续修复，不能提交 Figma。
14. Codex 提交 Bridge job。
15. Figma 插件的 `导入轮询` 领取任务，在 Figma 画布中重建页面。
16. Figma 插件把结果回传 Bridge。

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
