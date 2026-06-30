# Security Policy


## Reporting a Vulnerability / 报告漏洞

**请不要通过公开 Issue 报告安全漏洞。**  
**Please do NOT report security vulnerabilities via public GitHub Issues.**

### 推荐方式 / Recommended

使用 GitHub 内置的私密漏洞报告功能（Private Vulnerability Reporting）私密提交：

Use GitHub's built-in Private Vulnerability Reporting to submit confidentially:

👉 [Report a vulnerability](https://github.com/Open-X-Humanoid/BICMap/security/advisories/new)

### 备用方式 / Alternative

如果无法使用上述方式，可发送邮件至项目维护团队：

If the above is unavailable, please email the maintainers:

📧 **opensource@x-humanoid.com**

邮件请包含 / Please include in your email:

- 漏洞描述 / Vulnerability description
- 影响范围（版本、环境）/ Affected versions and environment
- 复现步骤 / Steps to reproduce
- 潜在影响评估 / Potential impact assessment
- 如有 PoC，请一并提供 / Proof of concept (if available)

---

## Scope / 适用范围

本安全策略适用于：/ This policy applies to:

- `@x-humanoid-cloud/bic-map` npm 包 / npm package
- 本仓库示例门户代码 / Example portal code in this repository

**不在范围内 / Out of scope：**

- 依赖库本身的漏洞（请向上游报告）/ Vulnerabilities in upstream dependencies (report to upstream)
- 仅影响开发工具链（devDependencies）且无法被终端用户触发的漏洞 / Vulnerabilities only affecting dev toolchain (devDependencies) with no end-user impact

---

## 致谢 / Acknowledgements

我们感谢所有负责任地披露安全漏洞的研究人员，并会在漏洞修复后的发布说明中对贡献者表示感谢。

We appreciate all researchers who responsibly disclose security vulnerabilities. Contributors will be acknowledged in the release notes after the fix is published.
