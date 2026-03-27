# PII Protection & Security

How AI Commit Generator protects your sensitive data from being sent to external AI providers.

---

## 🔒 Security Overview

**All code is sanitized BEFORE sending to AI providers (Groq/Ollama).**

### Data Flow

```
Your Code Changes
       ↓
┌──────────────────────┐
│  SecretScanner       │ ← Scans for 20+ patterns
│  scanAndRedact()     │
└──────────────────────┘
       ↓
┌──────────────────────┐
│  InputSanitizer      │ ← Additional sanitization
│  sanitizeDiffContent │
└──────────────────────┘
       ↓
┌──────────────────────┐
│  PromptBuilder       │ ← Builds AI prompt
└──────────────────────┘
       ↓
┌──────────────────────┐
│  Groq/Ollama API     │ ← Only CLEAN data sent
└──────────────────────┘
```

---

## 📊 What Gets Detected & Redacted

### Secrets (15+ Patterns)

| Type | Pattern Example | Redacted As |
|------|-----------------|-------------|
| JWT Tokens | `eyJhbGciOiJIUzI1NiJ9...` | `[REDACTED_JWT]` |
| GitHub Tokens | `ghp_xxxxxxxxxxxxxxxxxxxx` | `[REDACTED_GITHUB_TOKEN]` |
| AWS Access Keys | `AKIAIOSFODNN7EXAMPLE` | `[REDACTED_AWS_ACCESS_KEY]` |
| AWS Secret Keys | `aws_secret_key=xxx` | `[REDACTED_AWS_SECRET_KEY]` |
| SSH Private Keys | `BEGIN PRIVATE KEY` | `[REDACTED_SSH_KEY]` |
| Database URLs | `mongodb://user:pass@host` | `[REDACTED_DATABASE]` |
| API Keys | `sk_xxxxxxxxxxxxx` | `[REDACTED_API_KEY]` |
| Slack Tokens | `xoxb-xxxxxxxxxxxx` | `[REDACTED_SLACK_TOKEN]` |
| Google Service Accounts | `"private_key_id":...` | `[REDACTED]` |
| OAuth Tokens | `oauth_token=xxx` | `[REDACTED_TOKEN]` |
| Passwords in URLs | `://user:pass@host` | `://[USER]:[PASSWORD]@` |

### PII (8 Patterns)

| Type | Pattern Example | Redacted As |
|------|-----------------|-------------|
| Email Addresses | `user@company.com` | `[REDACTED_EMAIL]` |
| IP Addresses | `192.168.1.100` | `[REDACTED_IP]` |
| Phone Numbers | `+1-555-123-4567` | `[REDACTED_PHONE]` |
| SSN (US) | `123-45-6789` | `[REDACTED_SSN]` |
| Physical Addresses | `123 Main St, City` | `[REDACTED_ADDRESS]` |
| Credit Cards | `4111-1111-1111-1111` | `[REDACTED_CREDIT_CARD]` |
| Person Names | `John Smith` | `[REDACTED_NAME]` |
| Internal Hostnames | `dev.internal.corp` | `[REDACTED_HOSTNAME]` |

---

## 🛡️ How It Works

### Automatic Scanning

Every `aic` command automatically:

1. **Scans** staged changes for secrets and PII
2. **Redacts** sensitive data before AI processing
3. **Reports** what was found and redacted
4. **Logs** to audit trail for compliance

### Example Output

```bash
$ aic

🔒 Scanning for sensitive information...

⚠️  Found and redacted 5 sensitive item(s):
   🔑 SECRET: 3 item(s)
      - aws_access_key: 1
      - api_key: 1
      - database_connection: 1
   👤 PII: 2 item(s)
      - email_address: 1
      - ip_address: 1

✅ Redacted content sent to AI

✅ Committed: feat(config): update database settings
```

---

## 🏢 Enterprise Mode

For organizations with strict data security requirements.

### Enable Enterprise Mode

```bash
aic --enterprise-mode
```

### What It Does

| Feature | Standard Mode | Enterprise Mode |
|---------|--------------|-----------------|
| Secret Detection | ✅ Redacts | ✅ **BLOCKS** |
| PII Detection | ✅ Redacts | ✅ **BLOCKS** |
| Audit Logging | ✅ Yes | ✅ Enhanced |
| Security Report | ⚠️ On demand | ✅ Always shown |

### Enterprise Mode Behavior

```bash
$ aic --enterprise-mode

🔒 Scanning for sensitive information...

⚠️  Found and redacted 2 sensitive item(s):
   🔑 SECRET: 1 item(s)
   👤 PII: 1 item(s)

🏢 Enterprise mode: Sensitive data detected - commit blocked

💡 Recommendations:
   ⚠️  PII detected - Consider removing personal data from code comments
   🔒 Secrets detected - Use environment variables instead of hardcoded credentials
   🏢 Enterprise mode: Content blocked due to sensitive data
```

---

## 🔍 Security Report

Get detailed security analysis of your changes:

```javascript
const SecretScanner = require('./src/utils/secret-scanner');
const scanner = new SecretScanner();

const report = scanner.getSecurityReport(diffContent);

console.log(report);
// {
//   originalLength: 1234,
//   sanitizedLength: 1100,
//   secretsFound: 5,
//   categories: { secret: 3, pii: 2 },
//   isEnterpriseSafe: false,
//   recommendations: [...]
// }
```

---

## ⚠️ What's NOT Detected

No automated system is perfect. Be aware of these limitations:

| Risk | Example | Status |
|------|---------|--------|
| Variable names with PII | `const johnEmail = "..."` | ❌ Name not detected |
| Customer IDs | `customerId = "CUST-123"` | ❌ Not detected |
| Plain text in comments | `// Contact Alice for access` | ⚠️ Name only |
| Internal codenames | `ProjectPhoenix launch` | ❌ Not detected |
| Business logic secrets | `const discountRate = 0.25` | ❌ Not detected |

### Best Practices

1. ❌ **Don't** put real PII in code comments
2. ❌ **Don't** hardcode customer data in tests
3. ✅ **Do** use environment variables for secrets
4. ✅ **Do** use placeholder data in examples
5. ✅ **Do** review redaction reports

---

## 🧪 Testing Security

Verify security scanning works:

```bash
# Create test file with secrets
cat > test.js << 'EOF'
const email = "user@example.com";
const apiKey = "sk-1234567890abcdef";
const awsKey = "AKIAIOSFODNN7EXAMPLE";
EOF

git add test.js

# Run with dry-run to see what would be sent
aic --dry-run

# Check redaction summary
# Should show 3 items redacted
```

---

## 📋 Compliance

### Audit Trail

All security events are logged:

- `sensitive_data_redacted` - What was redacted
- `enterprise_mode_blocked` - Commits blocked in enterprise mode
- `no_secrets_found` - Clean scans logged

### Access Logs

```bash
# View security-related activity
aic stats --analyze | grep -i "secret\|redact\|pii"
```

### Data Retention

- Activity logs: 30 days
- Security events: 90 days
- Redaction reports: Session only (not stored)

---

## 🔧 Configuration

### Custom Patterns

Add custom detection patterns:

```javascript
const scanner = new SecretScanner();
scanner.addCustomPattern(
  'my_company_secret',
  /MY_SECRET_PREFIX_[A-Za-z0-9]+/g,
  '[REDACTED_COMPANY_SECRET]'
);
```

### Disable Sanitization

⚠️ **Not recommended** - Only for trusted internal code:

```bash
aic --no-sanitize
```

---

## 🆘 Troubleshooting

### False Positives

If legitimate code is redacted:

1. Review the redaction summary
2. Check if it matches a secret pattern
3. Consider refactoring to avoid pattern match
4. Report false positive for pattern improvement

### Enterprise Mode Blocking

If commits are blocked:

1. Review the security report
2. Remove or redact sensitive data manually
3. Use environment variables for secrets
4. Commit in smaller chunks

### Performance Impact

Security scanning adds minimal overhead:

- Small diffs (<100 lines): <50ms
- Medium diffs (100-500 lines): <200ms
- Large diffs (>500 lines): <500ms

---

## 📚 Related Documentation

- [Enterprise Mode](../enterprise/SECURITY_MODE.md)
- [Secret Detection Patterns](SECRET_DETECTION.md)
- [Security Overview](OVERVIEW.md)
- [Usage Guide](../user-guide/USAGE.md)

---

## 🎯 Security Checklist

Before committing sensitive code:

- [ ] Review redaction summary
- [ ] Remove hardcoded credentials
- [ ] Use environment variables
- [ ] Remove PII from comments
- [ ] Enable enterprise mode for extra safety
- [ ] Check audit logs regularly

---

*Last updated: 2026-03-27*
