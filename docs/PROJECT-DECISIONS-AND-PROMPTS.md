# SimuLearn 需求、决策与提示词档案

本文整理 SimuLearn 从结构仿真学习站点演进为多物理场知识与实训平台的需求来源、问答决策、内容规则和 AI 提示词。它既是项目的产品说明，也是后续开发时可直接提供给 AI 编程助手的上下文。

> 开源说明：公开仓库保留技术决策和复现方法，但不公开个人邮箱、Cloudflare 账户 ID、服务器 IP、主机名、Tunnel UUID、密码、API Key、证书私钥及工程客户信息。

## 1. 项目定位

- 名称：`SimuLearn`
- 主域名：`simulearn.cn`
- Dify 子域名：`ai.simulearn.cn`
- 起点：结构有限元分析、诊断思维、失败复盘和工程验证
- 十年方向：结构 → 热 → 流体 → 多物理场 → 芯片仿真
- 内容形态：知识路线、理论、建模、验证、实操案例、故障诊断、工具脚本
- 核心原则：不把“会点软件按钮”包装成工程能力，优先记录判断依据、物理直觉、验证路径和失败原因

## 2. 最早的迁移提示词

最早的项目提示词将网站定义为“结构仿真诊断与决策平台”，当时的技术栈和页面包括：

- Astro 4.x、TypeScript、原生 CSS 和 Vanilla JavaScript；
- 中文根路径与 `/en/` 英文路径；
- 诊断库：现象 → 判定逻辑 → 根因 → 解法 → 验证；
- 失败博物馆：发生了什么 → 为什么犯错 → 复盘；
- FEA 分析类型预判计算器；
- ANSYS、Abaqus 和通用错误代码查询；
- 博客、关于页和学术风视觉系统。

原始提示词文件由项目所有者从历史环境提供。其主要后续计划包括 Content Collections、错误代码扩充、后处理脚本、站内搜索、RSS 和远期 AI 仿真助手。

## 3. 网站方向问答的最终决策

### 3.1 不变项

- 保留 `SimuLearn` 名称。
- 保留 `simulearn.cn`。
- 保留现有结构仿真、诊断库、失败博物馆、工具箱和错误查询内容。
- 网站导航按领域分流，而不是按软件品牌分流。
- 中文维护完整内容；英文维护定位与精选内容。

### 3.2 领域与栏目

六个公开领域：

1. 结构
2. 热
3. 流体
4. 多物理场
5. 芯片仿真
6. 工程书库

每个领域使用统一栏目：

1. 学习路线
2. 理论基础
3. 建模方法
4. 验证方法
5. 实操案例
6. 故障诊断
7. 工具脚本

### 3.3 用户与长期目标

历史问答中保留了三组相对排序：

- 十年个人目标偏好：`C > D > B > A`
- 网站当前首要服务对象：`A > D > B > C`
- 十年后网站最终形态：`D > B > C > A`

原问卷中 A、B、C、D 的完整选项文字没有进入仓库，不能在开源文档中凭空重建。后续已经把可执行结论固化为“五领域路线、工程案例、公开进度、知识库与实操平台”，因此实现不依赖这些字母选项。

### 3.4 路线与案例

- 公开展示 2026—2036 十年学习路线及进度。
- 明确标注“已实践、学习中、路线规划”，不把计划包装成成果。
- 允许对真实工程资料进行筛选、脱敏和授权检查后转化为案例。
- 原始工程数据默认私有。
- 每个案例统一记录：
  - 工程问题；
  - 物理假设；
  - 几何与材料；
  - 载荷和边界条件；
  - 网格；
  - 求解设置；
  - 验证；
  - 失败复盘；
  - 可公开资源；
  - 脱敏和版权状态。

## 4. AI 知识库问答的最终决策

### 4.1 架构选择

- `simulearn.cn` 继续作为网站入口。
- Dify 部署到阿里云 Docker 服务器。
- Dify 使用 `ai.simulearn.cn`。
- 对话和资料整理模型：DeepSeek。
- Embedding：通义千问 `text-embedding-v4`。
- Rerank：通义千问 `qwen3-rerank`。
- 服务器规格：2 核、8 GiB 内存。
- 模型不在 8 GiB 服务器本地运行，统一调用 API。
- DeepSeek 与阿里云百炼合计月预算目标不超过 200 元。

### 4.2 访问与数据规则

- `/ai` 是管理员工作台，不是公开聊天页。
- `ai.simulearn.cn` 是 Dify 管理端和 API。
- 暂时无法开通 Cloudflare Zero Trust 付费信息验证时，使用 HTTPS + Basic Auth 保护 `/ai` 和 `/api/ai/*`。
- 以后具备条件时，Basic Auth 可替换为 Cloudflare Access 邮箱白名单和 Service Token。
- 浏览器永远不接触 Dify App API Key 或 Dataset API Key。
- 私有原始资料库、待审核整理区不接入公开问答 Chatflow。
- AI 只生成整理草案，最终分类、公开、脱敏和版权判断由管理员确认。

### 4.3 八个知识库

| slug | Dify 名称 | 默认属性 |
|---|---|---|
| `structural` | SimuLearn｜结构 | 公开领域 |
| `thermal` | SimuLearn｜热 | 公开领域 |
| `fluids` | SimuLearn｜流体 | 公开领域 |
| `multiphysics` | SimuLearn｜多物理场 | 公开领域 |
| `chip` | SimuLearn｜芯片仿真 | 公开领域 |
| `books` | SimuLearn｜工程书库 | 公开领域 |
| `private` | SimuLearn｜私有原始资料 | 私有 |
| `review` | SimuLearn｜待审核整理区 | 私有 |

所有知识库使用：

- `high_quality` 索引；
- `text-embedding-v4`；
- Dify 中实际显示的通义 Provider 标识；
- `only_me` 权限。

## 5. Dify Workflow 提示词

资料整理 Workflow 名称：

```text
SimuLearn Document Organizer
```

输入：

```text
filename: string，必填
documents: array[file]，必填，最多 5 个
```

完整系统提示词维护在：

```text
infra/dify/review-workflow-prompt.md
```

输出 Schema：

```json
{
  "summary": "string",
  "category": "structural | thermal | fluids | multiphysics | chip | private | review",
  "tags": ["string"],
  "sensitivity": "string",
  "copyright_risk": "string"
}
```

硬性规则：

- 不能声称资料已经完成脱敏或授权。
- 不能虚构作者、项目、版本、材料或工程参数。
- 第三方论文只建议公开引用、摘要和管理员笔记。
- 原始工程数据默认 `private`。
- 不能确定分类时使用 `review`。

## 6. Dify Chatflow 提示词

知识问答 Chatflow 名称：

```text
SimuLearn Knowledge Assistant
```

完整系统提示词维护在：

```text
infra/dify/chat-system-prompt.md
```

回答结构：

```text
结论
判断依据
建议检查顺序
适用边界与不确定项
```

回答规则：

- 优先使用知识库检索结果。
- 区分知识库证据、工程推断和模型通用知识。
- 证据不足就说“不确定”。
- 不编造文档、标准、错误代码、材料参数、软件命令或仿真结论。
- 工程安全和项目决策必须提示人工复核。
- 来源由 Dify 检索结果提供，模型不能伪造来源编号。

## 7. 版本演进

| Git 提交 | 阶段 | 主要内容 |
|---|---|---|
| `75c42d6` | V1 | 第一版网站 |
| `192ba30` | V2 | 诊断库、失败博物馆、工具箱、错误查询 |
| `3c1c7a4` | V3 | 重构为多物理场仿真知识平台 |
| `5904181` | V4 | AI 工作台与 Dify 部署支持 |
| `ff88d82` | 修复 | Dify 版本查询 |
| `5c6d60f` | 修复 | 使用 GitHub codeload 下载 Dify |
| `789ddce` | V5 | 接入真实 Dify、管理员鉴权 |
| `767d3c5` | 修复 | 适配 Cloudflare Worker 全栈部署 |
| `acb050e` | 修复 | 隐藏模型内部推理内容、修正文案 |
| `e9cb8dd` | 修复 | 补充待审核知识区选项、修正 Workers 文案 |

## 8. 给 AI 编程助手的上下文模板

复制下面内容可继续开发：

```text
项目是 SimuLearn（simulearn.cn），一个从结构有限元出发，面向结构、热、流体、
多物理场和芯片仿真的知识与实训平台。

前端使用 Astro 4、TypeScript、原生 CSS 和 Vanilla JS。
部署目标是 Cloudflare Worker Static Assets，不是 Cloudflare Pages。
Worker 入口为 worker/index.ts，静态目录为 dist。

/ai 是管理员知识库工作台；/api/ai/* 是同源 Worker API。
两者在 live 模式下由 Basic Auth 保护，未来可升级为 Cloudflare Access。
Dify 自托管于 ai.simulearn.cn，通过 Cloudflare Tunnel 连接阿里云 Docker 服务器。

对话和整理使用 DeepSeek；Embedding 使用 text-embedding-v4；
Rerank 使用 qwen3-rerank。
六个公开知识库用于问答，private 和 review 永不接入公开检索。

真实工程数据默认私有；公开必须经过脱敏、授权和人工审核。
内容要记录判断依据、验证路径和适用边界，不能只写按钮操作。

修改后至少运行：
npm run build
npm run check:functions
npx wrangler deploy --dry-run
git diff --check
```

## 9. 原始多轮回答存档

以下内容按对话原样保留。部分回答依赖当时 AI 给出的 A/B/C/D 选项，但问题原文没有进入 Git 仓库；因此只存档，不擅自解释字母含义。

### 9.1 网站方向

第一组已知总体排序：

```text
十年目标：C > D > B > A
当前首要服务对象：A > D > B > C
十年后网站最终形态：D > B > C > A
```

后续四问：

```text
问题1：认可
问题2：每个领域统一栏目
问题3：C
问题4：A
```

真实案例与路线四问：

```text
问题1：允许筛选、脱敏后转化为网站首批真实案例
问题2：实操案例统一采用当时建议的模板
问题3：公开展示十年学习路线及进度
问题4：B
```

最后一轮：

```text
问题1：可以
问题2：可以
问题3：C
问题4：是
```

已经固化到产品中的明确结论：

- 导航按领域分流；
- 五领域统一栏目；
- 真实案例必须筛选、脱敏、授权；
- 十年路线公开；
- 保留 SimuLearn、域名和原结构内容。

### 9.2 AI 知识库五轮问答

第一轮：

```text
问题1：C
问题2：B 和 C
问题3：Dify 在其他电脑；新购阿里云 Docker 服务器
问题4：A/B/C/D 类型的公开资料都希望纳入
```

第二轮的明确决定：

```text
simulearn.cn 保持网站入口
模型选择 DeepSeek
原始工程数据默认私有
完成脱敏与授权检查后才能公开
```

第三轮：

```text
服务器选择 8 GiB
Dify 域名 ai.simulearn.cn
DeepSeek 对话 + 通义 Embedding/Rerank
每月 API 预算 200 元以内
目标是在原网站部署大模型知识库能力
```

第四轮：

```text
问题1：C
问题2：A
问题3：可以
问题4：可以
```

第五轮：

```text
问题1：是
问题2：是
问题3：是
问题4：是
```

这些答案最终落实为本文前面列出的架构和安全规则。
