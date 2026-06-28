# PDF 整书入库与重构学习：部署与复现指南

更新日期：2026-06-28

## 1. 功能和保真边界

管理员从 `/ai/books` 上传不超过 50 MB、200 页的工程/仿真 PDF。系统异步完成 MinerU 解析、R2 图片发布、整书阅读页面、独立导读与章节摘要，以及 Dify 按章入库。公开入口为 `/books`，单书 URL 为 `/books/{slug}/`。

本功能保证 MinerU 原始 Markdown 的文字、标题顺序、公式和编号不由 LLM 改写。原始文件保存在：

```text
books/{slug}/versions/{job_id}/source.md
```

页面显示的是响应式 HTML，不是 PDF 的像素级复制。若必须像素级复刻，应额外嵌入原 PDF 阅读器；这与“重构成响应式 HTML”是不同目标。

“Grimoire”在本项目中是可替换的摘要适配层，不是正文处理器。默认适配 OpenAI-compatible API（可用 DeepSeek）；导读和摘要始终放在独立区域。

## 2. 架构

```text
管理员浏览器
  → Basic Auth 保护的 Worker API
  → R2：source.pdf + job.json（持久任务）
  → Python 常驻服务
  → Redis DB 15：simulearn:books:*（锁和短期状态）
  → MinerU API / CLI
  → R2：Markdown、图片、目录、阅读 JSON
  → Dify Dataset API：按章入库
  → Chatflow 检索引用
```

没有把自定义消息写进 Dify Redis/Celery 队列。Dify 内部任务的序列化和路由会随版本变化，直接混用会产生升级风险。R2 是耐久队列，Redis 仅负责防止两个后台实例重复消费同一任务。

任务状态：

```text
uploading → uploaded → metadata → awaiting_confirmation
→ queued → processing → summarizing → indexing → publishing
→ done / failed
```

## 3. 8 GiB 服务器约束

MinerU 官方当前硬件表给出的最低内存为 16 GB。现有 8 GiB 主机加 4 GiB Swap 仍低于最低值，因此：

- 8 GiB 主机必须采用 `MINERU_MODE=api`，调用独立 MinerU API；
- 主机升级到至少 16 GiB 后，才能考虑 `MINERU_MODE=cli`；
- Swap 是故障缓冲，不是物理内存替代品；
- 后台会在调用 MinerU 前用 `pypdf` 强制检查真实 PDF 签名、50 MB 和 200 页。

MinerU 3.x 服务命令：

```bash
mineru-api --host 0.0.0.0 --port 8000
```

官方服务提供 `/health`、`/tasks`、`/file_parse` 和结果接口。本项目调用同步 `/file_parse`，外层任务异步由 R2 调度。

## 4. Cloudflare R2 配置

### 4.1 创建桶

Cloudflare → R2 → 创建：

```text
simulearn-books
simulearn-books-preview
```

不要开启公开访问。源 PDF 没有公开读取路由，图片由 Worker 代理。

### 4.2 添加 Worker binding

两个桶创建成功后，在 `wrangler.jsonc` 顶层添加：

```jsonc
"r2_buckets": [
  {
    "binding": "BOOKS",
    "bucket_name": "simulearn-books",
    "preview_bucket_name": "simulearn-books-preview"
  }
]
```

代码故意没有预先提交这个绑定，避免桶尚不存在时使现网构建失败。未配置时，原有网站和问答照常工作，书籍 API 返回明确的 503。

普通变量已经写入 `wrangler.jsonc`：

```text
BOOK_MAX_MB=50
BOOK_MAX_PAGES=200
```

### 4.3 创建服务器 S3 凭证

R2 → 管理 R2 API 令牌 → 创建仅对 `simulearn-books` 读写的令牌，记录：

```text
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

它们只写入服务器 `.env.books`，不得进入 Git、Worker 普通变量或浏览器。

## 5. 阿里云部署

### 5.1 启用 Swap

```bash
cd ~/simulearn-site/infra/books
sudo bash enable-swap.sh
free -h
swapon --show
```

脚本创建 4 GiB `/swapfile`，写入 `/etc/fstab`，设置 `vm.swappiness=10`。

### 5.2 配置环境

```bash
cd ~/simulearn-site/infra/books
cp .env.books.example .env.books
chmod 600 .env.books
vi .env.books
```

必填：

```text
R2_ENDPOINT
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
MINERU_API_URL
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
```

五个公开知识库映射必须带最外层 `{}`：

```json
{"structural":"ID","thermal":"ID","fluids":"ID","multiphysics":"ID","chip":"ID"}
```

可选摘要配置：

```text
SUMMARY_API_URL=https://api.deepseek.com/v1
SUMMARY_API_KEY=<DeepSeek Key>
SUMMARY_MODEL=deepseek-chat
```

留空时 MinerU 正文和 Dify 入库仍正常执行，只跳过导读/摘要。

### 5.3 启动后台

```bash
cd ~/simulearn-site/infra/books
sudo docker compose -f compose.books.yml build
sudo docker compose -f compose.books.yml up -d
sudo docker logs -f simulearn-book-worker
```

服务加入现有 `docker_default` 网络，通过 `redis:6379/15` 连接 Redis。不要把 6379 暴露到公网。容器限内存 768 MB，适用于远程 MinerU 模式。

独立 MinerU 主机建议：

```bash
export MINERU_MODEL_SOURCE=modelscope
export MINERU_API_MAX_CONCURRENT_REQUESTS=1
export MINERU_PROCESSING_WINDOW_SIZE=16
mineru-api --host 0.0.0.0 --port 8000
```

若以后升级内存并使用本机 CLI：

```text
MINERU_MODE=cli
MINERU_CLI=mineru
```

当前轻量 Dockerfile 不安装 MinerU；CLI 模式要另建包含 MinerU 的专用镜像，不能只改变量。

## 6. 管理员操作

1. 登录 `https://simulearn.cn/ai/books`。
2. 选择 PDF，Worker 立即创建任务 ID 并流式写入 R2。
3. 后台提取 PDF 元数据和真实页数。
4. 确认书名、作者、出版社、年份、简介、固定 slug 和目标公开知识库。
5. 页面轮询状态；失败时显示原因。
6. 完成后从任务行进入 `/books/{slug}/`。

同一 slug 更新必须勾选“覆盖”。新 R2 版本和新 Dify 文档创建成功后才切换在线 `book.json`，再清理旧版本，URL 不变。

## 7. 数据布局

```text
book-jobs/{job_id}/
  source.pdf
  job.json

books/
  catalog.json
  {slug}/
    book.json
    meta.json
    toc.json
    chapters.json
    versions/{job_id}/source.md
    assets/{job_id}/...
```

`book.json` 供阅读器一次加载；分拆文件保留给排障和未来分页加载。任务 `job.json` 保留最近 100 条阶段日志。

## 8. Dify 按章入库与引用

每个 Markdown 标题区段成为一个 Dify 文档，名称为：

```text
《书名》章节标题 [ChapterID]
```

检索文本前加：

```text
[BookID:book-slug]
[ChapterID:chapter-id]
[Citation:《书名》章节标题]
```

这些行只用于检索，不进入人类正文。后台还会创建并写入真正的 Dify 自定义
metadata 字段 `book_id`、`chapter_id`、`citation`。Dify 使用 `high_quality`
和知识库自动分段；人类阅读正文仍以 R2 中不经 Dify 处理的 MinerU 输出为准。

在 Chatflow 系统提示词追加：

```text
当知识库结果包含 Citation、BookID、ChapterID 时，回答末尾按
“来源：《书名》章节标题”列出。不得把模型常识伪装成书籍原文。
```

## 9. 验收

使用确认允许公开处理的复杂公式、多级标题和图片样章，不要提交版权来源不明的整本教材。

功能清单：

- 上传后立即返回任务 ID；
- 超过 50 MB / 200 页明确失败；
- 元数据可预填和修改；
- `source.md` 与 MinerU 输出逐字节一致；
- 目录顺序、标题、公式编号和图片正常；
- 导读/摘要与正文视觉隔离；
- 目录点击平滑定位；
- `/books` 能搜索书名、作者、章节；
- Dify 结果包含 BookID、ChapterID、Citation；
- 覆盖后 URL 不变，故意中断新版时旧版仍可读；
- Chatflow 能回答并引用具体书名章节。

资源检查：

```bash
free -h
sudo docker stats --no-stream
sudo docker logs --tail 200 simulearn-book-worker
```

8 GiB 主机不得运行本地 MinerU。Swap 不应持续打满，Dify 容器保持健康。

API 检查：

```bash
curl -u '管理员:密码' https://simulearn.cn/api/ai/books/jobs
curl https://simulearn.cn/api/books
```

配置完成后分别应返回 `{"ok":true,"jobs":[]}` 和书籍列表。

## 10. 故障排查

`书籍存储尚未配置`：缺少名为 `BOOKS` 的 R2 binding，普通变量不能代替 binding。

任务停在 `uploaded`：

```bash
sudo docker ps --filter name=simulearn-book-worker
sudo docker logs --tail 200 simulearn-book-worker
```

Redis 锁错误：

```bash
sudo docker inspect simulearn-book-worker --format '{{json .NetworkSettings.Networks}}'
```

MinerU 空结果：检查 `${MINERU_API_URL}/health`，并在 MinerU 主机直接测试同一 PDF 的 `/file_parse`。

Dify 403：确认使用知识库“服务 API Key”，不是 Chatflow Key 或 Workflow Key；核对五个数据集 UUID。

## 11. 需要管理员完成的外部操作

代码不会自动执行这些有权限或版权影响的操作：

- 创建 R2 桶和 S3 凭证；
- 添加生产 `BOOKS` binding；
- 部署独立 MinerU API；
- 将真实密钥写入服务器 `.env.books`；
- 上传可能受版权保护的测试书籍。
