#!/bin/bash

# 🚀 AI Commit Generator - Team Setup Script
# For macOS and Linux systems

set -e

echo "🤖 AI Commit Generator - Team Setup"
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        echo "Please install Node.js 16+ from https://nodejs.org"
        echo "Or use your system package manager:"
        echo "  macOS: brew install node"
        echo "  Ubuntu/Debian: sudo apt install nodejs npm"
        echo "  CentOS/RHEL: sudo dnf install nodejs npm"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version) found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version) found"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        echo "Please install Git from https://git-scm.com"
        exit 1
    fi
    print_success "Git $(git --version) found"
    
    echo ""
}

# Install AI Commit Generator
install_tool() {
    print_status "Installing AI Commit Generator from source..."
    
    # Remove existing directory if present
    if [ -d "ai-commit-generator" ]; then
        print_status "Removing existing ai-commit-generator directory..."
        rm -rf ai-commit-generator
    fi
    
    print_status "Cloning repository..."
    if git clone https://github.com/baruntayenjam/ai-commit-generator.git; then
        cd ai-commit-generator
        
        print_status "Installing dependencies..."
        if npm install; then
            print_status "Linking globally..."
            if npm link; then
                cd ..
                print_success "AI Commit Generator installed successfully from source"
            else
                cd ..
                print_error "Failed to link AI Commit Generator"
                exit 1
            fi
        else
            cd ..
            print_error "Failed to install dependencies"
            exit 1
        fi
    else
        print_error "Failed to clone repository"
        exit 1
    fi
    
    echo ""
}

# Verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    if command -v aic &> /dev/null; then
        print_success "AI Commit Generator is available in PATH"
        aic --version
    else
        print_error "AI Commit Generator not found in PATH"
        echo "You may need to restart your terminal or add npm global path to PATH"
        echo "npm global path: $(npm config get prefix)/bin"
        exit 1
    fi
    
    echo ""
}

# Configure default settings
configure_defaults() {
    print_status "Applying team-standard configuration..."
    
    # Set provider to Groq (fast and affordable)
    aic config --set provider=groq
    
    # Enable conventional commits
    aic config --set conventionalCommits=true
    
    # Set language to English
    aic config --set language=en
    
    # Set message count
    aic config --set messageCount=3
    
    # Enable caching
    aic config --set cache=true
    
    # Set reasonable token limits
    aic config --set maxTokens=150
    aic config --set temperature=0.7
    
    # Exclude common files from analysis
    aic config --set excludeFiles="*.log,dist/**,node_modules/**,*.min.js,*.min.css,coverage/**"
    
    print_success "Default configuration applied"
    echo ""
}

# Install git hook
install_git_hook() {
    print_status "Installing git hook for automatic commit messages..."
    
    if aic hook --install; then
        print_success "Git hook installed successfully"
        print_warning "The hook will be installed in each repository you run 'aic hook --install' in"
    else
        print_warning "Failed to install git hook (this is optional)"
    fi
    
    echo ""
}

# Test installation
test_installation() {
    print_status "Testing AI connection (will fail without API key)..."
    
    # This will likely fail without API key, but that's expected
    if aic test 2>/dev/null; then
        print_success "AI connection test passed"
    else
        print_warning "AI connection test failed (expected without API key)"
        print_status "You'll need to configure your API key next"
    fi
    
    echo ""
}

# Final instructions
final_instructions() {
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Get your Groq API key from: https://console.groq.com/keys"
    echo "2. Set your API key:"
    echo "   aic config --set apiKey=your_groq_api_key_here"
    echo "3. Test the setup:"
    echo "   aic test"
    echo "4. Start using in any git repository:"
    echo "   aic"
    echo ""
    echo "🔧 Useful commands:"
    echo "  aic --help          Show all commands"
    echo "  aic config --list   Show current configuration"
    echo "  aic stats           Show usage statistics"
    echo "  aic hook --install  Install git hook in current repo"
    echo ""
    echo "📚 For more help:"
    echo "  - Installation guide: INSTALLATION.md"
    echo "  - Deployment guide: DEPLOYMENT.md"
    echo "  - Usage examples: EXAMPLES.md"
    echo ""
    echo "🚀 Happy coding with AI-powered commits!"
}

# Main execution
main() {
    echo "This script will install AI Commit Generator with team-standard settings."
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    check_prerequisites
    install_tool
    verify_installation
    configure_defaults
    install_git_hook
    test_installation
    final_instructions
}

# Run main function
main "$@"