# SimuLearn 从零复现指南

本文给出最终验证通过的复现路径。历史上尝试过 Cloudflare Pages、直接公网 HTTPS 和 Cloudflare Access，但最终上线架构是：

```text
公开浏览器
    │
    ▼
simulearn.cn
Cloudflare Worker + Static Assets
    ├─ 公开 Astro 静态网站
    ├─ /ai：Basic Auth 管理员工作台
    └─ /api/ai/*：Basic Auth + 同源 Dify 代理
                  │
                  ▼
             ai.simulearn.cn
             Cloudflare Tunnel
                  │
                  ▼
        阿里云 Linux / Docker / Dify
          ├─ PostgreSQL
          ├─ Redis
          ├─ Weaviate
          ├─ Dify API / Worker / Web
          ├─ DeepSeek API
          └─ 通义千问 Embedding / Rerank
```

## 1. 安全占位符

全文使用以下占位符。不要把真实值提交到 Git：

| 占位符 | 含义 |
|---|---|
| `<REPO_URL>` | 你的 GitHub 仓库 |
| `<SERVER_IP>` | 云服务器公网 IP |
| `<SERVER_USER>` | SSH 用户 |
| `<TUNNEL_UUID>` | Cloudflare Tunnel UUID |
| `<DIFY_APP_KEY>` | Dify App API Key |
| `<DIFY_DATASET_KEY>` | Dify 知识库服务 API Key |
| `<ADMIN_PASSWORD>` | `/ai` Basic Auth 密码 |
| `<ACCOUNT_ID>` | Cloudflare 账户 ID |

API Key、密码、私钥、Tunnel credentials、Cloudflare Token 和 `datasets.json` 都不能提交。

## 2. 准备本地环境

推荐：

- Git 2.40+
- Node.js 20 或 22 LTS
- npm 10+
- PowerShell 或 Git Bash

Windows Git 默认路径示例：

```text
C:\Program Files\Git
```

克隆并安装：

```bash
git clone <REPO_URL>
cd simulearn-site
npm clean-install
npm run build
```

本地静态开发：

```bash
npm run dev
```

本地 Worker/AI 开发：

```bash
cp .dev.vars.example .dev.vars
npm run dev:ai
```

`.dev.vars` 已被 Git 忽略，仍要避免截图或复制真实密钥到聊天、Issue 和日志。

## 3. 准备阿里云服务器

最终验证环境：

- Alibaba Cloud Linux 3 / OpenAnolis
- 2 vCPU
- 8 GiB 规格，系统可见约 7.3 GiB
- Docker 26
- Docker Compose v2
- Git
- curl
- 至少 25 GiB 可用磁盘

上线前先创建磁盘快照。

检查：

```bash
cat /etc/os-release
free -h
docker --version
docker compose version
git --version
curl --version
```

服务器原先没有 Swap。Dify 能在 8 GiB 规格运行，但导入大文档或并发任务时应监控内存。

## 4. 获取仓库

首次：

```bash
cd ~
git clone <REPO_URL>
cd simulearn-site
git log -1 --oneline
```

目录已存在时不要再次 `git clone`：

```bash
cd ~/simulearn-site
git pull --ff-only
git log -1 --oneline
```

中国大陆网络下 `github.com` 可能超时。仓库更新失败时先检查：

```bash
curl -I --connect-timeout 10 --max-time 20 https://api.github.com
curl -I --connect-timeout 10 --max-time 20 https://raw.githubusercontent.com
curl -I --connect-timeout 10 --max-time 20 https://codeload.github.com
```

不要使用来源不明的 GitHub 镜像下载包含脚本或二进制的内容。

## 5. 安装 Dify

仓库脚本：

```bash
sudo bash ~/simulearn-site/infra/dify/bootstrap-dify.sh
```

脚本会：

1. 要求 root；
2. 检查 Docker、Compose、curl、openssl、tar；
3. 要求 8 GiB 规格；
4. 通过 GitHub API读取最新稳定版本；
5. 从 `codeload.github.com` 下载官方 Release tarball；
6. 安装到 `/opt/dify`；
7. 复制 `.env.example`；
8. 生成随机 `SECRET_KEY`；
9. 设置 15 MB 单文件、5 文件一批；
10. 拉取镜像并启动 Compose。

成功后：

```bash
cd /opt/dify/docker
sudo docker compose ps
curl -I http://127.0.0.1
```

首次未初始化时，`curl` 返回 `307` 且 `location: /install` 是正常现象。

## 6. Docker Hub 受限时的镜像处理

直接拉取可能出现：

```text
Get "https://registry-1.docker.io/v2/": connect: connection refused
i/o timeout
context canceled
```

先配置可信镜像加速。示例 `/etc/docker/daemon.json`：

```json
{
  "default-address-pools": [
    {
      "base": "10.255.0.0/16",
      "size": 24
    }
  ],
  "registry-mirrors": [
    "https://<YOUR_ACCELERATOR>",
    "https://mirrors-ssl.aliyuncs.com/"
  ]
}
```

验证并重启：

```bash
sudo dockerd --validate --config-file=/etc/docker/daemon.json
sudo systemctl restart docker
sudo systemctl is-active docker
sudo docker info
```

镜像加速仍失败时，可以从可信代理按 Compose 中的精确 digest 拉取，再打回官方标签：

```bash
sudo docker pull m.daocloud.io/docker.io/<IMAGE>@sha256:<DIGEST>
sudo docker tag m.daocloud.io/docker.io/<IMAGE>@sha256:<DIGEST> <IMAGE>:<TAG>
```

然后：

```bash
cd /opt/dify/docker
sudo docker compose up -d --pull never
sudo docker compose ps
```

历史安装 Dify 1.15.0 时手动处理过：

- `langgenius/dify-api`
- `langgenius/dify-web`
- `langgenius/dify-plugin-daemon`
- `langgenius/dify-sandbox`

Digest 与版本绑定，不能在未来版本直接照抄历史 digest。

访问 `https://m.daocloud.io/v2/` 返回 `401` 和 Bearer challenge 通常表示 Registry 正常，而不是代理不可用。

## 7. 配置 Dify 外部 URL

编辑：

```text
/opt/dify/docker/.env
```

设置：

```dotenv
CONSOLE_API_URL=https://ai.simulearn.cn
CONSOLE_WEB_URL=https://ai.simulearn.cn
SERVICE_API_URL=https://ai.simulearn.cn
APP_API_URL=https://ai.simulearn.cn
APP_WEB_URL=https://ai.simulearn.cn
FILES_URL=https://ai.simulearn.cn
NGINX_SERVER_NAME=ai.simulearn.cn
```

Tunnel 以 `http://localhost:80` 连接时，可以保持：

```dotenv
NGINX_HTTPS_ENABLED=false
```

只有源站 Nginx 自己终止 TLS 时才设置为 `true` 并安装证书。

应用：

```bash
cd /opt/dify/docker
sudo docker compose up -d --pull never
curl -I http://127.0.0.1
```

不要在公开日志中贴出完整 `.env`，其中包含数据库和应用 Secret。

## 8. Cloudflare Tunnel

最终方案不把 Dify 管理端直接暴露给公网。

### 8.1 安装

Alibaba Cloud Linux 可添加 Cloudflare 官方软件源后安装：

```bash
sudo yum install -y cloudflared
cloudflared --version
```

### 8.2 登录和创建

```bash
cloudflared tunnel login
cloudflared tunnel create simulearn-dify
```

浏览器授权后，证书通常保存在：

```text
/home/<SERVER_USER>/.cloudflared/cert.pem
```

创建配置文件：

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<SERVER_USER>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: ai.simulearn.cn
    service: http://localhost:80
  - service: http_status:404
```

创建 DNS：

```bash
cloudflared tunnel route dns simulearn-dify ai.simulearn.cn
```

前台测试：

```bash
cloudflared --config /home/<SERVER_USER>/.cloudflared/config.yml tunnel run
```

看到多条 `Registered tunnel connection` 和 Connectivity Pre-check `PASS` 后，用 `Ctrl+C` 结束前台测试。退出时的 `context canceled` 和 graceful shutdown 日志是正常的。

安装 systemd：

```bash
sudo cloudflared --config /home/<SERVER_USER>/.cloudflared/config.yml service install
sudo systemctl status cloudflared
```

浏览器检查：

```text
https://ai.simulearn.cn/install
```

完成管理员初始化。

### 8.3 收紧安全组

Tunnel 运行后：

- SSH 22 只允许可信 IP；
- 关闭公网 80、443；
- PostgreSQL、Redis、Weaviate、Dify API 和插件端口不对公网开放；
- ICMP 是否保留按运维需求决定。

验证监听：

```bash
sudo ss -lntp | grep -E '(:80|:443)[[:space:]]'
```

Docker 仍可在本机监听 80/443，但云安全组不应允许公网直连。

## 9. 直接 Origin 证书方案为何不是最终方案

历史上创建过 Cloudflare Origin Certificate：

- 主机：`*.simulearn.cn`、`simulearn.cn`
- RSA 2048
- 15 年有效期
- Dify Nginx 配置 `dify.crt` 和 `dify.key`
- Cloudflare SSL 模式切到 Full (strict)

还验证了：

```bash
sudo openssl x509 -in /opt/dify/docker/nginx/ssl/dify.crt -noout -subject -issuer -dates
sudo openssl x509 -in /opt/dify/docker/nginx/ssl/dify.crt -noout -ext subjectAltName
```

证书和私钥指纹也做过匹配验证。

该路径仍依赖 Cloudflare 能从公网访问服务器 443，并要求正确证书链和安全组。最终改用 Tunnel 后，入口服务是 `http://localhost:80`，公网不再需要 80/443。Origin 证书可以保留，但不是 Tunnel 链路的必要条件。

## 10. Dify 模型配置

### 10.1 DeepSeek

在 Dify Marketplace 安装 DeepSeek Provider，配置 API Key。

最终选择的系统推理模型：

```text
deepseek-v4-flash
```

模型名称随 Provider 更新可能变化，以 Dify 界面实际可用名称为准。

### 10.2 通义千问

安装通义 Provider，配置阿里云百炼 API Key。

最终默认设置：

```text
Embedding: text-embedding-v4
Rerank: qwen3-rerank
```

可选语音设置：

```text
语音转文本: paraformer-realtime-v1
文本转语音: qwen3-tts-flash
```

如果百炼 API Key 启用了模型白名单，至少授权：

```text
text-embedding-v4
qwen3-rerank
qwen-flash
```

`qwen-flash` 是因为 Dify Provider 保存凭据时可能调用它做校验。缺少时会出现 `403 Access denied by API-Key restrictions`，即使 Embedding 和 Rerank 已在白名单。

如果启用 IP 白名单，应填写云服务器出口公网 IP `/32`，而不是个人电脑 IP。

## 11. 创建八个知识库

先在 Dify 知识库页创建服务 API Key。

服务器临时设置：

```bash
export DIFY_API_URL="https://ai.simulearn.cn"
export DIFY_DATASET_API_KEY="<DIFY_DATASET_KEY>"
export DIFY_EMBEDDING_MODEL="text-embedding-v4"
export DIFY_EMBEDDING_PROVIDER="<COPY_FROM_DIFY>"
```

运行：

```bash
cd ~/simulearn-site
bash -n infra/dify/create-datasets.sh
bash infra/dify/create-datasets.sh
```

输出保存到：

```text
/home/<SERVER_USER>/datasets.json
```

验证：

```bash
jq -r 'type, (keys | join(","))' /home/<SERVER_USER>/datasets.json
```

预期：

```text
object
chip,books,fluids,multiphysics,private,review,structural,thermal
```

提供给 Cloudflare 时压成一行，并包含最外层 `{}`：

```bash
jq -c . /home/<SERVER_USER>/datasets.json
```

使用完清除终端临时变量：

```bash
unset DIFY_DATASET_API_KEY
```

## 12. 创建资料整理 Workflow

名称：

```text
SimuLearn Document Organizer
```

节点：

```text
用户输入
  ├─ filename: 文本，必填
  └─ documents: 文件列表，必填
       ↓
文档提取器
       ↓
LLM / deepseek-v4-flash
       ↓
结构化输出
       ↓
输出
```

`documents` 建议：

- 文档和图片；
- 本地上传与 URL；
- 最大 5 个；
- 单文件上限与 Dify `.env`、网站 `MAX_UPLOAD_MB` 保持一致。

LLM：

- SYSTEM 使用 `infra/dify/review-workflow-prompt.md`；
- USER 插入 `filename` 和文档提取器的 `text`；
- 开启结构化输出；
- Schema 使用 `summary`、`category`、`tags`、`sensitivity`、`copyright_risk`。

输出节点逐项绑定结构化字段。

测试成功后发布，并在“访问 API”创建 Workflow App API Key。

## 13. 创建知识问答 Chatflow

名称：

```text
SimuLearn Knowledge Assistant
```

节点：

```text
用户输入
       ↓
知识检索
       ↓
LLM / deepseek-v4-flash
       ↓
直接回复
```

知识检索：

- 查询绑定 `sys.query`；
- 只选择结构、热、流体、多物理场、芯片仿真和工程书库；
- 不选择私有原始资料和待审核整理区；
- Rerank：`qwen3-rerank`；
- Top K：6；
- Score 阈值：关闭，后续按语料质量调优。

LLM：

- 上下文绑定“知识检索 → result”；
- SYSTEM 使用 `infra/dify/chat-system-prompt.md`；
- USER 插入用户 query；
- 直接回复绑定 LLM `text`。

测试时上传一份安全的自编资料到结构库，例如：

```text
infra/dify/sample-review-document.txt
```

确认回答：

- 引用了测试文档；
- 区分收敛和准确；
- 给出验证顺序；
- 不伪造数据。

发布并创建 Chatflow App API Key。

## 14. Cloudflare Worker 部署

本项目最终是 Worker，不是 Pages。

### 14.1 Wrangler 配置

`wrangler.jsonc`：

```json
{
  "name": "simulearn-site",
  "main": "./worker/index.ts",
  "compatibility_date": "2026-06-27",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/ai", "/ai/*", "/api/ai/*"]
  }
}
```

Worker 先处理受保护路径和 API，其余交给 `env.ASSETS.fetch(request)`。

### 14.2 Git 构建设置

Cloudflare → Workers & Pages → `simulearn-site` → Settings → Builds：

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
Root directory: /
Production branch: main
```

构建令牌必须具备 Worker 部署权限。不要选择只有 Cloudflare Pages Edit 权限的 Token。

### 14.3 运行时变量与密钥

注意有两个不同位置：

1. Build → Variables and Secrets：只在构建容器中可见；
2. Settings → Variables and Secrets：Worker 运行时绑定。

AI Key 必须配置在第二个位置。

普通变量已在 `wrangler.jsonc`：

```text
SIMULEARN_AI_MODE=live
DIFY_API_URL=https://ai.simulearn.cn
DIFY_REVIEW_FILE_INPUT=documents
MAX_UPLOAD_MB=15
```

运行时加密密钥：

```text
DIFY_CHAT_APP_API_KEY
DIFY_REVIEW_APP_API_KEY
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
SIMULEARN_AI_USERNAME
SIMULEARN_AI_PASSWORD
```

启用 Cloudflare Access 保护 Dify 时再增加：

```text
DIFY_ACCESS_CLIENT_ID
DIFY_ACCESS_CLIENT_SECRET
```

`DIFY_DATASETS_JSON` 是一个完整 JSON 对象，必须包含 `{` 和 `}`。

### 14.4 自定义域

Worker → Domains → Add domain：

```text
simulearn.cn
```

Cloudflare 自动创建 Worker Custom Domain DNS。`ai.simulearn.cn` 继续由 Tunnel 管理，两者互不冲突。

## 15. Basic Auth 与 Access

当前 Worker 在 `live` 模式保护：

```text
/ai
/ai/*
/api/ai/*
```

公开首页和其他页面不要求登录。

生成管理员密码：

```bash
openssl rand -base64 24
```

Basic Auth 是可用的单管理员方案，但浏览器可能缓存凭据，也缺少细粒度身份审计。具备条件后可迁移到 Cloudflare Access：

- Self-hosted Application；
- 精确邮箱白名单；
- One-time PIN；
- Dify 端另建 Service Token；
- Worker 到 Dify 使用 Service Auth。

不要仅启用 One-time PIN 而不限制邮箱。

## 16. 验收

### 16.1 HTTP

未登录：

```bash
curl -I https://simulearn.cn/
curl -I https://simulearn.cn/ai
curl -I https://simulearn.cn/api/ai/health
```

预期：

```text
/                      200
/ai                    401 + WWW-Authenticate
/api/ai/health         401 + WWW-Authenticate
```

### 16.2 网站

- 使用管理员账号登录 `/ai`；
- 顶部显示“实时知识库已连接”；
- 知识问答能返回来源；
- 回答中没有 `<think>`；
- 上传测试文档能生成分类、标签、敏感信息与版权建议；
- 不勾选两项人工确认时不能发布；
- 发布到待审核区后状态由 `parsing` 变为可检索；
- 知识库状态页显示 8 个知识区。

### 16.3 代码

```bash
npm run build
npm run check:functions
npx wrangler deploy --dry-run --outdir .wrangler/worker
git diff --check
git status -sb
```

## 17. 日常更新

```bash
git add .
git commit -m "描述本次修改"
git push origin main
```

Cloudflare 自动构建。构建失败时先看最后一个 `ERROR`，不要被 `npm audit` 警告干扰。

## 18. 官方参考

- [Dify GitHub](https://github.com/langgenius/dify)
- [Dify Releases](https://github.com/langgenius/dify/releases)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers Static Assets Get Started](https://developers.cloudflare.com/workers/static-assets/get-started/)
- [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers Builds Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare Locally-managed Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
