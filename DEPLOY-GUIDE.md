# SimuLearn 网站与 Worker 部署

本文只说明网站和 Cloudflare Worker。完整 Dify 部署见 [从零复现指南](docs/REPRODUCTION-GUIDE.md)。

## 1. 准备

- GitHub 账号
- Cloudflare 账号
- Git
- Node.js 20/22 LTS
- 已 fork 或 clone 的仓库

## 2. 本地验证

```bash
npm clean-install
npm run build
npm run check:functions
npx wrangler deploy --dry-run --outdir .wrangler/worker
```

## 3. 创建 Cloudflare Worker

Cloudflare Dashboard → Workers & Pages → Create → Import a repository。

选择仓库后：

```text
Project name: simulearn-site
Production branch: main
Build command: npm run build
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
Root directory: /
```

项目是 Worker Static Assets，不要使用：

```text
npx wrangler pages deploy
```

## 4. Wrangler

仓库已经包含：

```json
{
  "name": "simulearn-site",
  "main": "./worker/index.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/ai", "/ai/*", "/api/ai/*"]
  }
}
```

公开静态资源由 `ASSETS` 提供；`/ai` 和 `/api/ai/*` 先进入 Worker。

## 5. 运行时变量

Cloudflare → Worker → Settings → Variables and Secrets。

普通变量由 `wrangler.jsonc` 管理。仅部署演示站时，先在该文件中改为：

```text
SIMULEARN_AI_MODE=mock
```

完成 Dify 和所有运行时 Secret 后，再改为：

```text
SIMULEARN_AI_MODE=live
DIFY_API_URL=https://ai.example.com
DIFY_REVIEW_FILE_INPUT=documents
MAX_UPLOAD_MB=15
```

真实模式使用 Secret：

```text
DIFY_CHAT_APP_API_KEY
DIFY_REVIEW_APP_API_KEY
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
SIMULEARN_AI_USERNAME
SIMULEARN_AI_PASSWORD
```

Build Variables 不是 Worker Runtime Variables，不能只配置在 Build 面板。

## 6. 绑定域名

Worker → Domains → Add domain：

```text
simulearn.cn
```

Cloudflare 自动生成 Custom Domain DNS。

## 7. 验证

```bash
curl -I https://simulearn.cn/
curl -I https://simulearn.cn/ai
curl -I https://simulearn.cn/api/ai/health
```

`live` 模式未登录时：

```text
/                    200
/ai                  401
/api/ai/health       401
```

## 8. 更新

```bash
git add .
git commit -m "描述修改"
git push origin main
```

Cloudflare 会自动构建和部署。

## 9. 常见错误

- `Missing entry-point`：`wrangler.jsonc` 缺少 Worker `main` 或 `assets`。
- `pages/projects/... 404`：正在用 Pages 命令部署 Worker 项目。
- `/ai 503`：运行时缺少管理员 Secret。
- 首页无法解析：尚未添加 Worker Custom Domain。

完整记录见 [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。
