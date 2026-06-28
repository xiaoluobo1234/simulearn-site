# Contributing to SimuLearn

感谢改进 SimuLearn。

## 可以贡献什么

- 仿真学习路线和理论勘误；
- 结构、热、流体、多物理场和芯片仿真案例；
- 诊断卡片和失败复盘；
- 开源工具脚本；
- Dify Workflow、Chatflow 和检索改进；
- Cloudflare Worker、Astro 和可访问性改进；
- 部署文档和故障排查。

## 内容贡献要求

案例必须说明：

- 问题和目标；
- 物理假设；
- 边界条件；
- 网格和求解设置；
- 验证方法；
- 失败或不确定项；
- 数据与图片来源；
- 脱敏和授权状态。

不得提交：

- 客户、项目和人员敏感信息；
- 未授权图纸、模型和结果；
- API Key、密码、Token 和私钥；
- 受版权保护的完整论文、教材或商业软件文件；
- 无验证依据的工程结论。

## 开发流程

```bash
git clone <YOUR_FORK_URL>
cd simulearn-site
npm clean-install
npm run dev
```

提交前：

```bash
npm run build
npm run check:functions
npx wrangler deploy --dry-run --outdir .wrangler/worker
git diff --check
```

建议：

1. 从 `main` 创建分支；
2. 一个 Pull Request 只解决一个主题；
3. 描述修改动机、验证方法和截图；
4. 不在截图中暴露账号、IP 或密钥；
5. 涉及真实工程案例时附脱敏说明。

## Commit

示例：

```text
feat: 增加热应力验证案例
fix: 修复知识库检索范围
docs: 补充 Docker 镜像故障排查
```

## 安全问题

不要为密钥泄漏或未公开漏洞创建公开 Issue。按 [SECURITY.md](SECURITY.md) 使用 GitHub Private Vulnerability Reporting。

