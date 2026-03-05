# Security & Privacy Improvements

## Overview

This application now includes **automatic secret and PII redaction** to protect your sensitive data when sending code to AI providers (Groq cloud API).

## What Gets Redacted

### 🔐 Secrets & Credentials
- **API Keys**: Generic API keys, AWS access/secret keys
- **Tokens**: OAuth tokens, JWT tokens, GitHub tokens, Slack tokens
- **Passwords**: Passwords in URLs, credential strings
- **Database Connections**: Connection strings with credentials
- **SSH Keys**: Private keys in any format
- **Credit Cards**: Credit card numbers

### 👤 PII (Personally Identifiable Information)
- **Email Addresses**: All email formats
- **IP Addresses**: IPv4 addresses (with optional ports)
- **Phone Numbers**: International phone number formats
- **SSN**: Social Security Numbers (US format)
- **Physical Addresses**: Street addresses with common patterns

## What Gets Preserved

The sanitization **preserves useful code context**:
- ✅ Function names
- ✅ Class names
- ✅ Variable names
- ✅ Code structure
- ✅ Import paths
- ✅ File paths
- ✅ Comments and documentation

## Configuration

### Enable/Disable Sanitization

By default, sanitization is **enabled**. You can control it via:

```bash
# Disable sanitization (NOT recommended)
aic config --set sanitize=false

# Re-enable sanitization (recommended)
aic config --set sanitize=true
```

### View Redaction Logs

When secrets are detected and redacted, you'll see output like:

```
⚠️  Found and redacted 5 sensitive item(s):
   👤 PII: 2 item(s)
   🔑 SECRET: 3 item(s)
```

Detailed logs are stored in:
- Activity logs: `~/.aic-logs/activity.json`
- Look for `sensitive_data_redacted` events

## How It Works

1. **Before AI Generation**: Your git diff is scanned for patterns
2. **Pattern Matching**: Uses regex patterns to detect sensitive data
3. **Redaction**: Replaces matches with placeholder tags
4. **Logging**: Tracks what was redacted (for transparency)
5. **AI Processing**: Only sanitized data is sent to Groq/Ollama

### Example Transformation

**Before (UNSAFE to send to AI):**
```javascript
const config = {
  apiKey: 'sk-1234567890abcdefghijklmnop',
  email: 'admin@company.com',
  server: '192.168.1.100:8080'
};
```

**After (SAFE to send to AI):**
```javascript
const config = {
  apiKey: '[REDACTED_API_KEY]',
  email: '[REDACTED_EMAIL]',
  server: '[REDACTED_IP]:8080'
};
```

## Security Best Practices

### 1. Use Ollama for Maximum Privacy
For **100% local** processing (no data leaves your machine):
```bash
aic setup
# Select "Ollama (Local)"
```

### 2. Keep Sanitization Enabled
Never disable `sanitize` unless:
- You're using Ollama (local AI only)
- You're absolutely sure your code has no secrets

### 3. Review Redaction Logs
Check what was redacted:
```bash
aic stats --analyze
```

### 4. Use .gitignore for Sensitive Files
Add to `.gitignore`:
```
.env
.env.local
*.key
*.pem
credentials.json
secrets/
```

### 5. Never Commit Secrets
Even with redaction, follow these practices:
- Use environment variables
- Use secret management tools (HashiCorp Vault, AWS Secrets Manager)
- Rotate exposed credentials immediately

## Testing

Test the secret scanner:

```bash
npm test -- tests/secret-scanner-enhanced.test.js
```

## Data Flow with Security

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Git Diff (Raw)                                           │
│    - May contain API keys, emails, passwords                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SecretScanner (Sanitization)                             │
│    - Detects secrets & PII                                  │
│    - Redacts with placeholders                              │
│    - Logs what was redacted                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Sanitized Diff                                           │
│    - No secrets or PII                                      │
│    - Preserves code context (functions, classes, etc.)      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. AI Provider (Groq/Ollama)                                │
│    - Only receives sanitized data                           │
│    - Generates commit messages                              │
└─────────────────────────────────────────────────────────────┘
```

## Limitations

⚠️ **Important Notes**:

1. **Not 100% Perfect**: Sophisticated obfuscation may evade detection
2. **False Positives**: Legitimate values might be redacted
3. **Use Environmental Checks**: Combine with pre-commit hooks
4. **Regular Audits**: Review your codebase regularly for secrets

## Reporting Issues

If you find:
- Secrets that are NOT being redacted
- Legitimate code being incorrectly redacted
- Ways to improve the detection patterns

Please report at: https://github.com/barungrazitti/gitops/issues

## Privacy Policy

- **No Data Collection**: This app doesn't collect or store your data
- **Local Processing**: Ollama mode keeps everything on your machine
- **Groq Cloud**: Only sanitized diffs are sent (with sanitization enabled)
- **Logs Stored Locally**: Activity logs are stored on your machine only

## Frequently Asked Questions

**Q: Is my code safe to send to Groq?**
A: With sanitization **enabled** (default), secrets and PII are redacted before sending.

**Q: Can I disable sanitization?**
A: Yes, but it's **not recommended** unless using Ollama (local AI only).

**Q: What about function names with 'password' in them?**
A: Function names are preserved, only values are redacted.

**Q: Does this work with all programming languages?**
A: Yes, pattern-based detection works across all languages.

**Q: Are my credentials stored anywhere?**
A: No, credentials are never stored. They're redacted in transit only.
