# SimuLearn Agent 交接文档

更新日期：2026-06-29

当前网站提交：`main` / `15b4634`（待更新——本地有未提交变更）

当前生产 Worker：`b5c3c213-f006-4fc1-a5a7-b98d90ba5a49`（待更新——本地需提交并部署）

生产地址：`https://simulearn.cn`

仓库：`git@github.com:xiaoluobo1234/simulearn-site.git`

本文是后续 Agent 接手当前网站的首要入口。历史文档和截图只代表当时状态；代码、线上端点和本文记录的当前基线优先。

---

## 1. 当前状态摘要

| 项目 | 当前状态 |
|---|---|
| Git | `main` 已推送到 `15b4634`，本地有 11 个文件未提交变更 |
| Cloudflare | Worker Static Assets 已部署到 `simulearn.cn` |
| 五领域课程 | 结构、热、流体、多物理场、芯片共 450 个预设知识点 |
| 工具教程课程 | 4 个系列、28 个主题章节、**82 篇**教程（Python 20 + APDL 32 + NumPy 15 + SciPy 15） |
| APDL 进阶 | 新增第 5 个系列分组，7 篇进阶教程（进阶总结、APDL Math 入门、APDL Math 运算、结果验证、接触分析、屈曲分析、子模型技术） |
| Phase 1 标准化 | 已完成：32/32 篇教程统一练习引用格式、0 处 LaTeX 数学公式残留、统一章节结构 |
| 工具教程 AI | 已全部移除，不显示 AI 拓展、问答或 AI 检验 |
| 仿真实践 | 仅保留"案例整理中"占位，尚未填充真实案例 |
| 工程书库 | R2 书库与 Dify「工程书库」知识库已接通 |
| Dify Chatflow | 已勾选并发布 6 个公开知识库 |
| 自动化测试 | 本地全部通过；GitHub Actions CI 已修复并通过 |
| 当前工作区 | `simulearn-scripts/` 嵌套仓库未跟踪，不得提交；`dist-worker/` 为构建产物 |

接手后先运行：

```powershell
cd "C:\Users\Lenovo\ZCodeProject\simulearn-site"
git status --short --branch
git log -5 --oneline
npm.cmd run test
npm.cmd run build
npm.cmd run check:functions
npm.cmd run test:e2e
npx.cmd wrangler deploy --dry-run --outdir .wrangler/worker
```

PowerShell 执行策略会阻止 `npm.ps1` / `npx.ps1` 时，使用 `npm.cmd` / `npx.cmd`。

---

## 2. 产品定位与不可变约束

SimuLearn 是面向仿真工程师的工程知识平台，覆盖：

1. 结构；
2. 热；
3. 流体；
4. 多物理场；
5. 芯片仿真；
6. 工具脚本与 Python / APDL / NumPy / SciPy 教程；
7. 工程书库、案例、诊断和验证内容。

长期原则：

- 重点是物理理解、工程判断、验证路径和失败复盘，不是软件按钮说明。
- 原始客户、项目、人员、几何、材料、载荷、工艺和结果数据默认私有。
- 公开案例必须经过筛选、脱敏、授权、版权检查和人工复核。
- AI 不能替代工程安全判断或管理员发布确认。
- 不确定的信息必须明确标记，不得包装成已验证结论。
- 第三方教程只能参考信息架构和教学方法，不复制受版权保护正文。

工具教程的最新用户决策：

- 正规知识与仿真实践分开；
- 先把 Python 基础知识讲清楚；
- 取消混乱的初级/中级/高级大杂烩；
- 只保留"零基础 / 基础"难度标签；
- 采用自然文章结构，不强制每篇套同一固定模板；
- 仿真实践先留空，等待用户后续寻找真实案例；
- 工具教程不保留任何 AI 拓展、AI 问答或 AI 评估。

### 战略方向（2026-06-29 新增）

用户经过 14 轮深度讨论后确认：**网站不是伪需求，但目前的形态让它看起来像。** 核心判断：

- **伪的部分**：82 篇教程均为 AI 生成、未经用户审核；书库含未授权内容不可公开；去掉这两层，网站目前是空的。
- **不伪的部分**：用户有 4 年 30+ 个项目的真实仿真经验；有明确的方法论（真实模型→对比实验→数据说明工程判断）；Perasim 国产 CAE 实战内容全网几乎空白。
- **出路**：把用户的真实工程经验写入网站，每一篇教程叠加个人方法论和踩坑经验层。

详见本文第 12 节「战略方向与行动计划」和独立文件 `simulearn-strategy-summary.md`。

---

## 3. 当前技术架构

```text
浏览器
  │
  ▼
simulearn.cn
Cloudflare Worker + Static Assets
  ├─ Astro 公开页面
  ├─ /api/learning/*      固定路线、进度、检验和身份
  ├─ /api/knowledge/*     预设知识内容
  ├─ /api/books*          R2 工程书库
  ├─ /api/ai/*            管理员 Dify 代理
  ├─ /domains/{domain}/kp/{slug}/
  ├─ BOOKS R2
  └─ AI_RATE_LIMITER

/api/ai/*
  │
  ▼
ai.simulearn.cn
Cloudflare Tunnel
  │
  ▼
阿里云 Docker / Dify / DeepSeek / PostgreSQL / Redis / Weaviate
```

生产部署是 Cloudflare Workers Static Assets，不是旧 Cloudflare Pages。

关键绑定：

```text
ASSETS
BOOKS = simulearn-books
AI_RATE_LIMITER = 5 requests / 60 seconds
```

`wrangler.jsonc` 已显式声明：

```json
{
  "routes": [
    {
      "pattern": "simulearn.cn",
      "custom_domain": true
    }
  ]
}
```

不要删除该配置。此前直接部署本地缺少路由的配置后，新 Worker 只更新了 `workers.dev`，主域名仍返回旧版本。

---

## 4. 五领域学习系统

五个仿真领域均为代码内固定预设路线：

```text
初级：20 个
中级：30 个
高级：40 个
每领域：90 个
五领域合计：450 个
```

进入领域页和知识点页不需要 AI 生成首屏内容。AI 只在五个仿真领域由用户主动触发拓展、问答或答案评估。

主要文件：

```text
src/data/learning-catalog.ts
src/data/structural-learning.ts
src/data/thermal-learning.ts
src/data/fluids-learning.ts
src/data/multiphysics-learning.ts
src/data/chip-learning.ts
src/components/KnowledgeTree.astro
src/pages/domains/[slug].astro
src/pages/domains/kp.astro
functions/_shared/learning.ts
```

匿名用户使用一年有效的 `simulearn_uid` HttpOnly Cookie。Cloudflare Access 邮箱身份优先。进度保存到：

```text
users/{uid}/progress/{domain}.json
```

AI 配额保存到：

```text
users/{uid}/ai-quota.json
```

AI 限制为：

- 5 次 / 60 秒；
- 20 次 / 小时；
- 60 次 / 日。

---

## 5. 工具脚本模块：当前重点进度

### 5.1 已完成的信息架构

工具页：`/tools/`

教程页：`/domains/tools/kp/{slug}/`

原 20/30/40 三级混合路线已取消。当前公开 4 个系列、28 个主题章节、82 篇教程：

**Python 基础教程（20 篇，8 章）：**

1. Python 入门（认识 Python；编写并运行第一个程序）；
2. 基础语法（注释、缩进与代码块；变量、赋值与命名；输入与输出）；
3. 数据类型（数字、布尔值与 None；字符串；类型检查与类型转换；运算符与表达式）；
4. 流程控制（条件判断；for 与 while 循环）；
5. 数据结构（列表；元组；字典；集合）；
6. 函数与模块（函数；模块、包与导入）；
7. 文件与异常（文件读写；错误与异常处理）；
8. 开发环境与规范（安装 Python 与配置编辑器）。

**APDL 初级教程（25 篇，8 章）：**

1. APDL 与仿真基础（认识 APDL；安装 ANSYS；工作流程与处理器；第一个 APDL 脚本）；
2. 命令语法基础（命令格式；数据库管理；日志文件与宏脚本）；
3. 几何建模（坐标系；关键点与线；面与体；布尔运算）；
4. 网格划分（单元类型；材料属性；网格生成）；
5. 加载与求解（约束与载荷；载荷步；求解器选择）；
6. 后处理（POST1 通用后处理；POST26 时间历程）；
7. 进阶操作（选择与组件；参数与表达式；流程控制）；
8. 实战案例（静力学分析；模态分析；总结与进阶路线）。

**APDL 进阶教程（7 篇，1 章）：**

9. APDL 进阶（进阶总结与工程实践；APDL Math 入门；APDL Math 运算应用；结果验证方法论；接触分析实战；屈曲分析——稳定性的边界；子模型技术——以细节换效率）。

**NumPy 数值计算教程（15 篇，5 章）：**

1. NumPy 入门（认识 NumPy；数组创建；数据类型）；
2. 索引与形状（基础索引；花式索引；形状变换）；
3. 运算与广播（逐元素运算；通用函数）；
4. 数据与文件（线性代数；统计聚合；随机数；文件读写）；
5. 工程应用（插值拟合；FFT；工程应用总结）。

**SciPy 科学计算教程（15 篇，6 章）：**

1. SciPy 入门（认识 SciPy；插值与平滑）；
2. 数值计算（数值积分；优化与拟合）；
3. 优化与线性代数（线性代数基础；特征值与分解）；
4. 信号与图像（信号处理；空间数据）；
5. 统计分析（分布基础；假设检验）；
6. 进阶计算（稀疏矩阵；ODE 求解；FFT；图像处理；总结）。

工具首页同时保留：

- Python 基础教程、APDL 初级教程、APDL 进阶教程、NumPy 数值计算教程、SciPy 科学计算教程五个 section；
- "仿真实践—案例整理中"占位；
- FEA 分析类型预判计算器；
- 独立脚本仓库链接。

### 5.2 教程架构决策

四个系列共享 `tools` 域，不拆分为独立域。关键设计：

- `series` 字段：`'python' | 'apdl' | 'numpy' | 'scipy'`，区分系列；
- ID 前缀：`apdl-*`、`numpy-*`、`scipy-*`，Python 无前缀；
- `toolsChapterOrder`：28 章 const 数组，控制渲染顺序和知识树分组；
- `tools.astro`：5 个 `<section>` 分别按 `p.series` 过滤渲染；
- `kp.astro`：`nodeSlug.startsWith()` 前缀检测决定教程标签（PYTHON / APDL / NUMPY / SCIPY FOUNDATION TUTORIAL）；
- `KnowledgeTree.astro`：标题"工程工具教程"，按 `toolsChapterOrder` 自动分组。

教程数据流：

```text
tools-tutorials-{foundation,language,control,structure}.ts  → Python 内容
tools-tutorials-apdl-{foundation,commands,mesh-solve,post-advanced}.ts  → APDL 初级内容
tools-tutorials-apdl-advanced.ts  → APDL 进阶内容
tools-tutorials-numpy-{foundation,advanced}.ts  → NumPy 内容
tools-tutorials-scipy-{foundation,advanced}.ts  → SciPy 内容
           ↓
tools-tutorials.ts  → 合并为 toolsTutorials 对象
           ↓
tools-learning.ts  → seeds 数组 + toolsTutorials[id] → *KnowledgePoints[]
           ↓
learning-catalog.ts  → toolsKnowledgePoints 映射到 tools 域
```

每篇正文：

- 至少 1500 中文字符；
- 使用主题相关的自然小标题；
- 解释、代码与运行结果穿插；
- 包含多个可运行代码示例；
- 不调用 AI；
- 末尾显示独立的"仿真实践—案例整理中"；
- 以 `> 📝 **相关练习**：[ex-xxx-01] description` 格式结束，指向对应练习。

`KnowledgeContent.aiContent` 仍是历史 API 字段名，但工具教程返回的是代码内预设原创正文，不是 AI 生成内容。不要仅因为字段名含 `ai` 就误改数据流。

### 5.3 工具模块关键文件

```text
src/pages/tools.astro                                    工具首页（5 section 渲染）
src/pages/index.astro                                    首页
src/pages/domains/kp.astro                               知识点页（slug 前缀检测标签）
src/components/KnowledgeTree.astro                       左侧知识树（28 章分组）
src/data/tools-learning.ts                               元数据、seeds、chapterOrder、*KnowledgePoints
src/data/tools-tutorials.ts                              教程内容聚合器（13 个 import）
src/data/tools-tutorials-foundation.ts                   Python 教程 1/4
src/data/tools-tutorials-language.ts                     Python 教程 2/4
src/data/tools-tutorials-control.ts                      Python 教程 3/4
src/data/tools-tutorials-structure.ts                    Python 教程 4/4
src/data/tools-tutorials-apdl-foundation.ts              APDL 教程 1/4
src/data/tools-tutorials-apdl-commands.ts                APDL 教程 2/4
src/data/tools-tutorials-apdl-mesh-solve.ts              APDL 教程 3/4
src/data/tools-tutorials-apdl-post-advanced.ts           APDL 教程 4/4
src/data/tools-tutorials-apdl-advanced.ts                APDL 进阶教程（7 篇）
src/data/tools-tutorials-numpy-foundation.ts             NumPy 教程 1/2
src/data/tools-tutorials-numpy-advanced.ts               NumPy 教程 2/2
src/data/tools-tutorials-scipy-foundation.ts             SciPy 教程 1/2
src/data/tools-tutorials-scipy-advanced.ts               SciPy 教程 2/2
src/data/learning-catalog.ts                             域注册（toolsKnowledgePoints 映射）
functions/_shared/learning.ts                            Worker 端知识组装
tests/catalog.test.ts                                    单元测试（82 篇断言）
tests/e2e/learning.spec.ts                               E2E 测试（28 章 / 82 卡片）
```

`tools-learning.ts` 保存教程元数据、章节顺序、难度和前置关系。13 个 `tools-tutorials-*.ts` 文件保存详细 Markdown 正文。

### 5.4 工具教程页面行为

工具教程复用通用知识点页，但进入 `domain === "tools"` 时：

- 左侧树显示 28 个主题章节和 82 篇教程；
- 右侧标题显示"知识教程"；
- 标题上方标签根据 slug 前缀显示系列名（PYTHON / APDL / NUMPY / SCIPY FOUNDATION TUTORIAL）；
- 使用更大的正文、标题和深色代码块样式；
- 隐藏学习状态；
- 隐藏 AI 拓展；
- 隐藏 AI 辅导问答；
- 隐藏 AI 学习检验；
- 显示仿真实践占位；
- 保留前置、后续和同章教程关系。

不要把工具教程重新塞回 20/30/40 三级路线，也不要重新打开 AI UI。

### 5.5 APDL 进阶教程详情

新增 `tools-tutorials-apdl-advanced.ts`（约 1900 行），包含 7 篇进阶教程：

| 教程 | ID | 主题 |
|---|---|---|
| 进阶总结与工程实践 | `apdl-advanced-summary` | 初级→进阶思维转变、模块总览、学习路径 |
| APDL Math 入门 | `apdl-math-intro` | 矩阵运算基础、*DMAT/*SMAT/*VEC 创建、线性方程组 |
| APDL Math 运算应用 | `apdl-math-operations` | 特征值、SVD、灵敏度分析、模型降阶 |
| 结果验证方法论 | `apdl-verification` | 理论解验证、网格收敛、能量误差、自由体校核 |
| 接触分析实战 | `apdl-contact` | 接触对定义、接触刚度、收敛调试、初始穿透处理 |
| 屈曲分析 | `apdl-buckling` | 线性特征值屈曲、非线性弧长法、后屈曲行为、初始缺陷 |
| 子模型技术 | `apdl-submodeling` | 切割边界、CBDOF 插值、应力集中因子验证 |

所有进阶教程的前置条件均为 `apdl-advanced-summary`，构成 APDL 第 5 个系列分组"APDL 进阶"。每组练习引用以 `ex-apdl-challenge-01` 统指所有进阶专题的综合练习。

### 5.6 Phase 1 标准化成果

2026-06-29 完成的格式标准化，涉及 5 个 APDL 教程文件：

1. **练习引用格式统一**：所有 32 篇 APDL 教程的"本节要点"区块末尾均采用标准格式 `> 📝 **相关练习**：[ex-xxx-01] description`。
2. **LaTeX 数学公式清除**：6 处 `$$...$$` / `$...$` 公式转换为 Unicode 纯文本（如 `P_cr = π²EI/(KL)²`）。
3. **章节结构修正**：`tools-tutorials-apdl-mesh-solve.ts` 中"特殊单元类型概览"从"本节要点"之后移到之前，并更新要点摘要。
4. **多余元素移除**：删除 `apdl-advanced-summary` 中重复的练习引用行和完成横幅。

验证结果：`grep` 确认 0 处 `$$` / `$[a-zA-Z]` 残留；32/32 篇"本节要点"匹配 32 条练习引用。

---

## 6. 工程书库与 Dify

Dify 共有 8 个知识库映射：

```text
structural
thermal
fluids
multiphysics
chip
books
private
review
```

公开 Chatflow 已由用户确认勾选并发布：

```text
结构
热
流体
多物理场
芯片仿真
工程书库
```

不要把 `private` 和 `review` 接入公开问答。

Cloudflare Secret `DIFY_DATASETS_JSON` 已更新为包含 8 个有效且不重复 UUID 的完整 JSON。Secret 无法从 Cloudflare 读回明文。

后续更新 Secret 时必须一次提交完整 8 键 JSON，不能只提交 `books`，否则会覆盖其他映射。

PowerShell 正确命令：

```powershell
npx.cmd wrangler secret put DIFY_DATASETS_JSON --name simulearn-site
```

书库数据位于 R2：

```text
books/catalog.json
books/{slug}/book.json
books/{slug}/meta.json
books/{slug}/toc.json
books/{slug}/chapters.json
books/{slug}/versions/{version}/source.*
books/{slug}/assets/{version}/...
```

书库已具备向 Dify「工程书库」同步文本的代码能力。真实书籍仍必须先做版权和人工质量检查。

---

## 7. Git 与部署状态

网站仓库最近提交：

```text
15b4634  docs: update AGENT-HANDOFF.md for 75 tutorials and CI fix
737f083  feat: add 30 NumPy + SciPy tutorials for engineering computation
1f5f74c  fix(ci): 升级 Node 24 和 Actions v5 修复 npm ci 失败
a6fc3f2  feat: 重构工具脚本基础教程
db532b0  feat: 接入工程书库并扩展工具学习内容
```

**本地未提交变更（11 个文件）**：

```text
M  src/components/KnowledgeTree.astro          (APDL 进阶章节分组)
M  src/data/tools-learning.ts                  (7 个新 seeds + chapterOrder 更新)
M  src/data/tools-tutorials-apdl-commands.ts   (Phase 1: 练习引用)
M  src/data/tools-tutorials-apdl-foundation.ts (Phase 1: 练习引用)
M  src/data/tools-tutorials-apdl-mesh-solve.ts (Phase 1: 章节重排 + 练习引用)
M  src/data/tools-tutorials-apdl-post-advanced.ts (Phase 1: 练习引用)
M  src/data/tools-tutorials.ts                 (新增 apdl-advanced import)
M  src/pages/domains/kp.astro                  (APDL 进阶 slug 前缀检测)
M  src/pages/tools.astro                       (APDL 进阶 section 渲染)
M  tests/catalog.test.ts                       (75→82 计数更新)
M  tests/e2e/learning.spec.ts                  (28 章/82 卡片验证)
?? src/data/tools-tutorials-apdl-advanced.ts   (新增：7 篇 APDL 进阶教程)
?? src/data/tools-tutorials-apdl-exercises.ts  (新增：练习文件占位)
?? dist-worker/                                (构建产物，不提交)
?? simulearn-scripts/                          (空嵌套仓库，不提交)
```

独立脚本仓库：

```text
C:\Users\Lenovo\ZCodeProject\simulearn-scripts
GitHub: xiaoluobo1234/simulearn-scripts
提交: 60653a8 feat: Phase 3 初级 20 个知识点详细教学脚本
```

网站目录下还有：

```text
C:\Users\Lenovo\ZCodeProject\simulearn-site\simulearn-scripts\
```

它只是一个空的嵌套 Git 仓库，不包含真实脚本。不要 `git add -A` 把它提交成 gitlink。未获得用户明确许可前也不要删除。

当前生产部署：

```text
Worker: simulearn-site
Custom domain: simulearn.cn
Version ID: b5c3c213-f006-4fc1-a5a7-b98d90ba5a49（待更新——本地未提交）
Source commit: 15b4634（待更新——本地未提交）
```

正式部署命令：

```powershell
npm.cmd run build
npx.cmd wrangler deploy
```

---

## 8. 当前验证结果

最新本地验证：

```text
npm run test             6 / 6 通过
npm run test:e2e         9 / 9 通过
npm run build            29 个静态页面成功
npm run check:functions  Functions 编译成功
Wrangler dry-run          成功
Worker 上传体积           915.37 KiB
gzip 后                   284.99 KiB
```

E2E 覆盖：

- 五领域固定路线；
- 普通知识点树、校订状态和知识关系；
- 首页工具脚本按钮与 AI 英雄按钮移除；
- 工具页 28 个章节、82 个卡片和仿真实践占位；
- 工具页五个系列标题（Python / APDL 初级 / APDL 进阶 / NumPy / SciPy）可见；
- APDL 进阶 7 篇教程正文可访问；
- 工具教程无 AI 拓展、无 AI 问答、无 AI 检验。

最新线上验证（部署后应确认）：

```text
GET /                                      200
首页英雄区包含 工具脚本 / 工程书库
GET /tools/                                200
工具页包含 28 个章节、82 个教程卡片
GET /api/knowledge/tools/apdl-buckling     200
tutorialMode = true
difficulty = 基础
practiceStatus = collecting
GET /api/knowledge/tools/python-intro      200
tutorialMode = true
difficulty = 零基础
practiceStatus = collecting
```

---

## 9. 已知问题与开发优先级

### P1：补充真实仿真实践

用户将继续寻找案例。未提供案例前：

- 保持"案例整理中"；
- 不生成虚构仿真项目；
- 不把独立脚本仓库中的示例自动包装成已验证真实案例；
- 新案例应包含输入、脚本、运行过程、结果、验证和适用边界。

### P1：人工校订 82 篇教程

当前教程已通过结构、长度、代码语法和浏览器检查，但仍建议后续逐篇：

- 实际运行代表性示例；
- 核对 Windows / macOS / Linux 差异；
- 校对术语和版本变化；
- 由有经验的工程师复核教学顺序。

APDL 教程需在 ANSYS MAPDL 中验证命令正确性；NumPy/SciPy 教程需在 Python 环境中运行代码示例。

**优先审核 APDL 进阶 7 篇**：接触、屈曲、子模型教程涉及复杂的非线性求解设置，命令组合和参数选择需要实际运行验证。APDL Math 教程的矩阵运算语法需在 ANSYS 18.0+ 环境中测试。

### P1：移除未授权书籍内容

书库模块中任何未授权 PDF 转 markdown 内容必须在第一次对外展示前全部移除。详见第 12 节「不可逾越的红线」。

### P2：下一阶段教程

NumPy 和 SciPy 已完成。后续建议按独立主题继续扩展：

1. Pandas；
2. Matplotlib；
3. 工程文件与数据格式；
4. 仿真软件接口；
5. 自动化、测试和工程化。

每个主题继续采用清晰正文 + 可运行代码 + 独立仿真实践的结构。新增系列时：

- 在 `tools-learning.ts` 添加 `series` 联合类型成员；
- 创建 `tools-tutorials-{name}-*.ts` 内容文件；
- 在 `tools-tutorials.ts` 添加 import 和 spread；
- 添加 seeds 数组、knowledge points 导出和 chapter order 条目；
- 在 `tools.astro` 添加渲染 section；
- 在 `kp.astro` 添加 slug 前缀检测；
- 更新测试断言。

### P2：工程书库生产验收

- 导入一份版权合规的真实 Markdown + 图片书籍；
- 验证 R2 阅读、图片、公式和版本覆盖；
- 验证同步到 Dify 工程书库；
- 验证 Chatflow 能检索工程书库内容；
- 不把第三方整本受版权保护教材直接公开。

### P2：练习文件（exercises）填充

`src/data/tools-tutorials-apdl-exercises.ts` 当前为占位文件，尚未包含实际练习内容。82 篇教程的 `> 📝 **相关练习**：[ex-xxx-01]` 引用指向的练习需后续创建。每个练习应包含题目描述、提示和参考答案。

### ✅ 已完成：Phase 1 术语/格式标准化

- 32/32 篇教程练习引用格式统一
- 0 处 LaTeX 数学公式残留（全部转换为 Unicode 纯文本）
- 章节结构一致性修正（"特殊单元类型概览"移到正确位置）
- 多余元素清理（重复引用、完成横幅）

---

## 10. 新 Agent 开始工作的推荐提示词

```text
你接手的是 SimuLearn（simulearn.cn）。先阅读 docs/AGENT-HANDOFF.md，
再检查 git status、git log、wrangler.jsonc 和实际线上页面。

当前生产提交是 15b4634，Worker 版本是
b5c3c213-f006-4fc1-a5a7-b98d90ba5a49。

五个仿真领域已有 450 个固定预设知识点。工具教程模块已完成 4 个系列
共 82 篇教程（Python 20 + APDL 32 + NumPy 15 + SciPy 15），按 28 个
主题章节组织。APDL 进阶（第 5 个系列分组）包含 7 篇进阶教程：进阶总结、
APDL Math 入门/运算、结果验证、接触分析、屈曲分析、子模型技术。

工具教程不能恢复初/中/高级混排，不能恢复 AI 拓展、AI 问答或 AI 检验。
仿真实践当前必须保持"案例整理中"，等待用户提供真实案例。

Phase 1 标准化已完成：所有教程练习引用格式统一，LaTeX 数学公式已全部
转换为 Unicode 纯文本。

GitHub Actions CI 已通过（Node 24 + actions v5）。

网站目录中的 simulearn-scripts/ 是空嵌套 Git 仓库，不得提交；
真实脚本仓库位于同级 C:\Users\Lenovo\ZCodeProject\simulearn-scripts。

当前最高优先级是补充真实仿真实践和教程人工校订（优先审核 APDL 进阶 7 篇）。
后续教程扩展参考 AGENT-HANDOFF.md 第 9 节。不要泄漏 Secret，不要复制
第三方教程正文。

重要战略背景：网站当前 82 篇教程均为 AI 生成、未经用户审核。用户的真实价值
在于 4 年 30+ 个项目的仿真经验，需要将这些经验逐篇叠加到 AI 草稿上。
详见 AGENT-HANDOFF.md 第 12 节。

完成修改后运行 npm.cmd run test、npm.cmd run build、
npm.cmd run check:functions、npm.cmd run test:e2e 和 Wrangler dry-run。
```

---

## 11. 附录：文件清单

### 教程内容文件（13 个）

```text
src/data/tools-tutorials-foundation.ts        Python 教程 1/4（8 篇）
src/data/tools-tutorials-language.ts          Python 教程 2/4（6 篇）
src/data/tools-tutorials-control.ts           Python 教程 3/4（4 篇）
src/data/tools-tutorials-structure.ts         Python 教程 4/4（2 篇）
src/data/tools-tutorials-apdl-foundation.ts   APDL 初级 1/4（7 篇）
src/data/tools-tutorials-apdl-commands.ts     APDL 初级 2/4（6 篇）
src/data/tools-tutorials-apdl-mesh-solve.ts   APDL 初级 3/4（6 篇）
src/data/tools-tutorials-apdl-post-advanced.ts APDL 初级 4/4（6 篇）
src/data/tools-tutorials-apdl-advanced.ts     APDL 进阶（7 篇）
src/data/tools-tutorials-numpy-foundation.ts  NumPy 1/2（7 篇）
src/data/tools-tutorials-numpy-advanced.ts    NumPy 2/2（8 篇）
src/data/tools-tutorials-scipy-foundation.ts  SciPy 1/2（6 篇）
src/data/tools-tutorials-scipy-advanced.ts    SciPy 2/2（9 篇）
```

### 页面与组件

```text
src/pages/tools.astro                        工具首页
src/pages/index.astro                        网站首页
src/pages/domains/kp.astro                   知识点详情页
src/components/KnowledgeTree.astro           知识树组件
```

### 基础设施

```text
src/data/tools-learning.ts                   教程元数据与 seeds
src/data/tools-tutorials.ts                  教程内容聚合器
src/data/learning-catalog.ts                 域注册与路由映射
functions/_shared/learning.ts                Worker 端知识组装
```

---

## 12. 战略方向与行动计划

*本节整合自 2026-06-29 的 14 轮深度策略讨论，完整记录见 `.qoderworkcn/workspace/mqz0wxs2dpd6biyt/outputs/simulearn-strategy-summary.md`。*

### 12.1 核心判断

**网站不是伪需求，但目前的形态让它看起来像。** 82 篇 AI 生成的未审核教程 + 不可公开的书库内容 = 一个"看起来有内容但实际是空的"网站。用户的真实工程经验（4 年 30+ 个项目、明确的方法论、Perasim 实战能力）尚未写入网站。

### 12.2 差异化空间

- **文字形式的工程实战经验记录**：视频教程侧重软件操作，缺少文字版的工程判断记录
- **Perasim 国产 CAE 实战内容**：全网几乎空白
- **"仿真工程师的实战笔记"**定位：填补课程和项目之间的断层

### 12.3 行动计划

#### 第 1 周：打地基

| 任务 | 说明 |
|---|---|
| 移除未授权书籍内容 | 书库模块暂时下线或清空，消除版权风险 |
| 选一篇 APDL 教程用方法论重写 | 建议选"网格划分"，用异形体做自由/映射网格对比，写出样板教程 |
| 发给 5 个陌生人收集反馈 | 发到仿真社区、知乎仿真话题等 |

#### 第一个月（第 2-4 周）：双轨并行

每天 4 小时：

| 线路 | 每日时间 | 每周产出 | 说明 |
|---|---|---|---|
| 审核改写新手教程 | 2h | 5-7 篇 | 逐篇审核 AI 草稿，加入方法论、踩坑经验、工程视角 |
| 撰写经验帖 | 2h | 1 篇 | 从项目报告中脱密建模，撰写可复现的实战案例 |

审核教程时的改法原则：

- 每篇至少加入一个"我在实际项目中遇到过"的具体场景
- 能用对比实验说明的，用对比实验
- 能用截图或结果数据佐证的，附上脱密后的真实数据
- AI 写的通用描述保留作为基础，在上面叠加工程判断层

#### 第二个月（第 5-8 周）：Perasim 上线

- Perasim 第一篇实战内容（选日常工作中最常用的操作场景）
- 国产 CAE 社区推广
- 根据第一轮用户反馈调整网站结构

#### 持续节奏（第 9 周起）

- 每周 1 篇经验帖（持续积累核心资产）
- 教程审核完成后转入按需更新模式
- 根据用户增长和反馈决定是否启动案例抽象社区功能

### 12.4 方法论沉淀

建议以 `docs/METHODOLOGY.md` 的形式维护在项目仓库中，持续迭代，内容包括：

1. **教程审核标准**：通读判断准确性 → 补充实际项目场景 → 加入对比实验数据 → 检查代码可运行性 → 标注适用边界
2. **经验帖写作框架**：问题背景 → 遇到的现象 → 排查过程 → 根因分析 → 解决方案 → 可复现的脱密模型和脚本 → 普适结论
3. **仿真工程判断原则**：什么时候该简化模型、网格密度的经验阈值、收敛问题的排查顺序、结果可信度的自检清单
4. **工具使用方法论**：什么情况下用 APDL 而不是 GUI、参数化建模的命名规范、文件管理和版本控制的做法
5. **内容质量标准**：必须有可运行的代码或可复现的模型、必须有对比实验而不是只有结论、必须标注适用范围和局限性

### 12.5 不可逾越的红线

1. **版权**：未授权书籍内容必须在第一次对外展示前全部移除，不存在"先放着以后再说"的选项。
2. **AI 内容审核**：AI 生成的教程在用户亲自审核并加入个人方法论之前，不应作为网站的核心价值来宣传。AI 是工具，不是作者。
3. **职场边界**：用户在仿真秀任职，项目涉及竞品领域。避免使用公司资源、公司项目数据或工作时间开发。脱密是底线。
4. **不堆体量**：不要为了"网站看起来内容丰富"而保留未审核的 AI 内容。10 篇有真材实料的教程比 82 篇 AI 生成的内容更有价值。
5. **不要等"准备好了"再推给用户**：每完成 5 篇审核教程 + 1 篇经验帖，就可以推一轮给陌生人收集反馈。持续验证，不要攒到最后。

### 12.6 如果验证失败怎么办

如果经过一个月的双轨推进和真实用户反馈，发现：

- 没有人愿意花时间读文字教程（更想看视频）
- 经验帖有阅读量但没有复访（看完就走）
- Perasim 内容的受众太小，无法支撑持续增长

那么网站可以转型为：

- **仿真秀内部提案**：把案例抽象和文档体系作为产品建议提交给仿真秀
- **技术博客**：放弃平台化野心，作为个人技术博客持续输出
- **付费社群的免费入口**：经验帖免费公开，系统化教程作为付费社群的增值内容
