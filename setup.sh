#!/bin/bash

# AI Commit Generator - Quick Setup Script
# This script handles installation and setup automatically

set -e

echo "🚀 AI Commit Generator - Quick Setup"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please upgrade to Node.js 18+."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install the package
echo ""
echo "📦 Installing AI Commit Generator..."

# Try different installation methods
if node install.js; then
    echo "✅ Installation successful!"
else
    echo "⚠️  Standard installation failed, trying alternative method..."
    if npm install -g . --force; then
        echo "✅ Force installation successful!"
    else
        echo "❌ Installation failed. Please run: node install.js --fix"
        exit 1
    fi
fi

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if command -v aic &> /dev/null; then
    echo "✅ aic command is available"
    AIC_VERSION=$(aic --version)
    echo "✅ Version: $AIC_VERSION"
else
    echo "⚠️  aic command not found in PATH"
    echo "🔧 Trying to fix PATH issues..."
    
    # Get npm prefix
    NPM_PREFIX=$(npm config get prefix)
    BIN_DIR="$NPM_PREFIX/bin"
    
    echo "📝 Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo "   export PATH=\"$BIN_DIR:\$PATH\""
    echo ""
    echo "Then run: source ~/.zshrc (or restart your terminal)"
    echo ""
    echo "Or run the installer with fix option: node install.js --fix"
fi

echo ""
echo "🎉 Setup complete! Try these commands:"
echo "   aic setup      # Configure AI provider"
echo "   aic status     # Check status"
echo "   aic models     # Show available models"
echo "   aic --help     # Show all commands"
echo ""
echo "📚 For updates, run: node install.js --update"