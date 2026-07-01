# SimuLearn

工程书库采用管理员手动解析、上传 Markdown/JSON 和图片的轻量方案：
[`docs/BOOK-MANUAL-IMPORT.md`](docs/BOOK-MANUAL-IMPORT.md)。

SimuLearn 是一个从结构有限元出发，面向结构、热、流体、多物理场和芯片仿真的知识与实训平台。

网站不仅记录软件操作，还记录物理假设、判断依据、验证方法、失败复盘、适用边界和不确定性。

## 已实现

- Astro 4 中文主站与精选英文内容；
- 五领域统一学习与实操架构；
- 2026—2036 公开学习路线；
- 诊断库、失败博物馆、工具箱和错误查询；
- 工程案例与脱敏规则；
- 自托管 Dify；
- DeepSeek 问答与资料整理；
- 通义千问 Embedding 与 Rerank；
- 八个知识库；
- 管理员知识库工作台 `/ai`；
- Cloudflare Worker 同源 API 和 Basic Auth；
- Cloudflare Tunnel 连接阿里云 Dify；
- 人工审核后发布到知识库。

## 最终架构

```text
simulearn.cn
Cloudflare Worker + Static Assets
  ├─ Astro 公开网站
  ├─ /ai 管理员工作台
  └─ /api/ai/* Dify 代理
          │
          ▼
ai.simulearn.cn
Cloudflare Tunnel
          │
          ▼
Alibaba Cloud Linux / Docker / Dify
  ├─ DeepSeek
  ├─ text-embedding-v4
  ├─ qwen3-rerank
  └─ 5 个公开库 + private + review
```

本项目部署到 **Cloudflare Workers Static Assets**，不是 Cloudflare Pages。

## 文档

| 文档 | 内容 |
|---|---|
| [唯一 Agent 交接文档](AGENTS.md) | 模块边界、产品路线、架构、部署、安全约束与下一步 |
| [需求、决策与提示词](docs/PROJECT-DECISIONS-AND-PROMPTS.md) | 项目定位、问答决策、提示词、版本演进 |
| [网站构建说明](docs/WEBSITE-BUILD.md) | Astro 信息架构、组件、视觉、AI 页面和 Worker API |
| [从零复现指南](docs/REPRODUCTION-GUIDE.md) | 服务器、Docker、Tunnel、Dify、模型、知识库、Worker |
| [完整故障排查](docs/TROUBLESHOOTING.md) | 实际遇到的错误、根因和修复 |
| [安全、备份与运维](docs/SECURITY-OPERATIONS.md) | 脱敏、密钥、备份、预算、巡检、事件响应 |
| [首次部署结果快照](docs/DEPLOYMENT-RESULT-2026-06-28.md) | 版本、容器、模型、验证结果和历史 digest |
| [AI 部署速查](docs/AI-KNOWLEDGE-DEPLOYMENT.md) | 已有部署的日常检查与配置清单 |
| [基础部署指南](DEPLOY-GUIDE.md) | 仅部署网站和 Worker |
| [添加文章](HOW-TO-ADD-ARTICLES.md) | 手动添加内容 |
| [贡献指南](CONTRIBUTING.md) | 内容标准、开发和 Pull Request |
| [安全策略](SECURITY.md) | 私密报告漏洞和泄漏响应 |

## 本地开发

```bash
npm clean-install
npm run dev
```

生产构建：

```bash
npm run build
npm run check:functions
npx wrangler deploy --dry-run --outdir .wrangler/worker
```

本地 AI Worker：

```bash
cp .dev.vars.example .dev.vars
npm run dev:ai
```

真实密钥只能写入 `.dev.vars` 或 Cloudflare Worker Secret。

## Cloudflare 构建

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
Root directory: /
```

## 关键入口

- 领域配置：`src/data/domains.ts`
- 十年路线：`src/data/roadmap.ts`
- 站点配置：`src/config.ts`
- 工程案例：`src/pages/cases/`
- 全局视觉：`src/styles/global.css`
- AI 页面：`src/pages/ai/index.astro`
- Worker 入口：`worker/index.ts`
- AI API：`functions/api/ai/`
- Dify 脚本：`infra/dify/`
- Dify 提示词：`infra/dify/*.md`

## 内容规则

1. 标注“已实践、学习中、路线规划”。
2. 原始工程数据默认私有。
3. 公开前必须完成人工授权、脱敏和版权检查。
4. 第三方论文只公开引用、必要短摘要和个人笔记。
5. 证据不足时明确写“不确定”。
6. AI 只提供整理和判断辅助，最终公开决定由管理员完成。

## 开源注意

仓库不能包含：

- API Key；
- 密码；
- Cloudflare Token；
- Tunnel credentials；
- 证书私钥；
- `datasets.json`；
- 客户、项目和个人敏感信息。

项目暂未选择正式开源许可证。公开发布前需要由维护者决定代码许可证，以及文章、图片和工程内容的许可方式。
