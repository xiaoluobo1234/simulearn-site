# Agent 交接文档

> 最后更新：2026-06-29
> 前一 Agent 完成：Phase 3.4 脚本 + 书库 Dify 打通（代码侧）
> 待人工完成：3 项线上配置（见第 5 节）

---

## 1. 项目概览

**SimuLearn** — 仿真工程知识平台，面向结构/热/流体/多物理场/芯片仿真 5 个工程领域 + 1 个工程书库。

| 项目 | 说明 |
|---|---|
| 代码仓库 | `C:\Users\Lenovo\ZCodeProject\simulearn-site` |
| 框架 | Astro 4.x 静态站点 |
| 运行时 | Cloudflare Workers (Static Assets + Functions) |
| AI 后端 | Dify 自托管于阿里云 Docker，通过 Cloudflare Tunnel 暴露为 `https://ai.simulearn.cn` |
| LLM | DeepSeek (via Dify) |
| Embedding | text-embedding-v4 (Tongyi) |
| Rerank | qwen3-rerank (Tongyi) |
| 部署方式 | `git push origin main` → Cloudflare 自动构建部署 |
| 本地测试 | `npm run dev` (Astro dev server) |
| 环境 | Windows 11, Git Bash |

---

## 2. 已完成工作

### 2.1 Phase 3.4 — Python 初级知识点 16-20 脚本

位置：`simulearn-scripts/beginner/`

| # | 文件 | 主题 | 行数 | 状态 |
|---|---|---|---|---|
| 16 | `16-csv-export/csv_result_export.py` | CSV 导出 — csv.writer/DictWriter、BOM、参数扫描导出 | ~290 | ✅ 已验证 |
| 17 | `17-matplotlib-basics/matplotlib_basics.py` | Matplotlib — figure/axes、GridSpec、双 y 轴、S-N 曲线 | ~320 | ✅ 已验证 |
| 18 | `18-script-structure/script_structure.py` | 工程化 — dataclass、argparse、logging、main() | ~370 | ✅ 已验证 |
| 19 | `19-unit-conversion/unit_conversion.py` | 单位换算 — UnitValue 类、一致性校验、Mars Climate Orbiter 案例 | ~505 | ✅ 已验证 |
| 20 | `20-project-review/cantilever_analysis.py` | 综合实战 — 悬臂梁完整分析，串起全部知识点 | ~540 | ✅ 已验证 |

### 2.2 工程书库 Dify 接入（代码侧）

在 Dify 控制台创建了第 8 个知识库「SimuLearn｜工程书库」，UUID = `ee2f81e4-250f-462c-aed9-377b46c68166`。

代码中所有 "七个"/"五个" 引用已更新为 "八个"/"六个"，涉及以下 12 个文件：

| 文件 | 修改 |
|---|---|
| `functions/_shared/mock.ts` | 添加 `books` mock 条目 |
| `src/pages/ai/index.astro` | "七个知识区" → "八个知识区" |
| `functions/api/ai/chat.ts` | 演示文案含"工程书库知识库" |
| `README.md` | "七个知识库" → "八个知识库" |
| `docs/AI-KNOWLEDGE-DEPLOYMENT.md` | 7→8 + "六个公开库（含工程书库）" |
| `infra/dify/chat-system-prompt.md` | 添加工程书库到检索范围 + 教材级权威说明 |
| `docs/REPRODUCTION-GUIDE.md` | 标题 + line 539 + expected keys 全部更新 |
| `.dev.vars.example` | `books` UUID = `ee2f81e4-250f-462c-aed9-377b46c68166` |
| `docs/PROJECT-DECISIONS-AND-PROMPTS.md` | 五个→六个、七个→八个、表格添加 books 行 |
| `docs/SECURITY-OPERATIONS.md` | 五个→六个 |
| `docs/TROUBLESHOOTING.md` | 7→8、五个→六个 |
| `docs/DEPLOYMENT-RESULT-2026-06-28.md` | 五个→六个、7→8 |

### 2.3 验证通过

```bash
npm run build        # ✅ 29 pages, 2.59s
npm run check:functions  # ✅ Compiled Worker successfully
```

---

## 3. 关键架构速查

### 3.1 知识库体系（8 个）

| slug | Dify 名称 | 属性 | UUID |
|---|---|---|---|
| `structural` | SimuLearn｜结构 | 公开 | (已有) |
| `thermal` | SimuLearn｜热 | 公开 | (已有) |
| `fluids` | SimuLearn｜流体 | 公开 | (已有) |
| `multiphysics` | SimuLearn｜多物理场 | 公开 | (已有) |
| `chip` | SimuLearn｜芯片仿真 | 公开 | (已有) |
| `books` | SimuLearn｜工程书库 | **公开** | `ee2f81e4-250f-462c-aed9-377b46c68166` |
| `private` | SimuLearn｜私有原始资料 | 私有 | (已有) |
| `review` | SimuLearn｜待审核整理区 | 私有 | (已有) |

### 3.2 数据流

```
用户浏览器 → simulearn.cn (Cloudflare Worker)
  ├─ 静态资源 → ASSETS binding (dist/)
  ├─ /api/ai/chat → Dify Chatflow API (ai.simulearn.cn)
  ├─ /api/ai/review → Dify Workflow API
  ├─ /api/ai/datasets → Dify Dataset API (知识库状态)
  └─ /api/books → R2 bucket (simulearn-books)
```

### 3.3 关键文件位置

```
functions/
  _shared/
    dify.ts          — datasetLabels, DatasetSlug 类型定义 (已含 books)
    mock.ts          — mock 数据 (已含 books 条目)
  api/ai/
    chat.ts          — Chatflow 代理
    review.ts        — 文档整理代理
    datasets.ts      — 知识库状态 API
    upload.ts        — 文档上传
    publish.ts       — 发布到知识库
infra/dify/
  chat-system-prompt.md   — Chatflow 系统提示词 (已含工程书库)
  create-datasets.sh      — 批量创建知识库脚本
src/pages/ai/
  index.astro        — 管理员工作台 (/ai)
  books.astro        — 书库页面
worker/
  index.ts           — Cloudflare Worker 入口
```

### 3.4 本地开发

```bash
# 开发模式 (AI 功能用 mock 模式)
npm run dev

# 模拟线上环境
npx wrangler pages dev dist --port 8788
```

`.dev.vars` 中的 `SIMULEARN_AI_MODE` 设为 `"mock"` 时，AI API 返回 mock 数据，不访问 Dify。

---

## 4. Git 发布

本批次将工程书库接入、工具脚本学习内容、Dify 八知识库配置、书籍同步能力、Cloudflare 自定义域配置和交接文档作为同一版本提交到 `main`。

```bash
cd C:/Users/Lenovo/ZCodeProject/simulearn-site
git add <本批次文件>
git commit -m "feat: 接入工程书库并扩展工具学习内容"
git push origin main
```

独立脚本仓库 `simulearn-scripts` 已在提交 `60653a8` 发布初级 20 个教学脚本。网站仓库内同名空嵌套目录不是源码，不应提交为 gitlink。

---

## 5. 🚀 发布状态（2026-06-29）

Cloudflare Secret 更新、Worker 重新部署和 Dify Chatflow 知识检索节点配置均已完成。

### 步骤 1：更新 Cloudflare Worker Secret `DIFY_DATASETS_JSON`（已完成）

线上 Secret 已更新为包含 8 个知识库 UUID 的有效 JSON。

```bash
npx.cmd wrangler secret put DIFY_DATASETS_JSON --name simulearn-site
```

Windows PowerShell 若报“无法加载 `npx.ps1`，因为在此系统上禁止运行脚本”，应使用 `npx.cmd`。本次用户复制的内容只有 8 行键值对，缺少最外层 `{}`，这是“配置不是有效 JSON”的直接原因；补全大括号、压缩为一行并验证 8 个 UUID 后已上传成功。

> 后续更新仍必须一次提交全部 8 个 key，不能只提交 `books`，否则会覆盖整个 Secret。

### 步骤 2：Dify Chatflow 配置知识检索节点（已完成）

1. 登录 Dify 控制台 (`https://ai.simulearn.cn`)
2. 进入 **SimuLearn Knowledge Assistant** Chatflow
3. 找到 **知识检索** 节点
4. 在数据集选择列表中 **勾选「SimuLearn｜工程书库」**
5. 保存并发布 Chatflow

> 当前已勾选的公开库：结构、热、流体、多物理场、芯片仿真。新增勾选：工程书库。
> **不要勾选**：私有原始资料、待审核整理区。

已由用户在 Dify Chatflow 中确认并发布，知识检索节点当前包含六个公开知识库。

### 步骤 3：触发 Cloudflare 重新部署（已完成）

正式部署版本：

```text
Worker: simulearn-site
Custom domain: simulearn.cn
Version ID: 1bb3c94b-ccd6-42dc-abf3-5a4385bbec93
```

`wrangler.jsonc` 已显式添加 `simulearn.cn` 自定义域路由。否则直接执行 `wrangler deploy` 会覆盖控制台远程路由配置，使新版本只出现在 `workers.dev`，主域名仍返回旧版本。

线上验证结果：主页 200 且内容与本地构建一致（Cloudflare 额外注入 Web Analytics 脚本）；学习进度 API 200 并设置匿名 Cookie；管理员 API 未登录返回 401。

---

## 6. 常见问题

### Q: `DIFY_DATASETS_JSON 配置不是有效 JSON`
- 确认是**一行** JSON，无换行
- 用 `jq -c .` 压缩验证
- 确认 8 个 key 都存在：`structural, thermal, fluids, multiphysics, chip, books, private, review`

### Q: Chatflow 回答中没有用到工程书库资料
- 检查步骤 2 是否已勾选并**发布** Chatflow
- 检查书库中是否已上传文档且状态为"可检索"

### Q: 本地 `npm run build` 报错
- 确认 `.dev.vars.example` 中 `books` UUID 已更新（已是 `ee2f81e4-250f-462c-aed9-377b46c68166`）
- 确认 `functions/_shared/dify.ts` 中 `datasetLabels` 包含 `books: '工程书库'`（已有，无需修改）

### Q: Windows Git Bash 中 `npx wrangler` 崩溃 (Assertion failed: UV_HANDLE_CLOSING)
- 加 `--name simulearn-site` 参数
- 或使用 PowerShell / CMD 执行
- 或直接在 Cloudflare Dashboard 网页修改 Secret

---

## 7. 后续开发建议

1. **书库内容导入**：通过 Dify Web UI 或 API 向「SimuLearn｜工程书库」上传教材级资料
2. **书库前端页面**：`src/pages/books/` 和 `src/pages/ai/books.astro` 可能需要适配真实书库内容
3. **R2 Bucket**：`simulearn-books` 用于存储书库原始文件，需确认与 Dify 知识库的同步策略
4. **Phase 4**：如果继续脚本开发，下一批是中级知识点（中级 1-5）
