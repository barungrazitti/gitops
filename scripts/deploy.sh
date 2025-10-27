#!/bin/bash

# AI Commit Generator Deployment Script
# This script prepares and deploys the application for production

set -e

echo "🚀 Starting AI Commit Generator deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-head > /dev/null 2>&1; then
    print_error "Not in a git repository. Please run this script from the project root."
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Please commit or stash them before deploying."
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Running pre-deployment checks..."

# Run linting
print_status "Running ESLint..."
if npm run lint; then
    print_status "✅ ESLint passed"
else
    print_error "❌ ESLint failed"
    exit 1
fi

# Run tests
print_status "Running tests..."
if npm test; then
    print_status "✅ Tests passed"
else
    print_error "❌ Tests failed"
    exit 1
fi

# Run test coverage
print_status "Generating test coverage..."
if npm run test:coverage; then
    print_status "✅ Test coverage generated"
else
    print_error "❌ Test coverage failed"
    exit 1
fi

# Check if package.json is ready for production
print_status "Checking package.json..."
if node -e "const pkg = require('./package.json'); if (!pkg.version || !pkg.main) process.exit(1)"; then
    print_status "✅ package.json is valid"
else
    print_error "❌ Invalid package.json"
    exit 1
fi

# Check if binaries are executable
print_status "Checking binary permissions..."
if [ -f "./bin/aicommit.js" ]; then
    chmod +x ./bin/aicommit.js
    print_status "✅ Binary permissions set"
else
    print_error "❌ Binary not found"
    exit 1
fi

# Create production-ready .npmignore if it doesn't exist
if [ ! -f ".npmignore" ]; then
    print_status "Creating .npmignore..."
    cat > .npmignore << EOF
# Dependencies
node_modules/

# Development files
tests/
*.test.js
jest.config.js
.eslintrc.js
.prettierrc

# Documentation
TODO.md
TESTING.md
FORMATTING_GUIDE.md
AGENTS.md
EXAMPLES.md

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test
.env.local
.env.production

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
EOF
    print_status "✅ .npmignore created"
fi

print_status "🎉 Deployment preparation complete!"
print_status "The application is ready for production deployment."

# Optional: Publish to npm if this is a release
if [ "$1" = "--publish" ]; then
    print_status "Publishing to npm..."
    if npm publish; then
        print_status "✅ Published to npm successfully"
    else
        print_error "❌ Failed to publish to npm"
        exit 1
    fi
fi

print_status "🚀 Deployment completed successfully!"