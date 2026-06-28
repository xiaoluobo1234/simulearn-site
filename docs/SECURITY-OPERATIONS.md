# SimuLearn 安全、备份与运维

本文用于开源部署后的长期运行。部署成功不代表可以忽略密钥轮换、数据授权、备份、预算和升级风险。

## 1. 资产分层

| 资产 | 位置 | 是否可公开 |
|---|---|---|
| 网站源代码 | GitHub | 是 |
| 系统提示词 | `infra/dify/*.md` | 是 |
| 部署脚本 | `infra/dify/*.sh` | 是 |
| 示例教学资料 | `infra/dify/sample-review-document.txt` | 是 |
| Dify App API Key | Cloudflare Worker Secret | 否 |
| Dataset API Key | Cloudflare Worker Secret | 否 |
| `datasets.json` | 服务器与 Worker Secret | 否 |
| Basic Auth 密码 | Worker Secret/密码管理器 | 否 |
| DeepSeek/百炼 Key | Dify 数据库 | 否 |
| Tunnel credentials | 服务器 | 否 |
| Origin 私钥 | 服务器 | 否 |
| 原始工程资料 | Dify 私有知识库 | 默认否 |

## 2. 开源前检查

```bash
git status --short
git grep -n -I -E \
  '(app-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9._-]{16,}|BEGIN .*PRIVATE KEY|CF-Access-Client-Secret)'
```

还要人工检查：

- 截图；
- 粘贴日志；
- `.dev.vars`；
- `.env`；
- `datasets.json`；
- SSH 配置；
- Cloudflare Tunnel JSON；
- 证书私钥；
- 客户名、项目名、地址、邮箱和公网 IP。

`.gitignore` 至少覆盖：

```text
.env
.env.*
.dev.vars
.dev.vars.*
datasets.json
*.key
*.pem
```

保留 `.dev.vars.example`，其中只能使用占位符。

## 3. Worker Secret

运行时 Secret：

```text
DIFY_CHAT_APP_API_KEY
DIFY_REVIEW_APP_API_KEY
DIFY_DATASET_API_KEY
DIFY_DATASETS_JSON
SIMULEARN_AI_USERNAME
SIMULEARN_AI_PASSWORD
```

原则：

- 只放在 Worker Settings → Variables and Secrets；
- 不放 `wrangler.jsonc`；
- 不放 Build Variables，除非构建步骤确实需要；
- 不在浏览器 JavaScript 中注入；
- 不打印到日志；
- 不截图 Secret 输入框。

普通配置可进入 `wrangler.jsonc`：

```text
SIMULEARN_AI_MODE
DIFY_API_URL
DIFY_REVIEW_FILE_INPUT
MAX_UPLOAD_MB
```

Cloudflare Workers 的 Build Variables 和 Runtime Variables 是两套独立配置。

## 4. 密钥轮换

### 4.1 Dify App Key

1. 在 Dify App → API Access 创建新 Key；
2. 更新 Worker Runtime Secret；
3. 验证 `/api/ai/health` 和对应功能；
4. 删除旧 Key。

分别轮换 Chatflow 和 Workflow，避免同时失效。

### 4.2 Dataset Key

1. 创建新知识库服务 Key；
2. 更新 `DIFY_DATASET_API_KEY`；
3. 打开知识库状态页；
4. 完成读取和测试发布；
5. 删除旧 Key。

### 4.3 管理员密码

```bash
openssl rand -base64 24
```

更新 `SIMULEARN_AI_PASSWORD` 后，浏览器旧凭据可能继续缓存到窗口关闭。使用无痕窗口验证新密码。

### 4.4 DeepSeek 与百炼

1. 在供应商控制台创建新 Key；
2. 在 Dify Provider 中更新；
3. 分别测试对话、Embedding 和 Rerank；
4. 删除旧 Key；
5. 检查调用日志是否还有旧 Key。

## 5. 数据分类

| 数据类型 | 默认库 | 可公开条件 |
|---|---|---|
| 自编公开文章 | 对应领域库 | 作者确认 |
| 教学示例 | 对应领域库 | 无真实客户和工程数据 |
| 个人学习笔记 | 待审核区 | 人工确认来源和版权 |
| 脱敏工程案例 | 待审核区 | 完成授权与脱敏清单 |
| 原始工程文件 | 私有原始资料 | 默认不公开 |
| 第三方论文/教材 | 私有原始资料 | 公开时只发引用、短摘要和个人笔记 |
| 客户模型与结果 | 私有原始资料 | 书面授权前不得公开 |

## 6. 脱敏清单

发布前检查：

- 客户和项目名称；
- 人员姓名、邮箱、电话；
- 精确地址、经纬度、厂区和设备编号；
- 合同、报价、进度和故障责任；
- 几何尺寸和装配关系；
- 载荷谱、材料牌号和工艺参数；
- 原始结果、截图水印和文件元数据；
- 软件许可证和服务器地址；
- 第三方版权内容；
- 可能通过组合信息反推出项目身份的数据。

“替换项目名”不等于完成脱敏。参数组合、时间、地点和图纸特征仍可能识别项目。

## 7. 人工审核边界

资料整理 Workflow 只提供：

- 摘要草案；
- 分类建议；
- 标签建议；
- 敏感信息风险；
- 版权风险。

它不能代表：

- 已获得客户授权；
- 已完成法律审查；
- 已完成技术验证；
- 已完成几何和参数脱敏；
- 工程结论可以用于安全决策。

网站发布按钮要求两个显式确认：

1. 已检查并移除敏感信息；
2. 已确认公开权限和第三方引用方式。

## 8. 服务器备份

### 8.1 云快照

在以下时间创建快照：

- 首次安装前；
- Dify 大版本升级前；
- 数据库迁移前；
- 批量导入资料前；
- 网络和磁盘调整前。

快照不是唯一备份。它依赖同一云账户和同一供应商。

### 8.2 Dify 冷备份

先确认目录：

```bash
cd /opt/dify/docker
sudo docker compose ps
sudo du -sh volumes
```

选择维护窗口，停止服务但不删除卷：

```bash
sudo docker compose down
```

备份配置和数据目录到受保护位置：

```bash
sudo tar -C /opt/dify -czf /opt/backups/dify-$(date +%F-%H%M).tar.gz docker
```

重新启动：

```bash
cd /opt/dify/docker
sudo docker compose up -d --pull never
sudo docker compose ps
```

注意：

- 不要使用 `docker compose down -v`；
- 备份包包含密钥和用户数据，必须加密、限制权限并异地保存；
- 首次建立备份后要在独立环境做恢复演练。

### 8.3 最小配置备份

至少保存：

- `/opt/dify/docker/.env`
- `/opt/dify/docker/volumes/`
- `/etc/cloudflared/config.yml`
- Tunnel credentials JSON
- Cloudflare DNS 和 Worker 变量清单
- Dify Provider、App 和知识库配置截图（不得包含 Key）
- `/home/<USER>/datasets.json`

## 9. 升级 Dify

不要让 bootstrap 脚本覆盖已有 `/opt/dify`。它检测到目录存在时会停止。

升级前：

1. 阅读目标版本 Release Notes；
2. 创建云快照和冷备份；
3. 记录当前镜像标签；
4. 导出 `.env`；
5. 在测试环境验证插件和模型 Provider；
6. 再升级生产。

升级后检查：

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 api worker plugin_daemon
curl -I http://127.0.0.1
systemctl status cloudflared
```

再执行网站端三项测试：问答、资料整理、知识库状态。

## 10. 预算与告警

目标：DeepSeek 与阿里云百炼合计每月不超过 200 元。

建议分配：

| 项目 | 月告警建议 |
|---|---:|
| DeepSeek 对话与整理 | 80 元 |
| 百炼 Embedding/Rerank | 80 元 |
| 预留与测试 | 40 元 |

至少设置：

- 50% 预算提醒；
- 80% 预算提醒；
- 100% 预算提醒；
- 单日异常调用提醒；
- 余额不足提醒。

费用控制：

- Chatflow 使用 Blocking 模式但限制输入 4000 字；
- 上传单文件 15 MB、最多 5 个；
- Rerank Top K 为 6；
- 只给五个公开库做问答检索；
- 大批量资料分批导入；
- 不在测试时反复上传同一大文件；
- 观察 Dify usage 和供应商账单。

## 11. 日常巡检

每周：

```bash
cd /opt/dify/docker
sudo docker compose ps
sudo docker system df
sudo journalctl -u cloudflared --since "7 days ago" --no-pager | tail -100
```

检查：

- Dify 容器健康；
- 磁盘增长；
- Tunnel 重连；
- Dify Provider 错误；
- Worker 5xx；
- 供应商费用；
- 待审核资料积压。

每月：

- 验证备份文件可读；
- 抽查一次恢复流程；
- 轮换不再使用的 Key；
- 删除测试 App Key；
- 检查 Cloudflare API Token；
- 检查阿里云安全组；
- 检查知识库是否误接入 private/review。

## 12. 监控命令

服务器：

```bash
free -h
df -h
sudo docker compose ps
sudo docker compose logs --tail=100 api worker plugin_daemon nginx
sudo systemctl status cloudflared
```

公网：

```bash
curl -I https://simulearn.cn/
curl -I https://simulearn.cn/ai
curl -I https://ai.simulearn.cn/
```

未登录 `/ai` 返回 401 是正常；首页应返回 200。

## 13. 事件响应

怀疑 Key 泄漏：

1. 立即撤销供应商 Key；
2. 创建新 Key；
3. 更新 Dify/Worker；
4. 查看调用和费用日志；
5. 搜索 Git 历史、Issue、聊天和截图；
6. 如果进入 Git 历史，仅删除当前文件不够，需要清理历史并强制轮换；
7. 记录时间线和影响范围。

怀疑工程数据误公开：

1. 立即从公开库禁用或删除文档；
2. 清理网站缓存和公开页面；
3. 保存审计证据；
4. 通知数据所有者；
5. 判断是否需要轮换链接和凭据；
6. 修订审核规则；
7. 重新做脱敏和授权检查。

## 14. 已知边界

- Basic Auth 适合单管理员，不适合团队权限管理。
- Dify 的模型输出仍需人工复核。
- 结构化输出保证格式，不保证事实正确。
- 知识库检索召回受分段、Embedding、Rerank 和语料质量影响。
- Cloudflare Tunnel 解决入口暴露问题，不替代服务器补丁和容器安全。
- 8 GiB 足够当前轻量部署，不代表适合高并发或本地模型推理。

