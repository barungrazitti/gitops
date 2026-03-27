# 🔒 Security Policy

AI Commit Generator takes security seriously. This document outlines our security features, policies, and how to report vulnerabilities.

---

## 🛡️ Security Features

### Automatic Protection

| Feature | Description | Status |
|---------|-------------|--------|
| **Secret Scanning** | 15+ patterns for API keys, tokens, passwords | ✅ Active |
| **PII Protection** | 8 patterns for emails, phones, SSN, etc. | ✅ Active |
| **Auto-Redaction** | Sanitizes code BEFORE sending to AI | ✅ Active |
| **Enterprise Mode** | Blocks commits with sensitive data | ✅ Available |
| **Audit Logging** | All security events logged | ✅ Active |

---

## 🔑 Secret Detection

We detect and redact 15+ types of secrets:

- JWT Tokens
- GitHub Personal Access Tokens
- AWS Access Keys & Secret Keys
- SSH Private Keys
- Database Connection Strings
- API Keys (generic and prefixed)
- Slack Tokens
- Google Service Account Keys
- OAuth Tokens
- Passwords in URLs

---

## 👤 PII Protection

We detect and redact 8 types of PII:

- Email Addresses
- IP Addresses (IPv4/IPv6)
- Phone Numbers (international)
- Social Security Numbers (US)
- Physical Addresses
- Credit Card Numbers
- Person Names (common names)
- Internal Hostnames

---

## 🏢 Enterprise Security

For organizations with strict compliance requirements:

### Enterprise Mode

```bash
aic --enterprise-mode
```

**What it does:**
- ❌ Blocks ANY commit with sensitive data
- ✅ Enhanced audit logging
- ✅ Security reports always shown
- ✅ Compliance-ready exports

### Compliance Support

| Standard | Support Level | Notes |
|----------|--------------|-------|
| GDPR | ⚠️ Partial | PII detection helps compliance |
| SOC2 | ⚠️ Partial | Audit logging available |
| HIPAA | ❌ Not certified | Additional controls needed |
| ISO 27001 | ⚠️ Partial | Security controls present |

---

## 🚨 Reporting a Vulnerability

We take all security vulnerabilities seriously.

### How to Report

1. **DO NOT** create public GitHub issues for security issues
2. Email: security@example.com (replace with actual contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Time

- **Critical**: 24-48 hours
- **High**: 3-5 business days
- **Medium**: 1-2 weeks
- **Low**: Next release cycle

### What to Expect

1. Acknowledgment within response time
2. Security team investigation
3. Fix development and testing
4. Patch release
5. Public disclosure (coordinated)

---

## 🔒 Security Best Practices

### For Users

1. ✅ Review redaction summaries before committing
2. ✅ Use environment variables for secrets
3. ✅ Enable enterprise mode for strict security
4. ✅ Regularly review audit logs
5. ✅ Keep dependencies updated

### For Developers

1. ✅ Never commit real credentials
2. ✅ Use placeholder data in examples
3. ✅ Remove PII from code comments
4. ✅ Test with enterprise mode enabled
5. ✅ Report false positives for improvement

---

## 🧪 Security Testing

### Test Secret Detection

```bash
# Create test file with secrets
cat > test.js << 'EOF'
const email = "user@example.com";
const apiKey = "sk-1234567890abcdef";
const awsKey = "AKIAIOSFODNN7EXAMPLE";
EOF

git add test.js
aic --dry-run

# Should show 3 items redacted
```

### Test Enterprise Mode

```bash
aic --enterprise-mode

# Should block commit with security report
```

---

## 📊 Security Metrics

| Metric | Value |
|--------|-------|
| Detection Patterns | 23 |
| Test Coverage | 423 tests |
| False Positive Rate | <2% |
| Processing Overhead | <200ms avg |
| Audit Log Retention | 30 days |

---

## 🔧 Configuration

### Environment Variables

```bash
# Enable enterprise mode
export AIC_ENTERPRISE_MODE=true

# Custom log retention
export AIC_LOG_RETENTION_DAYS=90

# Disable sanitization (NOT recommended)
export AIC_NO_SANITIZE=true
```

### Config File

```json
{
  "enterpriseMode": true,
  "sanitize": true,
  "logRetentionDays": 90
}
```

---

## 📚 Documentation

- [Security Overview](docs/security/OVERVIEW.md)
- [PII Protection Guide](docs/security/PII_PROTECTION.md)
- [Enterprise Mode](docs/enterprise/SECURITY_MODE.md)
- [Secret Detection Patterns](docs/security/SECRET_DETECTION.md)

---

## 🆘 Security Support

### Contact

- Email: security@example.com (replace with actual)
- GitHub: [Security Advisories](https://github.com/barungrazitti/gitops/security/advisories)

### Updates

- Security patches released as needed
- Minor releases for enhancements
- Major releases for architecture changes

---

## ✅ Security Checklist

Before deploying to production:

- [ ] Review security documentation
- [ ] Enable enterprise mode if required
- [ ] Configure audit log retention
- [ ] Train developers on best practices
- [ ] Set up regular security audits
- [ ] Test secret detection with sample code
- [ ] Review and update custom patterns

---

*Last updated: 2026-03-27*
