#!/bin/bash

# AI Commit Generator Installation Script
# This script installs the AI Commit Generator tool

set -e

echo "🤖 AI Commit Generator Installation"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to v18 or higher."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git."
    echo "   Download from: https://git-scm.com/"
    exit 1
fi

echo "✅ Git $(git --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Test installation with npx
echo "🧪 Testing installation..."
if npx aic --version &> /dev/null; then
    echo "✅ Installation successful! You can use 'npx aic' immediately."
else
    echo "❌ Installation failed."
    exit 1
fi

# Ask about installation method
echo ""
echo "🌍 Installation Options:"
echo "1) Create local symlink (recommended - no sudo needed)"
echo "2) Install globally (may require sudo/admin rights)"
echo "3) Use with npx (fallback option)"

read -p "Choose option [1-3] (default: 1): " choice
choice=${choice:-1}

case $choice in
    1)
        echo "🔗 Creating local symlink..."
        mkdir -p ~/.local/bin
        ln -sf "$(pwd)/bin/aicommit.js" ~/.local/bin/aic
        
        # Add to PATH if not already there
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc 2>/dev/null
            echo "✅ Added ~/.local/bin to PATH in your shell config."
            echo "   Please restart your terminal or run 'source ~/.zshrc' (or ~/.bashrc)"
        fi
        
        echo "✅ Local symlink created!"
        echo "🚀 Quick start:"
        echo "   aic setup"
        echo "   aic"
        ;;
    2)
        echo "🔧 Installing globally..."
        if npm install -g . &> /dev/null; then
            echo "✅ Global installation successful!"
            echo "🚀 Quick start:"
            echo "   aic setup"
            echo "   aic"
        else
            echo "⚠️  Global installation failed. Trying with sudo..."
            if sudo npm install -g . &> /dev/null; then
                echo "✅ Global installation successful with sudo!"
                echo "🚀 Quick start:"
                echo "   aic setup"
                echo "   aic"
            else
                echo "❌ Global installation failed. Falling back to local symlink..."
                mkdir -p ~/.local/bin
                ln -sf "$(pwd)/bin/aicommit.js" ~/.local/bin/aic
                if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc 2>/dev/null
                    echo "✅ Added ~/.local/bin to PATH in your shell config."
                fi
                echo "✅ Local symlink created as fallback!"
                echo "🚀 Quick start:"
                echo "   aic setup"
                echo "   aic"
            fi
        fi
        ;;
    3)
        echo "✅ Using npx - no additional setup needed!"
        echo ""
        echo "🚀 Quick start:"
        echo "   npx aic setup"
        echo "   npx aic"
        ;;
    *)
        echo "❌ Invalid choice. Using local symlink option."
        mkdir -p ~/.local/bin
        ln -sf "$(pwd)/bin/aicommit.js" ~/.local/bin/aic
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc 2>/dev/null
            echo "✅ Added ~/.local/bin to PATH in your shell config."
        fi
        echo "✅ Local symlink created!"
        echo "🚀 Quick start:"
        echo "   aic setup"
        echo "   aic"
        ;;
esac

echo ""
echo "📚 Documentation: https://github.com/barungrazitti/gitops"
echo "🎉 Installation complete!"