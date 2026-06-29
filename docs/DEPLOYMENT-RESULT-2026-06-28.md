# 2026-06-28 部署结果快照

本文记录第一次完整上线的可验证状态。所有个人账号、IP、UUID、Key 和密码均已移除。

## 1. 环境

服务器：

```text
Alibaba Cloud Linux 3.2104 U10 (OpenAnolis)
2 vCPU
8 GiB 规格，系统可见约 7.3 GiB
Docker 26.1.3
Docker Compose 2.27.0
Git 2.43.5
cloudflared 2026.6.1
```

Dify：

```text
Dify 1.15.0
API/Web 1.15.0
Plugin Daemon 0.6.3-local
Sandbox 0.2.15
Weaviate 1.27.0
PostgreSQL 15 Alpine
Redis 6 Alpine
```

## 2. 运行容器

```text
api
api_websocket
db_postgres
nginx
plugin_daemon
redis
sandbox
ssrf_proxy
weaviate
web
worker
worker_beat
```

`init_permissions` 是一次性初始化容器，正常退出。

## 3. 网络

- `ai.simulearn.cn` 通过名为 `simulearn-dify` 的 Tunnel。
- Tunnel systemd 为 `active (running)`。
- QUIC 与 HTTP/2 Connectivity Pre-check 全部通过。
- 阿里云公网 80、443 安全组规则关闭。
- SSH 22 保留。
- `simulearn.cn` 绑定 Cloudflare Worker Custom Domain。
- `workers.dev` 在当时本地网络不可直连，因此主域名是必需入口。

## 4. 模型

```text
LLM: deepseek-v4-flash
Embedding: text-embedding-v4
Rerank: qwen3-rerank
STT: paraformer-realtime-v1（可选）
TTS: qwen3-tts-flash（可选）
```

DeepSeek 与通义 Provider 均显示已连接。

## 5. Dify Apps

### Document Organizer

- 文件列表与文件名输入；
- 文档提取；
- DeepSeek；
- Structured Output 五字段；
- 测试成功；
- 已发布；
- Workflow API Key 已配置到 Worker Secret。

### Knowledge Assistant

- 用户输入；
- 六个公开知识库检索；
- `qwen3-rerank`；
- Top K 6；
- DeepSeek；
- 直接回复；
- 测试成功并引用来源；
- 已发布；
- Chatflow API Key 已配置到 Worker Secret。

## 6. 知识库

最终状态：

```text
知识区：7
文档：2
可检索：2
总字数：556
```

分布：

```text
结构：1 文档 / 1 可检索 / 274 字
待审核整理区：1 文档 / 1 可检索 / 282 字
其他知识区：0
```

两份记录来自同一个安全、自编的简支梁教学测试资料，分别用于公开结构检索和私有审核发布链路验证。

## 7. 网站验证

未登录：

```text
https://simulearn.cn/                  200
https://simulearn.cn/ai                401
https://simulearn.cn/api/ai/health     401
```

登录后：

- 实时知识库显示已连接；
- 结构问题能返回 Dify 知识库答案；
- 回答引用 `sample-review-document.txt`；
- `<think>` 内部推理已从 API 输出移除；
- 文档整理返回摘要、分类、标签、敏感信息和版权风险；
- 两个人工确认未勾选时无法发布；
- 发布到 `RV · 待审核整理区` 后由 `parsing` 变为可检索；
- 状态页显示 8 个知识区。

测试问题：

```text
简支梁案例说明了求解器收敛与结果准确之间有什么区别？
```

回答正确区分：

- 数值收敛；
- 物理和模型准确性；
- 网格无关性；
- 理论解对比；
- 边界、材料和模型假设；
- 人工复核。

## 8. Cloudflare Worker

最终构建：

```text
Astro static pages: 25
Static assets: 68
Worker entry: worker/index.ts
Asset binding: ASSETS
Worker-first routes:
  /ai
  /ai/*
  /api/ai/*
```

构建设置：

```text
npm run build
npx wrangler deploy
npx wrangler versions upload
```

## 9. Git

关键上线提交：

```text
789ddce V5: 接入真实Dify知识库并增加管理员鉴权
767d3c5 fix: 适配Cloudflare Worker全栈部署
acb050e fix: 隐藏模型推理过程并修正文案
e9cb8dd fix: 补充待审核知识区选项并修正部署文案
```

快照生成时：

```text
main 与 origin/main 同步
工作区干净
```

## 10. 历史镜像 digest

这是 Dify 1.15.0 在 Docker Hub 不稳定时使用的历史记录，只用于审计，不建议直接复用：

```text
dify-api:
sha256:c1712c50f27c9dfd31c5be77a9a03f30c464fc6983287eefd4a6a98376c70c24

dify-web:
sha256:4f526395772321f0130eeb335339317dfefeb9207b4187306f2d12e2fc6ec106

dify-plugin-daemon:
sha256:3c694329357bc580b28bdec59321a981acd3279f8f69d1a3fb59a47cf7f770c3

dify-sandbox:
sha256:750e1111426ef31a9217b81c98cccfb750f17b182af3221102e420afa9f0928e
```

未来部署必须读取目标版本 Compose 中的实际镜像和 digest。

