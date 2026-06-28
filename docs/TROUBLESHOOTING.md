# SimuLearn 完整故障排查记录

本文按实际部署过程整理错误现象、根因和最终修复。版本、网络和供应商界面会变化；先理解根因，再执行命令。

## 1. Git Bash 粘贴出现 `^[[200~`

错误：

```text
bash: $'\E[200~git': command not found
```

原因：终端的 bracketed paste 控制字符被当成命令内容。

处理：

- 重新粘贴纯命令；
- 不复制终端提示符 `$`；
- 本项目指导中尽量一次只执行一条命令。

正确示例：

```bash
git config http.version HTTP/1.1
```

## 2. `git push` 被重置或超时

错误：

```text
Recv failure: Connection was reset
Failed to connect to github.com port 443
```

处理顺序：

```bash
git config --global http.version HTTP/1.1
curl -4 -I --connect-timeout 10 https://github.com
git push origin main
```

如果 `curl -4` 返回 200 而 Git 仍超时，等待数十秒重试。不要因为一次网络失败重新提交，先用：

```bash
git status
git log -1 --oneline
```

确认本地提交是否已经存在。

## 3. 服务器再次 clone 提示目录已存在

错误：

```text
fatal: destination path 'simulearn-site' already exists and is not an empty directory.
```

原因：仓库已经克隆。

处理：

```bash
cd ~/simulearn-site
git pull --ff-only
git log -1 --oneline
```

## 4. 服务器能访问 GitHub API，但 `git pull` 超时

现象：

```text
https://api.github.com              200
https://raw.githubusercontent.com  301/200
https://codeload.github.com         301/200
git pull                            timeout
```

说明 GitHub 不同域名和协议路径的可用性不同。

短期获取单个开源脚本：

```bash
curl -fsSL \
  -H "Accept: application/vnd.github.raw+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/<OWNER>/<REPO>/contents/<PATH>?ref=<COMMIT>" \
  -o /tmp/file
```

提交必须已推送到 GitHub，否则指定 commit 会返回 404。

## 5. GitHub Contents API 返回 404

错误：

```text
curl: (22) The requested URL returned error: 404
```

实际原因：本地 commit `5c6d60f` 当时尚未推送，GitHub 上只有前一个 commit。

修复：

```bash
git status
git log -2 --oneline
git push origin main
```

推送后再用 commit ref 获取文件。

## 6. bootstrap 脚本 `curl: (23) Failed writing body`

错误：

```text
curl: (23) Failed writing body (1100 != 1370)
```

常见根因：

- curl 输出直接管道到提前退出的命令；
- 目标目录或文件写入方式有问题；
- 下载 Git 仓库归档时没有先落盘。

最终脚本改为：

1. `mktemp` 创建归档文件；
2. `curl -o` 完整写入；
3. `tar -xzf` 解压；
4. `trap` 清理临时文件。

并使用：

```text
https://codeload.github.com/langgenius/dify/tar.gz/refs/tags/<TAG>
```

## 7. Shell 脚本语法检查没有输出

命令：

```bash
bash -n /tmp/bootstrap-dify.sh
```

没有输出表示语法检查通过，不是失败。

同理，许多 Linux 命令成功时不会输出。应检查 `$?` 或执行下一条显式验证命令。

## 8. Docker Hub 连接拒绝或超时

错误：

```text
Get "https://registry-1.docker.io/v2/": connect: connection refused
Get "https://registry-1.docker.io/v2/": i/o timeout
context canceled
```

`context canceled` 通常是某个关键镜像失败后 Compose 取消了并行任务，不代表所有镜像都坏了。

处理：

1. 配置可信 registry mirror；
2. 验证 `daemon.json`；
3. 重启 Docker；
4. 重复 `docker compose pull`，成功层会复用；
5. 仍失败时按 Compose digest 从可信代理拉取并打官方标签；
6. 使用 `docker compose up -d --pull never`。

## 9. DaoCloud `/v2/` 返回 401

响应：

```text
HTTP/2 401
www-authenticate: Bearer realm="https://m.daocloud.io/auth/token"
```

这是 Registry V2 标准认证挑战，说明服务端可达。Docker 客户端会自动获取 Bearer Token。

## 10. 镜像已经拉取但 Compose 仍找不到

原因：通过代理按 digest 拉取后，本地只有代理仓库名，没有 Compose 期望的官方标签。

处理：

```bash
sudo docker tag \
  m.daocloud.io/docker.io/langgenius/dify-sandbox@sha256:<DIGEST> \
  langgenius/dify-sandbox:<TAG>
```

用下面命令确认：

```bash
sudo docker images langgenius/dify-sandbox:<TAG>
```

API、Web、Plugin Daemon 同理。

## 11. Dify API 长时间显示 `health: starting`

启动后几十秒内：

```text
docker-api-1 Up ... (health: starting)
```

通常是数据库迁移和依赖初始化。先等待，再检查：

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 api worker
curl -I http://127.0.0.1
```

若 Web 返回 `/install`，Dify 已基本可用。

## 12. Cloudflare Zero Trust 免费版要求支付方式

实际界面要求即使免费计划也录入支付方式，且国内银行卡不一定可用。

处理：

- 不绕过支付验证；
- 暂时不用 Access；
- 使用 Worker 内置 Basic Auth 保护 `/ai` 与 `/api/ai/*`；
- Dify 管理端通过随机 URL/管理员密码和 Tunnel 保护；
- 以后具备支付方式再迁移到 Access。

Basic Auth 是过渡方案，不等同于多用户身份系统。

## 13. Full (strict) 后访问失败

历史路径：

- 为 Dify Nginx 安装 Cloudflare Origin Certificate；
- 设置 `NGINX_HTTPS_ENABLED=true`；
- 设置六个外部 URL；
- Cloudflare 切换 Full (strict)；
- 检查证书 SAN 和私钥匹配。

即使证书正确，Cloudflare 仍需通过公网 443 到达源站。安全组、网络路径或证书链任一问题都可能导致 525。

最终修复是 Cloudflare Tunnel：

```text
ai.simulearn.cn -> Tunnel -> http://localhost:80
```

不再依赖公网 443。

## 14. `cloudflared` 前台退出显示多条 ERR

按 `Ctrl+C` 后：

```text
Initiating graceful shutdown
context canceled
no more connections active and exiting
```

这是主动退出产生的正常日志。随后安装 systemd：

```bash
sudo cloudflared --config <CONFIG> service install
sudo systemctl status cloudflared
```

## 15. 云安全组关闭 80/443 后网站是否还能用

能。Cloudflare Tunnel 是服务器主动向 Cloudflare 建立出站连接。

确认：

```text
cloudflared.service active (running)
```

保留 SSH 22 的可信来源规则。Dify Docker 可以继续本机监听 80/443。

## 16. 通义 Provider 保存时报 `qwen-flash 403`

错误：

```text
Failed to invoke model qwen-flash
403
Access denied by API-Key restrictions
```

原因：百炼 Key 只授权了 Embedding/Rerank，而 Dify Provider 使用 `qwen-flash` 验证凭据。

修复：将 `qwen-flash` 加入模型范围，再保存 Provider。

## 17. API Key IP 白名单格式

单个 IPv4 必须使用 CIDR：

```text
<SERVER_IP>/32
```

不要留空；不要填写 `0.0.0.0/0`，除非明确接受全网调用风险。

## 18. 知识库创建后 `indexing_technique` 为 null

早期脚本只创建知识库，没有指定高质量索引：

```json
{
  "indexing_technique": null,
  "embedding_model": null
}
```

修复：创建 payload 增加：

```json
{
  "indexing_technique": "high_quality",
  "embedding_model": "text-embedding-v4",
  "embedding_model_provider": "<DIFY_PROVIDER_ID>"
}
```

已有知识库可通过 Dify API PATCH 更新。

## 19. 分段最大长度和重叠长度是灰色

在 Dify 自动分段模式下，部分参数由系统管理，界面可能不可编辑。测试文档最终使用最大分段长度 1024 并成功索引。

不要为了匹配教程数字强行修改数据库。先完成可检索验证，再根据真实长文档测试调整知识库设置。

## 20. Chatflow LLM 看不到知识检索 `result`

现象：把检索结果拖到“上下文”后仍提示必须在提示词中引用。

最终配置：

1. LLM 上下文绑定“知识检索 → result”；
2. SYSTEM 提示词正文插入紫色“上下文”变量；
3. USER 消息插入 `sys.query`；
4. Direct Reply 使用 LLM `text`。

只连接节点不等于模型一定使用上下文，提示词必须明确引用。

## 21. 回答暴露 `<think>`

现象：DeepSeek 返回：

```text
<think>
内部推理内容
</think>
最终答案
```

这不应显示给站点用户。Worker API 在返回前移除完整或未闭合的 `<think>` 块：

```ts
answer
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/<think>[\s\S]*$/gi, '')
  .trim();
```

提交：`acb050e`。

## 22. Cloudflare 构建成功但部署失败：缺少 Worker 入口

错误：

```text
It seems that you have run `wrangler deploy` on a Pages project
Missing entry-point to Worker script or to assets directory
```

当时仓库的 `wrangler.jsonc` 是 Pages 格式：

```json
{
  "pages_build_output_dir": "./dist"
}
```

但 Cloudflare 控制台项目实际上是 Worker。错误地把部署命令改成 `wrangler pages deploy` 只会进入下一个错误。

最终修复：

```json
{
  "main": "./worker/index.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/ai", "/ai/*", "/api/ai/*"]
  }
}
```

部署命令保持：

```text
npx wrangler deploy
```

## 23. `wrangler pages deploy` 返回 Authentication 10000

错误：

```text
A request to the Cloudflare API
/accounts/<ACCOUNT>/pages/projects/simulearn-site
Authentication error [code: 10000]
```

最初怀疑 Token 缺少 `Cloudflare Pages Edit`，于是创建了新 Token。但验证结果：

```text
GET /pages/projects/simulearn-site -> HTTP 404
GET /pages/projects -> result: []
```

结论：不是权限不足，而是账户中根本没有 Pages 项目；`simulearn-site` 是 Worker 项目。

不要只看 Cloudflare 菜单名“Workers 和 Pages”，要看项目运行时、部署历史和 API 项目类型。

## 24. 主域名没有 DNS

现象：

```text
Could not resolve host: simulearn.cn
```

Worker 部署成功后仍需：

```text
Worker -> Domains -> Add domain -> simulearn.cn
```

添加后 DNS 自动生成，首页返回 200。

## 25. 首页 200，但 `/ai` 返回 503

响应：

```text
AI 管理员凭据尚未配置。
```

根因：密钥加到了 Build Variables，而不是 Worker Runtime Variables。

必须在：

```text
Worker Settings -> Variables and Secrets
```

添加运行时 Secret。Build 面板中的同名变量不会自动变成 Worker binding。

成功后未登录应返回：

```text
401 Unauthorized
WWW-Authenticate: Basic realm="SimuLearn AI"
```

## 26. `DIFY_DATASETS_JSON 配置不是有效 JSON`

原因：只复制了 7 个 ID、漏掉外层 `{}`、混入终端提示符，或把一个对象拆成多个值。

服务器验证：

```bash
jq -r 'type, (keys | join(","))' /home/<USER>/datasets.json
```

复制单行：

```bash
jq -c . /home/<USER>/datasets.json
```

从第一个 `{` 复制到最后一个 `}`，作为一个 Secret 值保存。

## 27. 待审核区存在，但发布下拉框只有 6 个

根因：前端 `datasetOptions` 只定义了五个公开库和 private，遗漏 review。

修复：

```ts
{ slug: 'review', code: 'RV', label: '待审核整理区' }
```

提交：`e9cb8dd`。

## 28. 成功命令为什么“没有输出”

部署过程多次遇到：

- `bash -n`；
- `sed`；
- `chmod`；
- 写入配置；
- `openssl` 某些校验；
- `unset`。

Unix 工具通常以退出码表示成功。不要把“无输出”直接判断为失败，应执行后续验证，例如：

```bash
echo $?
grep -n '<EXPECTED>' <FILE>
sudo docker compose ps
```

## 29. `npm audit` 漏洞是否导致部署失败

构建日志显示：

```text
8 vulnerabilities (6 moderate, 2 high)
```

它是审计警告，不是这次部署失败的原因。真正错误在后面的 Wrangler `ERROR`。

不要在生产修复中直接执行：

```bash
npm audit fix --force
```

该命令可能升级破坏性依赖。应单独开分支评估。

## 30. 最短诊断顺序

1. `git status -sb`
2. `npm run build`
3. `npx wrangler deploy --dry-run`
4. 查看 Cloudflare 构建日志最后一个 `ERROR`
5. `curl -I https://simulearn.cn/`
6. 未登录检查 `/ai` 是 401 还是 503
7. 登录后检查 `/api/ai/health`
8. Dify 检查 Provider、App Key 和 Dataset Key
9. 服务器检查 `docker compose ps`
10. 检查 `cloudflared.service`

