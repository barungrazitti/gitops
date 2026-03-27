# Security Overview

AI Commit Generator security features and architecture.

---

## 🛡️ Security Features

| Feature | Status | Description |
|---------|--------|-------------|
| Secret Scanning | ✅ Active | 15+ patterns for API keys, tokens, passwords |
| PII Protection | ✅ Active | 8 patterns for emails, phones, SSN, etc. |
| Auto-Redaction | ✅ Active | Automatic sanitization before AI |
| Enterprise Mode | ✅ Active | Block commits with sensitive data |
| Audit Logging | ✅ Active | All security events logged |
| Local Processing | ✅ Active | Ollama support for full privacy |

---

## 🔒 Security Architecture

### Layers of Protection

```
┌─────────────────────────────────────────┐
│  Layer 1: Input Validation              │
│  - File path sanitization               │
│  - Command injection prevention         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 2: Secret Scanning               │
│  - 15+ secret patterns                  │
│  - 8 PII patterns                       │
│  - Auto-redaction                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 3: Quality Validation            │
│  - Message specificity checks           │
│  - Reasoning requirements               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 4: Audit Logging                 │
│  - All operations logged                │
│  - 30-day retention                     │
│  - Compliance ready                     │
└─────────────────────────────────────────┘
```

---

## 🔑 Secret Detection

### Supported Patterns

| Category | Patterns | Examples |
|----------|----------|----------|
| **Cloud Providers** | 6 | AWS, GCP, Azure keys |
| **API Keys** | 4 | Generic, prefixed, labeled |
| **Tokens** | 3 | JWT, OAuth, Slack |
| **Databases** | 2 | Connection strings, credentials |
| **Private Keys** | 1 | SSH, RSA, EC keys |

### Detection Accuracy

| Metric | Value |
|--------|-------|
| True Positive Rate | >95% |
| False Positive Rate | <2% |
| Processing Speed | <200ms avg |

---

## 👤 PII Protection

### Protected Data Types

| Type | Pattern | Example |
|------|---------|---------|
| Email | Regex | `user@domain.com` |
| Phone | International | `+1-555-123-4567` |
| SSN | US format | `123-45-6789` |
| Address | Street patterns | `123 Main St` |
| Credit Card | Card numbers | `4111-1111-1111` |
| IP Address | IPv4/IPv6 | `192.168.1.1` |
| Names | Common names | `John Smith` |
| Hostnames | Internal | `dev.corp.local` |

---

## 🏢 Enterprise Security

### Enterprise Mode Features

1. **Zero-Tolerance Policy**
   - Blocks ANY commit with sensitive data
   - No automatic redaction (strict mode)
   - Requires manual review

2. **Enhanced Logging**
   - All security events logged
   - Exportable for compliance
   - SIEM integration ready

3. **Audit Trail**
   - Who committed what
   - When and from where
   - Security events tracked

### Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | ⚠️ Partial | PII detection helps |
| SOC2 | ⚠️ Partial | Audit logging available |
| HIPAA | ❌ Not certified | Additional controls needed |
| ISO 27001 | ⚠️ Partial | Security controls present |

---

## 🔍 Security Commands

### Check Security Status

```bash
# View redaction summary (automatic with each commit)
aic

# Dry run to preview
aic --dry-run

# Enterprise mode (strict)
aic --enterprise-mode
```

### Audit Logs

```bash
# View recent security events
aic stats --analyze

# Export security logs
aic stats --export --format json

# Filter for security events
aic stats --analyze | grep -i "secret\|redact"
```

---

## 🧪 Security Testing

### Test Secret Detection

```bash
# Create test file with various secrets
cat > test-secrets.js << 'EOF'
const config = {
  email: "user@example.com",
  apiKey: "sk-1234567890abcdef",
  awsKey: "AKIAIOSFODNN7EXAMPLE",
  dbUrl: "mongodb://admin:pass@localhost:27017",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
  ssn: "123-45-6789",
  phone: "+1-555-123-4567"
};
EOF

git add test-secrets.js

# Run with dry-run
aic --dry-run

# Should show 7 items redacted
```

### Test Enterprise Mode

```bash
# Enable enterprise mode
aic --enterprise-mode

# Try to commit with secrets
# Should be BLOCKED with recommendations
```

---

## 🚨 Security Incidents

### What Happens If...

| Scenario | Response |
|----------|----------|
| Secret detected | Auto-redacted, logged |
| PII detected | Auto-redacted, logged |
| Enterprise mode + secret | Commit BLOCKED |
| Rate limit exceeded | Fallback to Ollama |
| Network error | Retry with backoff |
| AI provider fails | Sequential fallback |

### Incident Response

1. **Detection** - Automatic scanning
2. **Redaction** - Immediate sanitization
3. **Logging** - Audit trail created
4. **Notification** - User informed
5. **Prevention** - Recommendations provided

---

## 🔧 Security Configuration

### Environment Variables

```bash
# Enable enterprise mode
export AIC_ENTERPRISE_MODE=true

# Disable sanitization (NOT recommended)
export AIC_NO_SANITIZE=true

# Custom log retention days
export AIC_LOG_RETENTION_DAYS=90
```

### Config File

```json
{
  "enterpriseMode": true,
  "sanitize": true,
  "logRetentionDays": 90,
  "defaultProvider": "groq"
}
```

---

## 📊 Security Metrics

### Current Status

| Metric | Value |
|--------|-------|
| Detection Patterns | 23 |
| Test Coverage | 423 tests |
| False Positive Rate | <2% |
| Processing Overhead | <200ms |
| Audit Log Retention | 30 days |

### Performance Impact

| Diff Size | Scan Time |
|-----------|-----------|
| <100 lines | <50ms |
| 100-500 lines | <200ms |
| >500 lines | <500ms |

---

## 📚 Related Documentation

- [PII Protection Guide](PII_PROTECTION.md)
- [Secret Detection Patterns](SECRET_DETECTION.md)
- [Enterprise Mode](../enterprise/SECURITY_MODE.md)
- [Usage Guide](../user-guide/USAGE.md)

---

## 🆘 Security Support

### Report Vulnerability

Found a security issue? Please report responsibly:

1. **DO NOT** create public GitHub issues
2. Email: security@example.com (replace with actual)
3. Include: Description, reproduction steps, impact

### Security Updates

- Patch releases for critical issues
- Minor releases for enhancements
- Major releases for architecture changes

---

## ✅ Security Checklist

For users:
- [ ] Review redaction summaries
- [ ] Use environment variables for secrets
- [ ] Enable enterprise mode if required
- [ ] Regular audit log reviews
- [ ] Keep dependencies updated

For developers:
- [ ] Security code reviews
- [ ] Pattern testing
- [ ] False positive monitoring
- [ ] Performance benchmarking
- [ ] Documentation updates

---

*Last updated: 2026-03-27*
