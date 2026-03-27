# Enterprise Security Mode

Strict security controls for organizations with compliance requirements.

---

## 🏢 Overview

Enterprise Mode provides zero-tolerance security scanning for organizations that cannot risk any sensitive data being sent to external AI providers.

---

## 🎯 What It Does

| Feature | Standard Mode | Enterprise Mode |
|---------|--------------|-----------------|
| Secret Detection | Auto-redact | **BLOCK commit** |
| PII Detection | Auto-redact | **BLOCK commit** |
| Security Report | On demand | **Always shown** |
| Audit Logging | Standard | **Enhanced** |
| Compliance | Basic | **Ready** |

---

## 🚀 Enable Enterprise Mode

### Command Line

```bash
aic --enterprise-mode
```

### Configuration

```bash
aic config --set enterpriseMode=true
```

### Environment Variable

```bash
export AIC_ENTERPRISE_MODE=true
```

---

## 🔒 How It Works

### Standard Flow

```
Code → Scan → Redact → Send to AI → Commit ✅
```

### Enterprise Flow

```
Code → Scan → Found secrets? 
         ├─ NO → Send to AI → Commit ✅
         └─ YES → BLOCK → Show Report → Stop ❌
```

---

## 📊 Example Output

### Clean Code (No Secrets)

```bash
$ aic --enterprise-mode

🔒 Scanning for sensitive information...
✅ No sensitive data detected - Safe to send to AI

🧩 Analyzing repository context...
🤖 Generating commit messages...
✅ Committed: feat(utils): add helper function

✓ Done in 1.8s
```

### Code with Secrets (BLOCKED)

```bash
$ aic --enterprise-mode

🔒 Scanning for sensitive information...

⚠️  Found and redacted 3 sensitive item(s):
   🔑 SECRET: 2 item(s)
      - aws_access_key: 1
      - api_key: 1
   👤 PII: 1 item(s)
      - email_address: 1

🏢 Enterprise mode: Sensitive data detected - commit blocked

💡 Recommendations:
   🔒 Secrets detected - Use environment variables instead of hardcoded credentials
   ⚠️  PII detected - Consider removing personal data from code comments
   🏢 Enterprise mode: Content blocked due to sensitive data

Action required:
1. Remove or refactor sensitive data
2. Use environment variables for secrets
3. Remove PII from code comments
4. Re-run commit
```

---

## 🛡️ Detection Patterns

### Secrets (15+ Patterns)

| Type | Example | Status |
|------|---------|--------|
| JWT Tokens | `eyJhbGciOiJIUzI1NiJ9...` | 🚫 Blocked |
| GitHub Tokens | `ghp_xxxxxxxxxxxx` | 🚫 Blocked |
| AWS Keys | `AKIAIOSFODNN7EXAMPLE` | 🚫 Blocked |
| Database URLs | `mongodb://user:pass@host` | 🚫 Blocked |
| API Keys | `sk_xxxxxxxxxxxxx` | 🚫 Blocked |
| SSH Keys | `BEGIN PRIVATE KEY` | 🚫 Blocked |
| Slack Tokens | `xoxb-xxxxxxxxxxxx` | 🚫 Blocked |

### PII (8 Patterns)

| Type | Example | Status |
|------|---------|--------|
| Email | `user@company.com` | 🚫 Blocked |
| Phone | `+1-555-123-4567` | 🚫 Blocked |
| SSN | `123-45-6789` | 🚫 Blocked |
| Address | `123 Main St` | 🚫 Blocked |
| Credit Card | `4111-1111-1111` | 🚫 Blocked |
| IP Address | `192.168.1.1` | 🚫 Blocked |
| Names | `John Smith` | 🚫 Blocked |
| Hostnames | `dev.internal.corp` | 🚫 Blocked |

---

## 📋 Compliance Features

### Audit Trail

All security events are logged with:

- Timestamp
- User/session ID
- Types of secrets detected
- Count by category
- Action taken (blocked/allowed)

### Export Logs

```bash
# Export security events
aic stats --export --format json

# Filter for enterprise mode events
aic stats --analyze | grep "enterprise_mode_blocked"
```

### Retention

| Data Type | Retention |
|-----------|-----------|
| Activity Logs | 30 days |
| Security Events | 90 days |
| Audit Reports | Exportable |

---

## 🔧 Configuration

### Programmatic Usage

```javascript
const SecretScanner = require('./src/utils/secret-scanner');
const scanner = new SecretScanner({ enterpriseMode: true });

// Check if content is safe
const isSafe = scanner.isContentSafe(diffContent);
if (!isSafe) {
  console.log('❌ Content has sensitive data - blocked');
  return;
}

// Get detailed report
const report = scanner.getSecurityReport(diffContent);
console.log('Security Report:', report);
```

### Custom Patterns

Add organization-specific patterns:

```javascript
const scanner = new SecretScanner({ enterpriseMode: true });

// Add custom pattern for company-specific secrets
scanner.addCustomPattern(
  'company_api_key',
  /MYCOMPANY_[A-Za-z0-9]{20,}/g,
  '[REDACTED_COMPANY_KEY]'
);
```

---

## 🧪 Testing Enterprise Mode

### Test with Sample Code

```bash
# Create test file with secrets
cat > test.js << 'EOF'
const config = {
  email: "user@example.com",
  apiKey: "sk-1234567890abcdef",
  awsKey: "AKIAIOSFODNN7EXAMPLE"
};
EOF

git add test.js

# Run in enterprise mode
aic --enterprise-mode

# Expected: Commit BLOCKED with security report
```

### Test Clean Code

```bash
# Create clean test file
cat > clean.js << 'EOF'
function add(a, b) {
  return a + b;
}

module.exports = add;
EOF

git add clean.js

# Run in enterprise mode
aic --enterprise-mode

# Expected: Commit allowed
```

---

## 🆘 Troubleshooting

### Commit Blocked - What Now?

1. **Review the security report**
   - Check what was detected
   - Note the file locations

2. **Remove sensitive data**
   - Replace with environment variables
   - Use placeholder values
   - Remove PII from comments

3. **Re-commit**
   ```bash
   git add .
   aic --enterprise-mode
   ```

### False Positives

If legitimate code is flagged:

1. Review the pattern match
2. Consider refactoring to avoid pattern
3. Report for pattern improvement
4. For urgent needs, use standard mode temporarily:
   ```bash
   aic --no-enterprise-mode
   ```

### Performance Impact

Enterprise mode adds minimal overhead:

| Diff Size | Scan Time |
|-----------|-----------|
| <100 lines | <50ms |
| 100-500 lines | <200ms |
| >500 lines | <500ms |

---

## 📊 Security Metrics

### Dashboard

```bash
# View enterprise mode statistics
aic stats --analyze

# Sample output:
🏢 Enterprise Mode Statistics (Last 30 days):
  Total commits attempted: 150
  Blocked by security: 12 (8%)
  Most common: API keys (5), Emails (4), IPs (3)
```

### Common Detections

| Type | Count | Percentage |
|------|-------|------------|
| API Keys | 45% | Most common |
| Emails | 25% | Common |
| IPs | 15% | Occasional |
| Tokens | 10% | Occasional |
| PII | 5% | Rare |

---

## ✅ Best Practices

### For Developers

1. ✅ Use environment variables for all secrets
   ```javascript
   // ❌ Bad
   const apiKey = "sk-1234567890";
   
   // ✅ Good
   const apiKey = process.env.API_KEY;
   ```

2. ✅ Use placeholder data in examples
   ```javascript
   // ❌ Bad
   const email = "john@company.com";
   
   // ✅ Good
   const email = "user@example.com";
   ```

3. ✅ Avoid PII in comments
   ```javascript
   // ❌ Bad
   // Contact John Smith (john@company.com) for access
   
   // ✅ Good
   // Contact team lead for access
   ```

### For Organizations

1. ✅ Enable enterprise mode by default
2. ✅ Regular security audits
3. ✅ Developer training on secrets management
4. ✅ Use secret scanning in CI/CD
5. ✅ Review audit logs monthly

---

## 🔗 Related Documentation

- [PII Protection Guide](../security/PII_PROTECTION.md)
- [Security Overview](../security/OVERVIEW.md)
- [Secret Detection Patterns](../security/SECRET_DETECTION.md)
- [Usage Guide](../user-guide/USAGE.md)

---

## 📞 Support

For enterprise support:

- 📧 Email: support@example.com (replace with actual)
- 📖 Documentation: [docs/enterprise/](../INDEX.md)
- 🐛 Issues: [GitHub Issues](https://github.com/barungrazitti/gitops/issues)

---

*Last updated: 2026-03-27*
