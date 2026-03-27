# 🚀 Deployment Guide

**Production deployment guide for AI Commit Generator in enterprise environments**

---

## 📋 Overview

AI Commit Generator is a **CLI tool** that runs locally on developer machines, not a server application. This guide covers deployment strategies for teams and organizations.

---

## 🎯 Deployment Models

### Model 1: Individual Developer Setup (Most Common)
Each developer installs the tool locally and configures their own API key.

### Model 2: Team Standardization
Organization provides standardized setup scripts and configuration templates.

### Model 3: CI/CD Integration
Tool is integrated into build pipelines for automated commit messages.

### Model 4: Managed Service
Centralized API key management with distributed CLI installation.

---

## 🏢 Enterprise Deployment Strategies

### Strategy 1: Self-Service Deployment

#### Prerequisites
- Developers have Node.js installed
- Individual AI provider accounts
- Basic command-line familiarity

#### Deployment Steps
1. **Provide Installation Guide**
   ```bash
   # Share these commands with developers
   git clone https://github.com/baruntayenjam/ai-commit-generator.git
   cd ai-commit-generator
   npm install
   npm link
   ```

2. **Setup Instructions**
   ```bash
   # Each developer runs
   aic setup
   # Or configure manually
   aic config --set provider=groq
   aic config --set apiKey=personal_api_key
   ```

3. **Verification**
   ```bash
   aic test
   aic --version
   ```

#### Pros
- No infrastructure overhead
- Developers control their own API keys
- Easy to implement
- Scalable to any team size

#### Cons
- Inconsistent configurations
- No centralized billing
- Individual responsibility

---

### Strategy 2: Standardized Team Deployment

#### Create Team Setup Script

**setup-team.sh** (macOS/Linux)
```bash
#!/bin/bash
echo "🚀 Setting up AI Commit Generator for [Your Company]..."

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git not found. Please install Git from https://git-scm.com"
    exit 1
fi

# Install the tool
echo 📦 Installing AI Commit Generator...
git clone https://github.com/baruntayenjam/ai-commit-generator.git
cd ai-commit-generator
npm install
npm link

REM Set company-standard configuration
echo ⚙️ Applying company configuration...
aic config --set provider=groq
aic config --set conventionalCommits=true
aic config --set language=en
aic config --set messageCount=3
aic config --set cache=true

REM Install git hook
echo 🔧 Installing git hook...
aic hook --install

echo ✅ Installation complete!
echo.
echo 📝 Next steps:
echo 1. Get your Groq API key from: https://console.groq.com/keys
echo 2. Set your API key: aic config --set apiKey=your_key_here
echo 3. Test the setup: aic test
echo 4. Start using: aic
```

#### Configuration Template

**company-config.json**
```json
{
  "defaultProvider": "groq",
  "conventionalCommits": true,
  "language": "en",
  "messageCount": 3,
  "maxTokens": 150,
  "temperature": 0.7,
  "cache": true,
  "excludeFiles": [
    "*.log",
    "dist/**",
    "node_modules/**",
    "*.min.js",
    "*.min.css"
  ],
  "customPrompts": {
    "feat": "Focus on new features and user-facing capabilities",
    "fix": "Focus on bug fixes and error resolution",
    "docs": "Focus on documentation changes",
    "style": "Focus on code formatting and style changes",
    "refactor": "Focus on code refactoring without functional changes",
    "test": "Focus on test additions and modifications",
    "chore": "Focus on maintenance tasks and dependency updates"
  }
}
```

#### Deployment Script
```bash
#!/bin/bash
# deploy-to-team.sh

echo "🚀 Deploying AI Commit Generator to team..."

# Team members list
TEAM_MEMBERS=("dev1@company.com" "dev2@company.com" "dev3@company.com")

# Send deployment email with instructions
for member in "${TEAM_MEMBERS[@]}"; do
    echo "📧 Sending deployment instructions to $member"
    # Use your email system here
    # mail -s "AI Commit Generator Setup" $member < deployment-email.txt
done

echo "✅ Deployment instructions sent!"
```

---

### Strategy 3: CI/CD Pipeline Integration

#### GitHub Actions Integration

**.github/workflows/ai-commit.yml**
```yaml
name: AI Commit Generator

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  ai-commit:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      with:
        fetch-depth: 0
        
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install AI Commit Generator
      run: |
        git clone https://github.com/baruntayenjam/ai-commit-generator.git
        cd ai-commit-generator
        npm install
        npm link
      
    - name: Configure AI Provider
      run: |
        aic config --set provider=groq
        aic config --set apiKey=${{ secrets.GROQ_API_KEY }}
        aic config --set conventionalCommits=true
        
    - name: Generate AI Commit Message
      if: github.event_name == 'push'
      run: |
        if [[ -n $(git status --porcelain) ]]; then
          aic "ci: automated commit from workflow"
        fi
        
    - name: Test AI Connection
      run: aic test
```

#### Jenkins Pipeline Integration

**Jenkinsfile**
```groovy
pipeline {
    agent any
    
    environment {
        GROQ_API_KEY = credentials('groq-api-key')
    }
    
    stages {
        stage('Setup') {
    steps {
        sh '''
          git clone https://github.com/baruntayenjam/ai-commit-generator.git
          cd ai-commit-generator
          npm install
          npm link
        '''
                sh 'aic config --set provider=groq'
                sh 'aic config --set apiKey=${GROQ_API_KEY}'
            }
        }
        
        stage('AI Commit') {
            steps {
                script {
                    def changes = sh(script: 'git status --porcelain', returnStdout: true).trim()
                    if (changes) {
                        sh 'aic "ci: automated commit from Jenkins"'
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                sh 'aic test'
            }
        }
    }
}
```

#### GitLab CI Integration

**.gitlab-ci.yml**
```yaml
stages:
  - setup
  - commit
  - test

variables:
  GROQ_API_KEY: $GROQ_API_KEY

setup:
  stage: setup
  script:
    - |
      git clone https://github.com/baruntayenjam/ai-commit-generator.git
      cd ai-commit-generator
      npm install
      npm link
    - aic config --set provider=groq
    - aic config --set apiKey=$GROQ_API_KEY
  only:
    - main
    - develop

ai_commit:
  stage: commit
  script:
    - |
      if [ -n "$(git status --porcelain)" ]; then
        aic "ci: automated commit from GitLab CI"
      fi
  only:
    - main
    - develop

test_ai:
  stage: test
  script:
    - aic test
  only:
    - main
    - develop
```

---

### Strategy 4: Managed Service Deployment

#### Centralized API Key Management

**api-key-service.js**
```javascript
class APIKeyService {
    constructor() {
        this.keyServer = process.env.API_KEY_SERVER || 'https://keys.company.com';
        this.serviceToken = process.env.SERVICE_TOKEN;
    }
    
    async getAPIKey(userId) {
        try {
            const response = await fetch(`${this.keyServer}/api/keys/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.serviceToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            return data.apiKey;
        } catch (error) {
            console.error('Failed to fetch API key:', error.message);
            throw error;
        }
    }
    
    async rotateKey(userId) {
        // Implement key rotation logic
    }
    
    async logUsage(userId, tokensUsed) {
        // Implement usage tracking
    }
}

module.exports = APIKeyService;
```

#### Enterprise Configuration

**enterprise-config.js**
```javascript
const APIKeyService = require('./api-key-service');

class EnterpriseConfig {
    constructor() {
        this.keyService = new APIKeyService();
        this.userId = process.env.USER_ID || process.env.USERNAME;
    }
    
    async initialize() {
        try {
            // Get API key from centralized service
            const apiKey = await this.keyService.getAPIKey(this.userId);
            
            // Configure AI Commit Generator
            const { spawn } = require('child_process');
            
            await this.runCommand('aic', ['config', '--set', 'provider=groq']);
            await this.runCommand('aic', ['config', '--set', `apiKey=${apiKey}`]);
            await this.runCommand('aic', ['config', '--set', 'conventionalCommits=true']);
            
            console.log('✅ Enterprise configuration complete');
        } catch (error) {
            console.error('❌ Configuration failed:', error.message);
            process.exit(1);
        }
    }
    
    runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { stdio: 'pipe' });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            });
        });
    }
}

// Auto-initialize if run directly
if (require.main === module) {
    const config = new EnterpriseConfig();
    config.initialize();
}

module.exports = EnterpriseConfig;
```

---

## 🔒 Security Considerations

### API Key Management

#### Individual Keys (Recommended)
```bash
# Each developer manages their own API key
aic config --set apiKey=personal_key

# Keys stored in user's home directory
# ~/.config/ai-commit-generator/config.json
```

#### Team Keys (Use with Caution)
```bash
# Shared team key (rotate regularly)
aic config --set apiKey=shared_team_key

# Store in environment variable for CI/CD
export AI_API_KEY=shared_team_key
```

#### Enterprise Keys
```bash
# Use secret management service
export AI_API_KEY=$(aws secretsmanager get-secret-value --secret-id groq-api-key --query SecretString --output text)
```

### Data Privacy

#### What Data is Sent to AI Providers
- Git diff content (staged changes only)
- Commit message prompts
- Configuration settings

#### What Data is Stored Locally
- Configuration files
- Activity logs
- Cache data
- API keys (encrypted)

#### Security Best Practices
```bash
# Use environment variables for sensitive data
export AI_API_KEY=your_key_here

# Regularly rotate API keys
# Monitor usage logs
# Use dedicated API keys for CI/CD
```

---

## 📊 Monitoring & Analytics

### Usage Tracking

#### Individual Statistics
```bash
# Check personal usage
aic stats
aic stats --analyze
aic stats --export
```

#### Team Analytics Script
```bash
#!/bin/bash
# team-analytics.sh

echo "📊 AI Commit Generator Team Analytics"

TEAM_MEMBERS=("dev1" "dev2" "dev3")

for member in "${TEAM_MEMBERS[@]}"; do
    echo ""
    echo "👤 $member:"
    # Collect statistics from each team member
    # This would require a centralized logging system
done
```

#### Enterprise Monitoring
```javascript
// monitoring.js
class UsageMonitor {
    constructor() {
        this.metricsEndpoint = process.env.METRICS_ENDPOINT;
    }
    
    async trackUsage(userId, provider, tokensUsed, responseTime) {
        const metrics = {
            userId,
            provider,
            tokensUsed,
            responseTime,
            timestamp: new Date().toISOString()
        };
        
        // Send to monitoring system
        await this.sendMetrics(metrics);
    }
    
    async sendMetrics(metrics) {
        // Implement metrics collection (Prometheus, DataDog, etc.)
    }
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Choose deployment strategy
- [ ] Create setup scripts
- [ ] Prepare configuration templates
- [ ] Set up API key management
- [ ] Create documentation

### Deployment
- [ ] Distribute installation instructions
- [ ] Configure CI/CD integration
- [ ] Set up monitoring
- [ ] Test deployment process

### Post-Deployment
- [ ] Verify installations
- [ ] Monitor usage
- [ ] Collect feedback
- [ ] Update documentation

---

## 🔄 Maintenance & Updates

### Update Management

#### Manual Updates
```bash
# Individual updates
cd ai-commit-generator
git pull origin main
npm update
npm link

# Team updates (via script)
./update-team.sh
```

#### Automated Updates
```bash
#!/bin/bash
# auto-update.sh

cd ai-commit-generator
CURRENT_VERSION=$(aic --version)
git fetch origin
LATEST_VERSION=$(git describe --tags origin/main 2>/dev/null || echo "unknown")

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    echo "🔄 Updating AI Commit Generator..."
    git pull origin main
    npm update
    npm link
    echo "✅ Updated to version $(aic --version)"
else
    echo "✅ Already up to date"
fi
```

### Configuration Management

#### Backup Configuration
```bash
# Export configuration
aic config --list > backup-config.txt

# Restore configuration
while IFS= read -r line; do
    if [[ $line == *"="* ]]; then
        aic config --set "$line"
    fi
done < backup-config.txt
```

---

## 📞 Support & Troubleshooting

### Common Deployment Issues

#### Permission Issues
```bash
# macOS/Linux
sudo chown -R $(whoami) ~/.npm
sudo npm install -g ai-commit-generator

# Windows (Run as Administrator)
npm install -g ai-commit-generator
```

#### Network Issues
```bash
# Set proxy
aic config --set proxy=http://proxy.company.com:8080

# Use environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

#### API Key Issues
```bash
# Test API key
aic test

# Reset configuration
aic config --reset
aic setup
```

### Support Channels
- **Documentation**: INSTALLATION.md, EXAMPLES.md
- **GitHub Issues**: Report bugs and request features
- **Email Support**: support@company.com (for enterprise customers)

---

## 🎉 Success Metrics

### Adoption Metrics
- Number of developers with tool installed
- Frequency of usage per developer
- Team-wide adoption rate

### Quality Metrics
- Commit message quality scores
- Reduction in time spent on commit messages
- Developer satisfaction scores

### Performance Metrics
- Average response time
- API usage and costs
- Error rates and troubleshooting frequency

---

**🚀 Your AI Commit Generator deployment is now ready for enterprise use!**