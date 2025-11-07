@echo off
REM 🚀 AI Commit Generator - Team Setup Script
REM For Windows systems

setlocal enabledelayedexpansion

echo 🤖 AI Commit Generator - Team Setup
echo ==================================
echo.

REM Check prerequisites
echo ℹ️  Checking prerequisites...

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js 16+ from https://nodejs.org
    echo Or use Chocolatey: choco install node
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%i in ('node --version ^| findstr /r "v[0-9]*"') do (
    set node_version=%%i
    set node_version=!node_version:v=!
)

if !node_version! lss 16 (
    echo ❌ Node.js version 16+ is required. Current version: 
    node --version
    pause
    exit /b 1
)

echo ✅ Node.js found:
node --version

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)

echo ✅ npm found:
npm --version

REM Check Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed
    echo Please install Git from https://git-scm.com
    pause
    exit /b 1
)

echo ✅ Git found:
git --version
echo.

REM Install AI Commit Generator
echo ℹ️  Installing AI Commit Generator from source...

REM Remove existing directory if present
if exist ai-commit-generator (
    echo ℹ️  Removing existing ai-commit-generator directory...
    rmdir /s /q ai-commit-generator
)

REM Clone repository
echo ℹ️  Cloning repository...
git clone https://github.com/baruntayenjam/ai-commit-generator.git
if %errorlevel% neq 0 (
    echo ❌ Failed to clone repository
    pause
    exit /b 1
)

cd ai-commit-generator

REM Install dependencies
echo ℹ️  Installing dependencies...
npm install
if %errorlevel% neq 0 (
    cd ..
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Link globally
echo ℹ️  Linking globally...
npm link
if %errorlevel% neq 0 (
    cd ..
    echo ❌ Failed to link AI Commit Generator
    pause
    exit /b 1
)

cd ..
echo ✅ AI Commit Generator installed successfully from source

echo.

REM Verify installation
echo ℹ️  Verifying installation...

aic --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AI Commit Generator not found in PATH
    echo You may need to restart your terminal or add npm global path to PATH
    echo npm global path: 
    npm config get prefix
    pause
    exit /b 1
)

echo ✅ AI Commit Generator is available in PATH
aic --version
echo.

REM Configure default settings
echo ℹ️  Applying team-standard configuration...

aic config --set provider=groq
aic config --set conventionalCommits=true
aic config --set language=en
aic config --set messageCount=3
aic config --set cache=true
aic config --set maxTokens=150
aic config --set temperature=0.7
aic config --set excludeFiles="*.log,dist/**,node_modules/**,*.min.js,*.min.css,coverage/**"

echo ✅ Default configuration applied
echo.

REM Install git hook
echo ℹ️  Installing git hook for automatic commit messages...

aic hook --install >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Git hook installed successfully
    echo ⚠️  The hook will be installed in each repository you run 'aic hook --install' in
) else (
    echo ⚠️  Failed to install git hook ^(this is optional^)
)

echo.

REM Test installation
echo ℹ️  Testing AI connection ^(will fail without API key^)...

aic test >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ AI connection test passed
) else (
    echo ⚠️  AI connection test failed ^(expected without API key^)
    echo ℹ️  You'll need to configure your API key next
)

echo.

REM Final instructions
echo 🎉 Installation completed successfully!
echo.
echo 📝 Next steps:
echo 1. Get your Groq API key from: https://console.groq.com/keys
echo 2. Set your API key:
echo    aic config --set apiKey=your_groq_api_key_here
echo 3. Test the setup:
echo    aic test
echo 4. Start using in any git repository:
echo    aic
echo.
echo 🔧 Useful commands:
echo   aic --help          Show all commands
echo   aic config --list   Show current configuration
echo   aic stats           Show usage statistics
echo   aic hook --install  Install git hook in current repo
echo.
echo 📚 For more help:
echo   - Installation guide: INSTALLATION.md
echo   - Deployment guide: DEPLOYMENT.md
echo   - Usage examples: EXAMPLES.md
echo.
echo 🚀 Happy coding with AI-powered commits!
echo.
pause