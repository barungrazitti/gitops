#!/usr/bin/env node

/**
 * AI Commit Generator - Self-Installing Script
 * 
 * This script handles installation, updates, and troubleshooting
 * Run with: node install.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class Installer {
  constructor() {
    this.packageName = 'ai-commit-generator';
    this.binNames = ['aic', 'aicommit'];
    this.colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      reset: '\x1b[0m',
      bold: '\x1b[1m'
    };
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  async run() {
    this.log('\n🚀 AI Commit Generator - Installation & Update Tool\n', 'cyan');
    
    try {
      // Check Node.js version
      await this.checkNodeVersion();
      
      // Check if already installed
      const isInstalled = await this.checkInstallation();
      
      if (isInstalled) {
        this.log('✅ AI Commit Generator is already installed', 'green');
        const action = await this.promptAction();
        
        switch (action) {
          case 'update':
            await this.update();
            break;
          case 'reinstall':
            await this.reinstall();
            break;
          case 'uninstall':
            await this.uninstall();
            break;
          case 'test':
            await this.test();
            break;
          case 'fix':
            await this.fixInstallation();
            break;
          default:
            this.log('Installation already complete!', 'green');
        }
      } else {
        this.log('📦 Installing AI Commit Generator...', 'blue');
        await this.install();
      }
      
      // Final verification
      await this.verify();
      
    } catch (error) {
      this.log(`\n❌ Installation failed: ${error.message}`, 'red');
      this.log('\n🔧 Troubleshooting options:', 'yellow');
      this.log('1. Run: node install.js --fix', 'yellow');
      this.log('2. Check Node.js version (requires >= 18)', 'yellow');
      this.log('3. Check npm permissions', 'yellow');
      this.log('4. Try: npm config set prefix ~/.npm-global', 'yellow');
      process.exit(1);
    }
  }

  async checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 18 or higher.`);
    }
    
    this.log(`✅ Node.js version: ${nodeVersion}`, 'green');
  }

  async checkInstallation() {
    try {
      // Check if binaries exist in PATH
      for (const binName of this.binNames) {
        try {
          execSync(`which ${binName}`, { stdio: 'ignore' });
          return true;
        } catch (error) {
          // Continue checking other binaries
        }
      }
      
      // Check if package is installed globally
      try {
        const output = execSync('npm list -g --depth=0', { encoding: 'utf8' });
        return output.includes(this.packageName);
      } catch (error) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async promptAction() {
    // For now, return a default action. In a real implementation, you'd use inquirer
    const args = process.argv.slice(2);
    
    if (args.includes('--update')) return 'update';
    if (args.includes('--reinstall')) return 'reinstall';
    if (args.includes('--uninstall')) return 'uninstall';
    if (args.includes('--test')) return 'test';
    if (args.includes('--fix')) return 'fix';
    
    this.log('\n📋 Available actions:', 'cyan');
    this.log('  --update     Update to latest version', 'blue');
    this.log('  --reinstall  Completely reinstall', 'blue');
    this.log('  --uninstall  Remove installation', 'blue');
    this.log('  --test       Test current installation', 'blue');
    this.log('  --fix        Fix installation issues', 'blue');
    this.log('\nExample: node install.js --update\n', 'yellow');
    
    return 'none';
  }

  async install() {
    this.log('📦 Installing globally...', 'blue');
    
    try {
      // Try standard global install first
      await this.execCommand('npm install -g .');
      this.log('✅ Global installation successful', 'green');
    } catch (error) {
      this.log('⚠️  Standard installation failed, trying alternative methods...', 'yellow');
      await this.alternativeInstall();
    }
  }

  async alternativeInstall() {
    const methods = [
      {
        name: 'Force install',
        command: 'npm install -g . --force'
      },
      {
        name: 'Install with unsafe-perm',
        command: 'npm install -g . --unsafe-perm'
      },
      {
        name: 'Install to user directory',
        command: 'npm config set prefix ~/.npm-global && npm install -g .'
      }
    ];

    for (const method of methods) {
      try {
        this.log(`🔄 Trying: ${method.name}`, 'blue');
        await this.execCommand(method.command);
        this.log(`✅ ${method.name} successful`, 'green');
        return;
      } catch (error) {
        this.log(`❌ ${method.name} failed: ${error.message}`, 'red');
      }
    }

    // If all methods fail, create manual links
    await this.createManualLinks();
  }

  async createManualLinks() {
    this.log('🔧 Creating manual symbolic links...', 'blue');
    
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const binDir = path.join(npmPrefix, 'bin');
      
      // Ensure bin directory exists
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      
      const currentDir = process.cwd();
      
      for (const binName of this.binNames) {
        const sourcePath = path.join(currentDir, 'bin', `${binName}.js`);
        const targetPath = path.join(binDir, binName);
        
        // Remove existing link if it exists
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        
        // Create symbolic link
        fs.symlinkSync(sourcePath, targetPath);
        
        // Make executable
        fs.chmodSync(targetPath, '755');
        
        this.log(`✅ Created link: ${targetPath} -> ${sourcePath}`, 'green');
      }
      
      this.log('✅ Manual links created successfully', 'green');
      
    } catch (error) {
      throw new Error(`Failed to create manual links: ${error.message}`);
    }
  }

  async update() {
    this.log('🔄 Updating AI Commit Generator...', 'blue');
    
    try {
      await this.execCommand('npm install -g . --force');
      this.log('✅ Update successful', 'green');
    } catch (error) {
      this.log('⚠️  Standard update failed, trying reinstall...', 'yellow');
      await this.reinstall();
    }
  }

  async reinstall() {
    this.log('🔄 Reinstalling AI Commit Generator...', 'blue');
    
    try {
      // Uninstall first
      await this.uninstall(false);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Install again
      await this.install();
      
      this.log('✅ Reinstallation successful', 'green');
    } catch (error) {
      throw new Error(`Reinstallation failed: ${error.message}`);
    }
  }

  async uninstall(showSuccess = true) {
    this.log('🗑️  Uninstalling AI Commit Generator...', 'blue');
    
    try {
      // Try npm uninstall
      try {
        await this.execCommand(`npm uninstall -g ${this.packageName}`);
      } catch (error) {
        this.log('⚠️  npm uninstall failed, removing manually...', 'yellow');
      }
      
      // Remove manual links
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const binDir = path.join(npmPrefix, 'bin');
      
      for (const binName of this.binNames) {
        const targetPath = path.join(binDir, binName);
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          this.log(`✅ Removed: ${targetPath}`, 'green');
        }
      }
      
      if (showSuccess) {
        this.log('✅ Uninstallation successful', 'green');
      }
    } catch (error) {
      if (showSuccess) {
        throw new Error(`Uninstallation failed: ${error.message}`);
      }
    }
  }

  async test() {
    this.log('🧪 Testing installation...', 'blue');
    
    const tests = [
      {
        name: 'Check aic command',
        command: 'aic --version'
      },
      {
        name: 'Check aicommit command', 
        command: 'aicommit --version'
      },
      {
        name: 'Test help command',
        command: 'aic --help'
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await this.execCommand(test.command);
        this.log(`✅ ${test.name}`, 'green');
        passed++;
      } catch (error) {
        this.log(`❌ ${test.name}: ${error.message}`, 'red');
        failed++;
      }
    }

    this.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'yellow');
    
    if (failed > 0) {
      this.log('\n🔧 Run: node install.js --fix to attempt repairs', 'yellow');
    }
  }

  async fixInstallation() {
    this.log('🔧 Attempting to fix installation issues...', 'blue');
    
    const fixes = [
      {
        name: 'Clear npm cache',
        command: 'npm cache clean --force'
      },
      {
        name: 'Fix npm permissions',
        command: 'npm config set prefix ~/.npm-global'
      },
      {
        name: 'Reinstall package',
        action: () => this.reinstall()
      },
      {
        name: 'Update PATH',
        action: () => this.updatePath()
      }
    ];

    for (const fix of fixes) {
      try {
        this.log(`🔄 ${fix.name}...`, 'blue');
        
        if (fix.command) {
          await this.execCommand(fix.command);
        } else if (fix.action) {
          await fix.action();
        }
        
        this.log(`✅ ${fix.name} completed`, 'green');
      } catch (error) {
        this.log(`⚠️  ${fix.name} failed: ${error.message}`, 'yellow');
      }
    }

    // Test after fixes
    await this.test();
  }

  async updatePath() {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const binDir = path.join(npmPrefix, 'bin');
    
    this.log(`\n📝 Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):`, 'yellow');
    this.log(`export PATH="${binDir}:$PATH"`, 'cyan');
    this.log(`\nThen run: source ~/.zshrc (or restart your terminal)`, 'yellow');
  }

  async verify() {
    this.log('\n🔍 Final verification...', 'blue');
    
    try {
      const version = execSync('aic --version', { encoding: 'utf8' }).trim();
      this.log(`✅ Installation verified! Version: ${version}`, 'green');
      
      this.log('\n🎉 Ready to use! Try these commands:', 'cyan');
      this.log('  aic setup      # Configure AI provider', 'blue');
      this.log('  aic status     # Check status', 'blue');
      this.log('  aic models     # Show available models', 'blue');
      this.log('  aic --help     # Show all commands', 'blue');
      
    } catch (error) {
      this.log('❌ Verification failed. The aic command is not available.', 'red');
      this.log('\n🔧 Try these troubleshooting steps:', 'yellow');
      this.log('1. Restart your terminal', 'yellow');
      this.log('2. Run: node install.js --fix', 'yellow');
      this.log('3. Check your PATH configuration', 'yellow');
      throw new Error('Installation verification failed');
    }
  }

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], { 
        stdio: ['inherit', 'pipe', 'pipe'] 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });
    });
  }
}

// Run installer
if (require.main === module) {
  const installer = new Installer();
  installer.run().catch(error => {
    console.error('\n❌ Installation failed:', error.message);
    process.exit(1);
  });
}

module.exports = Installer;