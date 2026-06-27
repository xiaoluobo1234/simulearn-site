# SimuLearn AI 知识库部署指南

本指南面向第一次部署 Dify 的用户。目标是保留 `simulearn.cn` 作为公开网站，同时新增：

- `simulearn.cn/ai`：只有指定邮箱可以访问的知识库工作台；
- `ai.simulearn.cn`：部署在阿里云服务器上的 Dify 管理端与 API；
- DeepSeek：回答与资料整理；
- 通义千问：Embedding 与 Rerank；
- 七个知识区：五个公开领域库、私有原始资料库、待审核整理区。

任何 API Key、Cloudflare Tunnel Token、Access Service Token 都不能写入 Git。

## 1. 最终架构

```text
浏览器
  │ Cloudflare Access 邮箱验证码
  ▼
simulearn.cn/ai
  │ 同源 /api/ai/*，浏览器看不到密钥
  ▼
Cloudflare Pages Functions
  │ Dify App / Dataset API Key
  ▼
ai.simulearn.cn
  │ Cloudflare Tunnel
  ▼
阿里云 2 核 8 GiB / Dify Docker Compose
  ├─ DeepSeek API：问答、摘要、分类、标签
  ├─ 通义千问 Embedding / Rerank
  ├─ 五个公开领域知识库
  ├─ 私有原始资料库
  └─ 待审核整理区
```

DeepSeek 模型不会安装到 8 GiB 服务器。服务器运行 Dify、数据库、Redis 和向量库，模型通过 API 调用。

## 2. 上线前准备

1. 在阿里云控制台为服务器创建快照。
2. 将内存升级到 8 GiB。
3. 确认系统磁盘至少保留 25 GiB 可用空间。
4. 准备 DeepSeek API Key。
5. 准备阿里云百炼/通义千问 API Key。
6. 确认 `simulearn.cn` 已由 Cloudflare 管理 DNS。
7. 不要把截图中的公网 IP、账号、密码或密钥提交到仓库。

## 3. 安装 Dify

通过 SSH 登录阿里云服务器后，进入本仓库并运行：

```bash
sudo bash infra/dify/bootstrap-dify.sh
```

脚本会：

1. 检查内存、Docker、Docker Compose、Git、curl 和 openssl；
2. 从 Dify 官方仓库克隆最新稳定版本；
3. 创建 `.env`；
4. 生成随机 `SECRET_KEY`；
5. 设置单文件 15 MB、每批 5 个文件；
6. 拉取并启动官方 Docker Compose 服务。

检查状态：

```bash
cd /opt/dify/docker
sudo docker compose ps
sudo docker compose logs --tail=100 api worker web
```

不要直接把数据库、Redis、向量库端口开放到公网。

## 4. 建立 Cloudflare Tunnel

推荐使用 Cloudflare Tunnel，不直接暴露阿里云公网 IP。

1. 进入 Cloudflare Zero Trust。
2. 打开 Networks → Tunnels，创建名为 `simulearn-dify` 的 Tunnel。
3. 按 Cloudflare 页面给出的命令，在阿里云服务器安装并启动 `cloudflared`。
4. 添加 Public Hostname：
   - Hostname：`ai.simulearn.cn`
   - Service：`http://localhost:80`
5. 确认浏览器能打开 `https://ai.simulearn.cn/install`。
6. 完成 Dify 管理员初始化后，立即配置 Cloudflare Access。

Tunnel Token 属于密钥，只能保存在服务器或 Cloudflare 控制台。

## 5. 配置 Cloudflare Access

### 5.1 保护 SimuLearn 工作台

建立 Self-hosted Application，保护：

```text
simulearn.cn/ai*
simulearn.cn/api/ai/*
```

策略：

- Action：Allow
- Include：你的具体邮箱地址
- Login method：One-time PIN

不要只设置“One-time PIN”而不限制邮箱，否则任何邮箱都可能登录。

### 5.2 保护 Dify

建立第二个 Self-hosted Application：

```text
ai.simulearn.cn/*
```

浏览器访问策略仍只允许你的邮箱。

Pages Functions 需要以服务身份调用 Dify：

1. 在 Access → Service Auth 创建 Service Token；
2. 给 Dify Application 增加 `Service Auth` 策略；
3. 保存 Client ID 和 Client Secret；
4. 后续分别写入 Cloudflare Pages 的加密变量：
   - `DIFY_ACCESS_CLIENT_ID`
   - `DIFY_ACCESS_CLIENT_SECRET`

## 6. 配置 Dify 模型

登录 `https://ai.simulearn.cn`：

1. 进入 Settings → Model Providers。
2. 安装并配置 DeepSeek Provider。
3. 安装并配置通义千问 Provider。
4. 选择 DeepSeek 对话模型用于 Chatflow 和资料整理 Workflow。
5. 在知识库设置中选择通义千问 Embedding。
6. 开启 Rerank，并选择通义千问 Rerank 模型。

模型名称和 Provider 标识以 Dify 设置页实际显示为准，不要根据教程手填猜测。

建议同时在 DeepSeek 和阿里云百炼控制台设置每月费用告警，合计预算控制在 200 元以内。

## 7. 创建七个知识库

可以在 Dify 界面手动创建，也可以运行脚本。

运行脚本前，在当前终端临时设置：

```bash
export DIFY_API_URL="https://ai.simulearn.cn"
export DIFY_DATASET_API_KEY="你的知识库服务API密钥"
export DIFY_EMBEDDING_MODEL="从Dify模型设置页复制"
export DIFY_EMBEDDING_PROVIDER="从Dify模型设置页复制"
export CF_ACCESS_CLIENT_ID="可选：Access服务令牌ID"
export CF_ACCESS_CLIENT_SECRET="可选：Access服务令牌Secret"
```

运行：

```bash
bash infra/dify/create-datasets.sh
```

脚本会创建：

- SimuLearn｜结构
- SimuLearn｜热
- SimuLearn｜流体
- SimuLearn｜多物理场
- SimuLearn｜芯片仿真
- SimuLearn｜私有原始资料
- SimuLearn｜待审核整理区

输出的 `datasets.json` 用于配置网站。

## 8. 创建资料整理 Workflow

在 Dify Studio 创建 Workflow，名称为 `SimuLearn Document Organizer`。

节点顺序：

```text
Start
  └─ documents：File List，必填
  └─ filename：Text，必填
      ↓
Document Extractor
      ↓
LLM / DeepSeek
      ↓
Structured Output
      ↓
End
```

输入变量名必须是：

```text
documents
filename
```

输出字段必须是：

```text
summary
category
tags
sensitivity
copyright_risk
```

完整提示词见 `infra/dify/review-workflow-prompt.md`。

发布 Workflow，进入 API Access，生成 App API Key。

## 9. 创建知识问答 Chatflow

在 Dify Studio 创建 Chatflow，名称为 `SimuLearn Knowledge Assistant`。

推荐节点：

```text
User Input
  └─ scope：Select 或 Text
      ↓
Question Classifier（可选）
      ↓
Knowledge Retrieval
  └─ 连接五个公开领域知识库
      ↓
LLM / DeepSeek
      ↓
Answer
```

系统提示词见 `infra/dify/chat-system-prompt.md`。

不要把“私有原始资料”和“待审核整理区”连接到公开问答 Chatflow。

发布 Chatflow，进入 API Access，生成 App API Key。

## 10. 配置 Cloudflare Pages

进入 Cloudflare → Workers & Pages → SimuLearn 项目 → Settings → Variables and Secrets。

加密保存：

```text
DIFY_CHAT_APP_API_KEY
DIFY_REVIEW_APP_API_KEY
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
DIFY_ACCESS_CLIENT_ID
DIFY_ACCESS_CLIENT_SECRET
```

普通变量：

```text
DIFY_API_URL=https://ai.simulearn.cn
DIFY_REVIEW_FILE_INPUT=documents
DIFY_CHAT_SCOPE_INPUT=scope
MAX_UPLOAD_MB=15
```

将 `wrangler.jsonc` 中：

```json
"SIMULEARN_AI_MODE": "mock"
```

改为：

```json
"SIMULEARN_AI_MODE": "live"
```

然后提交并推送。只有全部密钥和知识库 ID 配置完成后才能切换 `live`。

本地演示：

```bash
cp .dev.vars.example .dev.vars
npm run dev:ai
```

真实密钥只写在 `.dev.vars`，该文件已被 Git 忽略。

## 11. 验收清单

- [ ] 未登录访问 `/ai` 会进入 Cloudflare Access 登录页
- [ ] 非白名单邮箱无法收到有效登录权限
- [ ] 浏览器开发者工具中看不到任何 Dify API Key
- [ ] 知识问答返回文档名、知识库名与相似度
- [ ] PDF、DOCX、MD、TXT、CSV 均能进入整理 Workflow
- [ ] 未勾选敏感信息和版权确认时不能发布
- [ ] 发布后可以看到索引状态
- [ ] 私有原始资料未连接公开问答 Chatflow
- [ ] DeepSeek 和阿里云百炼设置费用告警
- [ ] 阿里云已建立磁盘快照和定期备份

## 12. 数据规则

| 资料类型 | 默认位置 | 公开条件 |
|---|---|---|
| 网站原创文章 | 对应公开领域库 | 作者确认 |
| 脱敏案例 | 对应公开领域库 | 完成项目与参数脱敏 |
| 个人笔记 | 对应公开领域库 | 无第三方隐私与保密内容 |
| 第三方论文 | 私有库 | 公开时只发布引用、摘要和个人笔记 |
| 原始工程数据 | 私有库 | 完成授权、脱敏与人工审核 |

当证据不足时，AI 必须回答“不确定”，不能用模型常识冒充知识库证据。
