# SimuLearn 网站构建说明

本文解释网站代码如何组织、如何从结构仿真站点扩展到五领域平台，以及如何继续添加页面和功能。

## 1. 技术选择

```text
Astro 4
TypeScript
原生 CSS
Vanilla JavaScript
Cloudflare Worker
Cloudflare Static Assets
```

选择 Astro 的原因：

- 内容站静态输出；
- 默认少量客户端 JavaScript；
- 页面和组件结构清晰；
- 可逐步增加 Worker API；
- 适合 Markdown/Content Collections 的未来迁移；
- 构建结果可部署到多数静态平台。

## 2. 信息架构

公开网站：

```text
/
├─ /domains/structural
├─ /domains/thermal
├─ /domains/fluids
├─ /domains/multiphysics
├─ /domains/chip
├─ /cases
├─ /diagnostic
├─ /failures
├─ /tools
├─ /errors
├─ /roadmap
├─ /blog
├─ /about
└─ /en/*
```

管理员：

```text
/ai
├─ 知识问答
├─ 资料整理
├─ 审核记录
└─ 知识库状态
```

## 3. 目录

```text
src/
├─ components/
│  ├─ Header.astro
│  ├─ Footer.astro
│  ├─ ArticleCard.astro
│  ├─ DiagnosticCard.astro
│  ├─ FailureCase.astro
│  ├─ CalcFEA.astro
│  └─ ErrorLookup.astro
├─ data/
│  ├─ domains.ts
│  └─ roadmap.ts
├─ layouts/
│  └─ BaseLayout.astro
├─ pages/
│  ├─ ai/index.astro
│  ├─ cases/
│  ├─ domains/[slug].astro
│  ├─ en/
│  └─ ...
└─ styles/global.css

functions/
├─ _shared/
└─ api/ai/

worker/
└─ index.ts
```

## 4. BaseLayout

`BaseLayout.astro` 负责：

- HTML 语言；
- 标题和 description；
- favicon；
- 字体和全局 CSS；
- Header；
- 页面 slot；
- Footer；
- 可选全宽页面布局。

新页面通常写成：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="页面标题" description="页面描述" lang="zh">
  <main>
    ...
  </main>
</BaseLayout>
```

## 5. 领域数据驱动

五领域配置维护在：

```text
src/data/domains.ts
```

动态页面：

```text
src/pages/domains/[slug].astro
```

Astro 在构建期通过 `getStaticPaths()` 为每个 slug 生成静态页面。

增加新领域时：

1. 在 `domains.ts` 增加数据；
2. 在 Header 中确认导航；
3. 增加对应路线和内容；
4. 在 Dify 创建知识库；
5. 更新 `DatasetSlug` 和 `DIFY_DATASETS_JSON`；
6. 更新 Chatflow 检索范围；
7. 运行全量构建。

## 6. 统一栏目

每个领域固定七类内容：

```text
学习路线
理论基础
建模方法
验证方法
实操案例
故障诊断
工具脚本
```

这样做的目的：

- 用户可以横向比较领域；
- 新内容有明确归档位置；
- AI 分类和知识库标签保持一致；
- 十年路线可以按同一框架更新。

## 7. 十年路线

数据：

```text
src/data/roadmap.ts
```

页面：

```text
src/pages/roadmap.astro
```

路线状态必须明确：

```text
已实践
学习中
路线规划
```

不能把计划项目写成已经完成。

## 8. 诊断库

组件：

```text
src/components/DiagnosticCard.astro
```

结构：

```text
现象
判定逻辑
可能根因
解决方法
验证方法
```

适合记录：

- 不收敛；
- 刚体位移；
- 应力奇异；
- 接触穿透；
- 能量异常；
- 网格依赖；
- 热平衡或质量守恒问题。

## 9. 失败博物馆

组件：

```text
src/components/FailureCase.astro
```

强调：

- 发生了什么；
- 当时为什么会犯错；
- 哪个证据暴露问题；
- 如何复盘；
- 如何防止复发。

失败案例不能只写“参数填错了”，还要说明判断链条为什么失效。

## 10. 工具箱

`CalcFEA.astro` 使用原生表单和客户端 JS，根据：

- 载荷类型；
- 变形比；
- 长径比；
- 接触；
- 材料非线性；

给出分析类型、网格和收敛建议。

工具输出是初步建议，不替代模型验证。

## 11. 错误查询

`ErrorLookup.astro` 当前将错误数据内嵌在组件中，支持：

- 文本搜索；
- 软件筛选；
- 错误说明；
- 原因；
- 处理建议。

规模变大后应迁移为独立 JSON 或 Content Collection。

## 12. 案例

目录：

```text
src/pages/cases/
public/images/cases/
```

案例页应包括：

```text
问题
模型与假设
输入
网格
求解
结果
验证
失败与限制
复用条件
来源与授权
```

图片不得包含客户水印、文件路径、用户名或机器信息。

## 13. 双语

中文是主站，英文位于 `/en/`。

当前英文只维护核心定位和精选内容，没有机械复制全部中文页面。新增重要页面时至少检查：

- Header 语言切换；
- title/description；
- 英文路径；
- Footer；
- 移动端导航。

## 14. 视觉系统

全局样式：

```text
src/styles/global.css
```

设计方向：

- 深蓝黑工程底色；
- 青绿色状态与交互色；
- 米白纸张背景；
- Serif 正文；
- Mono 标签、编号和技术字段；
- 边框和网格表达工程文档感；
- 避免通用 SaaS 大圆角和渐变模板感。

所有新组件应优先复用 CSS token，而不是写孤立颜色。

## 15. AI 工作台

页面：

```text
src/pages/ai/index.astro
```

它使用原生 JS 调用同源 API，不直接请求 Dify：

```text
GET  /api/ai/health
GET  /api/ai/datasets
GET  /api/ai/status
POST /api/ai/chat
POST /api/ai/analyze
POST /api/ai/publish
```

状态保存在当前页面会话中：

- 当前文件；
- 当前分析结果；
- conversation ID；
- 当前审核记录。

刷新页面后审核记录不会长期保存；长期审核日志应在后续版本写入数据库或 Dify 元数据。

## 16. API 共享层

```text
functions/_shared/dify.ts
```

负责：

- 环境变量类型；
- Dataset slug；
- JSON 响应；
- 错误转换；
- same-origin 检查；
- 用户匿名 ID；
- 文件扩展名和大小校验；
- Dify URL 和鉴权；
- Dataset Map 解析。

所有 Dify 请求由 Worker 发起，浏览器看不到 Key。

## 17. Chat API

`functions/api/ai/chat.ts`：

- 要求 JSON；
- query 必填；
- 最大 4000 字；
- 将页面选择的领域写入问题前缀；
- 调用 Dify `/v1/chat-messages`；
- 返回 answer、conversation ID、来源和 usage；
- 移除 `<think>` 模型内部推理内容。

## 18. Analyze API

`functions/api/ai/analyze.ts`：

1. 验证文件；
2. 上传到 Dify App；
3. 调用 Workflow；
4. 传 `documents` 和 `filename`；
5. 读取结构化输出；
6. 对 category 做白名单检查；
7. 返回审核草案。

## 19. Publish API

`functions/api/ai/publish.ts`：

- 接收管理员确认后的文件和目标 slug；
- 使用 Dataset API Key；
- 创建 `high_quality` 文档；
- 使用自动分段；
- 返回 batch 和 indexing status。

页面通过 status API 查询索引状态。

## 20. Worker 入口

`worker/index.ts` 负责：

1. `/ai` 和 `/api/ai/*` Basic Auth；
2. 请求方法和路径分发；
3. 调用复用的 API handler；
4. 其余请求交给 Static Assets。

`wrangler.jsonc` 中：

```json
"run_worker_first": ["/ai", "/ai/*", "/api/ai/*"]
```

确保 `/ai/index.html` 即使存在，也必须先经过鉴权。

## 21. 新增页面

1. 在 `src/pages/` 创建 `.astro`；
2. 使用 `BaseLayout`；
3. 在 `src/config.ts` 或 Header 增加导航；
4. 添加 SEO title/description；
5. 检查中文和英文入口；
6. 检查桌面和移动端；
7. 运行构建。

## 22. 新增文章

当前文章仍以页面文件维护，详见：

```text
HOW-TO-ADD-ARTICLES.md
```

未来建议迁移 Astro Content Collections：

- Markdown；
- Frontmatter schema；
- 标签；
- 日期；
- 草稿；
- RSS；
- Pagefind 搜索。

## 23. 构建与部署

```bash
npm run build
npm run check:functions
npx wrangler deploy --dry-run --outdir .wrangler/worker
git diff --check
```

成功构建应生成 25 个或更多静态页面。数量随着内容增加而变化。

## 24. 已知技术债

- 文章未迁移 Content Collections；
- 审核记录只在页面会话中；
- Basic Auth 仅适合单管理员；
- 错误代码仍内嵌；
- 英文内容不是完整镜像；
- 需要移动端持续测试；
- 需要自动备份和费用告警；
- 未来可以增加检索评估集和召回质量监控。

