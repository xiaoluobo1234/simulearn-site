# 首页视觉调整与素材说明

日期：2026-10-23（Asia/Shanghai）。按用户提供的参考图调整原站首页，属于教程模块；在原 PR #3 继续更新。

## 页面组织

1. 深蓝工程首屏：标题固定为两个完整行，主按钮为“开始学习”“查看工程案例”。
2. 四项紧凑快捷入口：知识路径、工程案例、诊断系统、计算工具。
3. 五领域图形卡：结构突出，状态为“实践沉淀 / 持续学习 / 探索中”，表示内容建设状态，不推导个人掌握程度。
4. 代表案例紧随领域入口：保留现有 `energy-partition.png` 完整图例和坐标，不用生成模型替代结果证据。
5. 学习总览和学习记录保留为紧凑入口，随后展示理解、建模、验证、沉淀的方法路径。

中文主导航改为学习领域下拉、学习路径、工程案例、工具脚本和资源。在线仿真移入资源，原有认证、英文路径、搜索与明暗切换保留。用户本轮明确要求两个首屏按钮，优先于旧 AGENTS.md 中工具脚本和在线仿真必须放在首屏的排列说明。

## 素材

- `public/images/home/engineering-hero-v2.png`：内置 ImageGen 新生成的工程概念插画，1474×1067，2,289,687 bytes，原始文件保留。
- `public/images/home/engineering-hero-v2.webp`：网站实际加载版本，同尺寸，243,232 bytes；仅进行格式转换与编码压缩，约减少 89% 传输体积。
- `public/images/home/domain-{structural,thermal,fluids,multiphysics,chip}.svg`：代码绘制的可编辑概念示意，透明背景；不包含求解值、结果色标和单位。
- `public/images/cases/energy-partition.png`：原仓库已有的案例图，1800×1120，来自现有案例页图1。本次未生成或修改该图。

首页首屏明确显示“多物理场概念示意 · 非求解结果”。案例图只按原页的证据范围使用；原始工程和参数来源待补全，未新增运行、验证或性能结论。

## 本轮验证

24 项 Vitest 测试、19 项 Playwright 浏览器回归以及 Astro 35 页构建通过。检查桌面1440px、手机390px和暗色模式，标题完整两行、无横向溢出、图片加载成功。导航下拉支持键盘，学习路径、案例、工具和在线仿真入口保留。截图保存于忽略目录 `.wrangler/qa/home-{desktop,mobile,mobile-dark}-v2.png`，不作为用户学习或仿真运行证据。

## ImageGen 最终提示词

内置生成模式，无 CLI/API 密钥调用。输入为根据用户参考图整理的视觉描述，未将用户截图作为编辑目标。

```text
Use case: stylized-concept
Asset type: production website homepage engineering hero illustration, displayed at approximately 580 by 420 pixels in the right half of a dark navy page.
Primary request: a premium, highly detailed three-dimensional engineering product illustration, one coherent central assembly: an electronic chip on a precision circuit board, with a machined aluminium finned heat sink floating slightly above it, integrated teal finite-element mesh lines, subtle glowing orange heat-transfer paths rising through the heat sink, and elegant fine blue fluid streamlines flowing around the assembly.
Scene/backdrop: pure clean dark navy background #091f2d. No room, no tabletop scene, no landscape. The object floats in the dark with subtle soft shadow and delicate ambient light.
Composition/framing: landscape wide image close to 1.4:1. Isometric three-quarter engineering view. The single assembly fills most of the frame, slightly right of center, with a clean dark margin around every edge so CSS can naturally fade it into the navy background. Show the complete circuit-board silhouette, chip and floating heat sink without cutting them off. Left edge is especially dark and quiet. The image is an independent visual asset, not a complete web page.
Style/medium: polished high-fidelity 3D product visualization, precise plausible mechanical forms, realistic brushed aluminium, deep green/teal PCB, crisp copper traces, nuanced navy reflections. Professional engineering learning site, restrained technical beauty.
Lighting/mood: dramatic but controlled soft studio lighting, cool cyan rim light and small warm orange heat accents. Deep contrast, clear object hierarchy, avoid excessive neon or haze.
Constraints: this is a conceptual engineering illustration only; no representation of measured or validated simulation output. Mesh is a schematic visualization. No UI, screenshot, panels, diagrams, graphs, charts, legends, color bars, axes, dimensions, numerical results, text, labels, letters, digits, logos or watermark. No additional random objects. No typography anywhere.
```
