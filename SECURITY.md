# Security Policy

## 支持范围

安全修复优先应用于 `main` 分支当前版本。

## 报告漏洞

请使用 GitHub 仓库的 **Security → Report a vulnerability** 私密报告功能。

不要在公开 Issue、Discussion、Pull Request、截图或日志中提交：

- API Key；
- 密码；
- Cloudflare Token；
- Tunnel credentials；
- 证书私钥；
- 服务器 IP 和账户信息；
- 未公开工程数据；
- 可直接利用的完整攻击步骤。

报告应包含：

- 受影响路径或组件；
- 复现条件；
- 预期与实际行为；
- 影响范围；
- 已做的临时缓解；
- 不含真实密钥的最小示例。

## 泄漏响应

如果密钥已进入公开内容：

1. 立即撤销密钥；
2. 创建新密钥；
3. 更新 Dify 或 Worker Secret；
4. 检查调用、费用和访问日志；
5. 清理 Git 历史或公开附件；
6. 即使内容已删除，也不能继续使用旧密钥。

## 数据安全

原始工程资料默认私有。公开前必须完成：

- 数据所有者授权；
- 客户和项目脱敏；
- 参数组合识别风险检查；
- 第三方版权检查；
- 管理员人工确认。

更多内容见 [docs/SECURITY-OPERATIONS.md](docs/SECURITY-OPERATIONS.md)。

