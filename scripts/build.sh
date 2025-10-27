#!/bin/bash

# AI Commit Generator Build Script
# This script builds the application for production

set -e

echo "🔨 Building AI Commit Generator..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Clean any previous build artifacts
print_status "Cleaning previous build artifacts..."
rm -rf dist/ build/ coverage/

# Install dependencies
print_status "Installing dependencies..."
npm ci --silent

# Run linting
print_status "Running linter..."
npm run lint

# Run tests
print_status "Running tests..."
npm test

# Generate coverage report
print_status "Generating coverage report..."
npm run test:coverage

# Validate package.json
print_status "Validating package.json..."
node -e "
const pkg = require('./package.json');
const required = ['name', 'version', 'description', 'main', 'bin'];
required.forEach(field => {
    if (!pkg[field]) {
        console.error('Missing required field:', field);
        process.exit(1);
    }
});
console.log('✅ package.json validation passed');
"

# Check binary files
print_status "Checking binary files..."
if [ -f "./bin/aicommit.js" ]; then
    chmod +x ./bin/aicommit.js
    print_status "✅ Binary files ready"
else
    print_error "❌ Binary file not found"
    exit 1
fi

# Create build info
print_status "Creating build information..."
cat > build-info.json << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "$(node -p "require('./package.json').version")",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "gitCommit": "$(git rev-parse HEAD)",
  "gitBranch": "$(git rev-parse --abbrev-ref HEAD)"
}
EOF

print_status "✅ Build completed successfully!"
print_status "Build information saved to build-info.json"