# SimuLearn AI 知识库部署速查

完整教程见 [REPRODUCTION-GUIDE.md](REPRODUCTION-GUIDE.md)，实际问题见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 架构

```text
simulearn.cn/ai
Cloudflare Worker
    │ Dify App / Dataset API Key
    ▼
ai.simulearn.cn
Cloudflare Tunnel
    ▼
Dify Docker
    ├─ DeepSeek
    ├─ text-embedding-v4
    ├─ qwen3-rerank
    └─ 七个知识库
```

## 服务器

推荐最低规格：

```text
2 vCPU
8 GiB
25 GiB 可用磁盘
Docker 26+
Docker Compose v2
```

安装：

```bash
sudo bash infra/dify/bootstrap-dify.sh
```

检查：

```bash
cd /opt/dify/docker
sudo docker compose ps
sudo systemctl status cloudflared
curl -I http://127.0.0.1
```

## Dify

默认模型：

```text
LLM: deepseek-v4-flash
Embedding: text-embedding-v4
Rerank: qwen3-rerank
```

七库：

```text
SimuLearn｜结构
SimuLearn｜热
SimuLearn｜流体
SimuLearn｜多物理场
SimuLearn｜芯片仿真
SimuLearn｜私有原始资料
SimuLearn｜待审核整理区
```

创建脚本：

```bash
bash infra/dify/create-datasets.sh
```

`DIFY_DATASETS_JSON`：

```bash
jq -c . /home/<USER>/datasets.json
```

必须复制完整 `{...}`。

## Apps

Workflow：

```text
SimuLearn Document Organizer
```

提示词：

```text
infra/dify/review-workflow-prompt.md
```

Chatflow：

```text
SimuLearn Knowledge Assistant
```

提示词：

```text
infra/dify/chat-system-prompt.md
```

Chatflow 只连接五个公开库。

## Worker Runtime Secrets

```text
DIFY_CHAT_APP_API_KEY
DIFY_REVIEW_APP_API_KEY
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
SIMULEARN_AI_USERNAME
SIMULEARN_AI_PASSWORD
```

可选 Access Service Auth：

```text
DIFY_ACCESS_CLIENT_ID
DIFY_ACCESS_CLIENT_SECRET
```

## 验收

- `/` 未登录 200；
- `/ai` 未登录 401；
- 管理员登录后显示实时连接；
- 问答返回来源且不显示 `<think>`；
- 资料整理返回结构化草案；
- 未确认敏感信息与版权时不能发布；
- 待审核区发布后可检索；
- 状态页显示 7 个知识区；
- private/review 不参与公开问答。
