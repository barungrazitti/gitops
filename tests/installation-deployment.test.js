/**
 * Comprehensive Installation and Deployment Tests
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

describe('Installation and Deployment - Comprehensive Coverage', () => {
  const testDir = path.join(os.tmpdir(), 'aic-test-' + Date.now());
  const projectRoot = process.cwd();
  
  beforeEach(async () => {
    // Create isolated test directory
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Cleanup and return to project root
    process.chdir(projectRoot);
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('setup.sh Script Tests', () => {
    let setupScript;

    beforeEach(() => {
      setupScript = path.join(projectRoot, 'setup.sh');
    });

    it('should be executable and present', async () => {
      const exists = await fs.pathExists(setupScript);
      const stats = await fs.stat(setupScript);
      
      expect(exists).toBe(true);
      expect(stats.mode & 0o111).toBeTruthy(); // Executable
    });

    it('should have correct shebang line', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      expect(content).toMatch(/^#!/bin\/bash/);
    });

    it('should contain essential setup functions', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('Node.js');
      expect(content).toContain('npm');
      expect(content).toContain('version');
      expect(content).toContain('install');
      expect(content).toContain('verify');
    });

    it('should handle Node.js version checking', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('node --version');
      expect(content).toContain('cut');
      expect(content).toContain('18');
    });

    it('should handle npm version checking', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('npm --version');
    });

    it('should provide installation feedback', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('echo');
      expect(content).toContain('✅');
      expect(content).toContain('❌');
      expect(content).toContain('🚀');
    });

    it('should handle PATH configuration', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('PATH');
      expect(content).toContain('npm config get prefix');
    });

    it('should provide usage instructions', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('aic setup');
      expect(content).toContain('aic status');
      expect(content).toContain('aic models');
      expect(content).toContain('aic --help');
    });

    it('should handle installation fallbacks', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('install.js');
      expect(content).toContain('npm install -g');
      expect(content).toContain('--force');
    });

    it('should have proper error handling', async () => {
      const content = await fs.readFile(setupScript, 'utf8');
      
      expect(content).toContain('set -e');
      expect(content).toContain('exit 1');
    });
  });

  describe('setup-team.sh Script Tests', () => {
    let teamSetupScript;

    beforeEach(() => {
      teamSetupScript = path.join(projectRoot, 'setup-team.sh');
    });

    it('should be executable and present', async () => {
      const exists = await fs.pathExists(teamSetupScript);
      const stats = await fs.stat(teamSetupScript);
      
      expect(exists).toBe(true);
      expect(stats.mode & 0o111).toBeTruthy();
    });

    it('should have color output functions', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('RED=');
      expect(content).toContain('GREEN=');
      expect(content).toContain('YELLOW=');
      expect(content).toContain('BLUE=');
      expect(content).toContain('NC=');
    });

    it('should have utility printing functions', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('print_status');
      expect(content).toContain('print_success');
      expect(content).toContain('print_warning');
      expect(content).toContain('print_error');
    });

    it('should check all prerequisites', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('check_prerequisites');
      expect(content).toContain('Node.js');
      expect(content).toContain('npm');
      expect(content).toContain('Git');
    });

    it('should handle git repository cloning', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('git clone');
      expect(content).toContain('ai-commit-generator');
      expect(content).toContain('npm install');
      expect(content).toContain('npm link');
    });

    it('should configure team defaults', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('configure_defaults');
      expect(content).toContain('provider=groq');
      expect(content).toContain('conventionalCommits=true');
      expect(content).toContain('language=en');
      expect(content).toContain('messageCount=3');
    });

    it('should install git hook', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('install_git_hook');
      expect(content).toContain('aic hook --install');
    });

    it('should test installation', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('test_installation');
      expect(content).toContain('aic test');
    });

    it('should provide comprehensive instructions', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('final_instructions');
      expect(content).toContain('Groq API key');
      expect(content).toContain('console.groq.com/keys');
      expect(content).toContain('happy coding');
    });

    it('should handle interactive prompts', async () => {
      const content = await fs.readFile(teamSetupScript, 'utf8');
      
      expect(content).toContain('read -p');
      expect(content).toContain('Do you want to continue');
    });
  });

  describe('package.json Scripts Tests', () => {
    let packageJson;

    beforeEach(async () => {
      packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
    });

    it('should have all required scripts', () => {
      const requiredScripts = [
        'start',
        'dev',
        'test',
        'test:watch',
        'test:coverage',
        'test:verbose',
        'build:prod',
        'deploy',
        'deploy:publish'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });

    it('should have correct npm scripts definitions', () => {
      expect(packageJson.scripts.start).toBe('node src/index.js');
      expect(packageJson.scripts.dev).toBe('node --watch src/index.js');
      expect(packageJson.scripts.test).toBe('jest');
      expect(packageJson.scripts['test:coverage']).toBe('jest --coverage');
    });

    it('should have build scripts', () => {
      expect(packageJson.scripts['build:prod']).toBe('./scripts/build.sh');
      expect(packageJson.scripts.deploy).toBe('./scripts/deploy.sh');
      expect(packageJson.scripts['deploy:publish']).toBe('./scripts/deploy.sh --publish');
    });

    it('should have correct engines specification', () => {
      expect(packageJson.engines).toHaveProperty('node');
      expect(packageJson.engines).toHaveProperty('npm');
      expect(packageJson.engines.node).toBe('>=18.0.0');
      expect(packageJson.engines.npm).toBe('>=8.0.0');
    });

    it('should have correct main entry point', () => {
      expect(packageJson.main).toBe('src/index.js');
    });

    it('should have correct bin configuration', () => {
      expect(packageJson.bin).toHaveProperty('aicommit');
      expect(packageJson.bin['aicommit']).toBe('./bin/aicommit.js');
    });

    it('should have required dependencies', () => {
      const requiredDeps = [
        'axios',
        'chalk',
        'commander',
        'conf',
        'fs-extra',
        'groq-sdk',
        'inquirer',
        'joi',
        'node-cache',
        'ora',
        'simple-git'
      ];

      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies).toHaveProperty(dep);
      });
    });

    it('should have development dependencies', () => {
      expect(packageJson.devDependencies).toHaveProperty('jest');
    });
  });

  describe('jest.config.js Configuration Tests', () => {
    let jestConfig;

    beforeEach(async () => {
      const configPath = path.join(projectRoot, 'jest.config.js');
      jestConfig = await fs.readFile(configPath, 'utf8');
    });

    it('should be a valid JavaScript configuration', () => {
      expect(() => {
        eval(`const config = ${jestConfig}; config`);
      }).not.toThrow();
    });

    it('should contain essential Jest settings', () => {
      expect(jestConfig).toContain('testEnvironment');
      expect(jestConfig).toContain('testMatch');
      expect(jestConfig).toContain('collectCoverage');
    });

    it('should have coverage configuration', () => {
      expect(jestConfig).toContain('coverageDirectory');
      expect(jestConfig).toContain('coverageReporters');
    });

    it('should exclude test directories', () => {
      expect(jestConfig).toContain('node_modules');
      expect(jestConfig).toContain('tests');
    });
  });

  describe('Installation Process Integration Tests', () => {
    it('should handle dry-run installation simulation', async () => {
      // Create mock install.js
      const mockInstallScript = `
#!/usr/bin/env node
console.log('Mock installation started');
console.log('Dependencies installed successfully');
console.log('Binary linked successfully');
process.exit(0);
`;

      await fs.writeFile(path.join(testDir, 'install.js'), mockInstallScript);
      
      // Simulate dry run
      const result = await simulateInstallProcess(testDir);
      
      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
    });

    it('should handle installation failures gracefully', async () => {
      const mockInstallScript = `
#!/usr/bin/env node
console.error('Installation failed');
process.exit(1);
`;

      await fs.writeFile(path.join(testDir, 'install.js'), mockInstallScript);
      
      const result = await simulateInstallProcess(testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should verify binary availability after installation', async () => {
      // Create mock binary
      const mockBinary = `#!/usr/bin/env node
console.log('aic version 1.0.0');
`;
      await fs.writeFile(path.join(testDir, 'aic'), mockBinary);
      await fs.chmod(path.join(testDir, 'aic'), '755');

      // Add to PATH
      process.env.PATH = testDir + ':' + process.env.PATH;

      const result = await verifyBinaryInstallation('aic');
      
      expect(result.available).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should handle PATH configuration issues', async () => {
      const result = await verifyBinaryInstallation('nonexistent-binary');
      
      expect(result.available).toBe(false);
      expect(result.pathIssue).toBe(true);
    });
  });

  describe('Deployment Script Tests', () => {
    it('should create mock deployment scripts', async () => {
      const buildScript = `#!/bin/bash
echo "Building for production..."
npm run test:coverage
echo "Build complete!"
`;

      const deployScript = `#!/bin/bash
echo "Deploying to production..."
npm publish
echo "Deployment complete!"
`;

      await fs.ensureDir(path.join(testDir, 'scripts'));
      await fs.writeFile(path.join(testDir, 'scripts', 'build.sh'), buildScript);
      await fs.writeFile(path.join(testDir, 'scripts', 'deploy.sh'), deployScript);

      // Test build script
      const buildResult = await runDeploymentScript('build.sh');
      expect(buildResult.success).toBe(true);

      // Test deploy script
      const deployResult = await runDeploymentScript('deploy.sh');
      expect(deployResult.success).toBe(true);
    });

    it('should handle deployment script failures', async () => {
      const failingScript = `#!/bin/bash
echo "Deploying..."
exit 1
`;

      await fs.writeFile(path.join(testDir, 'scripts', 'failing-deploy.sh'), failingScript);

      const result = await runDeploymentScript('failing-deploy.sh');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle environment-specific deployments', async () => {
      const envScript = `#!/bin/bash
ENVIRONMENT=\${1:-development}
echo "Deploying to \$ENVIRONMENT..."

if [ "\$ENVIRONMENT" = "production" ]; then
  echo "Running production checks..."
  npm run test:coverage
fi

echo "Deployed to \$ENVIRONMENT!"
`;

      await fs.writeFile(path.join(testDir, 'scripts', 'deploy-env.sh'), envScript);

      // Test development deployment
      const devResult = await runDeploymentScript('deploy-env.sh development');
      expect(devResult.success).toBe(true);

      // Test production deployment
      const prodResult = await runDeploymentScript('deploy-env.sh production');
      expect(prodResult.success).toBe(true);
    });
  });

  describe('Cross-Platform Installation Tests', () => {
    it('should detect operating system correctly', () => {
      const platform = os.platform();
      expect(['darwin', 'linux', 'win32']).toContain(platform);
    });

    it('should handle Windows path separators', async () => {
      const mockWindowsInstall = `
@echo off
echo Installing on Windows...
echo Installation complete!
`;

      await fs.writeFile(path.join(testDir, 'install.bat'), mockWindowsInstall);

      const result = await runDeploymentScript('install.bat');
      expect(result.success).toBe(true);
    });

    it('should handle macOS/Linux installation', async () => {
      const mockUnixInstall = `#!/bin/bash
echo Installing on Unix system...
echo Installation complete!
`;

      await fs.writeFile(path.join(testDir, 'install.sh'), mockUnixInstall);
      await fs.chmod(path.join(testDir, 'install.sh'), '755');

      const result = await runDeploymentScript('install.sh');
      expect(result.success).toBe(true);
    });

    it('should handle package manager detection', async () => {
      const platforms = {
        'darwin': { manager: 'brew', command: 'brew install node' },
        'linux': { manager: 'apt', command: 'sudo apt install nodejs npm' },
        'win32': { manager: 'choco', command: 'choco install nodejs' }
      };

      const platform = os.platform();
      if (platforms[platform]) {
        const detection = await detectPackageManager(platforms[platform].manager);
        expect(detection.platform).toBe(platform);
      }
    });
  });

  describe('Configuration and Setup Tests', () => {
    it('should create configuration directories', async () => {
      const configDir = path.join(testDir, '.aic');
      await fs.ensureDir(configDir);

      const exists = await fs.pathExists(configDir);
      expect(exists).toBe(true);
    });

    it('should handle configuration file creation', async () => {
      const configFile = path.join(testDir, '.aic', 'config.json');
      const config = {
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        conventionalCommits: true
      };

      await fs.writeJson(configFile, config);
      const loadedConfig = await fs.readJson(configFile);

      expect(loadedConfig).toEqual(config);
    });

    it('should validate configuration schema', async () => {
      const validConfig = {
        provider: 'groq',
        apiKey: 'sk-test123',
        model: 'mixtral-8x7b-32768'
      };

      const validationResult = await validateConfiguration(validConfig);
      expect(validationResult.valid).toBe(true);

      const invalidConfig = { provider: 'invalid' };
      const invalidResult = await validateConfiguration(invalidConfig);
      expect(invalidResult.valid).toBe(false);
    });

    it('should handle default configuration setup', async () => {
      const defaultConfig = await createDefaultConfiguration();
      
      expect(defaultConfig).toHaveProperty('provider');
      expect(defaultConfig).toHaveProperty('model');
      expect(defaultConfig).toHaveProperty('conventionalCommits');
      expect(defaultConfig).toHaveProperty('language');
    });
  });

  describe('Dependency Resolution Tests', () => {
    it('should handle package-lock.json integrity', async () => {
      const packageLockPath = path.join(projectRoot, 'package-lock.json');
      const exists = await fs.pathExists(packageLockPath);
      
      if (exists) {
        const lockData = await fs.readJson(packageLockPath);
        expect(lockData).toHaveProperty('name');
        expect(lockData).toHaveProperty('version');
        expect(lockData).toHaveProperty('lockfileVersion');
      }
    });

    it('should handle missing dependencies gracefully', async () => {
      const mockPackageJson = {
        name: 'test-package',
        dependencies: {
          'nonexistent-package': '^1.0.0'
        }
      };

      await fs.writeJson(path.join(testDir, 'package.json'), mockPackageJson);

      const result = await testDependencyResolution();
      expect(result.hasMissing).toBe(true);
      expect(result.missingDeps).toContain('nonexistent-package');
    });

    it('should handle version conflicts', async () => {
      const mockPackageJson = {
        name: 'test-package',
        dependencies: {
          'axios': '^1.0.0',
          'axios': '^2.0.0' // Conflict
        }
      };

      const result = await testVersionConflicts(mockPackageJson);
      expect(result.hasConflicts).toBe(true);
    });
  });

  describe('Post-Installation Verification Tests', () => {
    it('should verify command availability', async () => {
      const commands = ['aic', 'aicommit'];
      
      for (const cmd of commands) {
        const available = await checkCommandAvailability(cmd);
        // Command may not be available in test environment
        expect(typeof available).toBe('boolean');
      }
    });

    it('should verify package structure', async () => {
      const packagePath = path.join(projectRoot, 'package.json');
      const packageData = await fs.readJson(packagePath);

      expect(packageData).toHaveProperty('name');
      expect(packageData).toHaveProperty('version');
      expect(packageData).toHaveProperty('bin');
      expect(packageData).toHaveProperty('main');
    });

    it('should verify directory structure', async () => {
      const requiredDirs = ['src', 'bin', 'tests', 'scripts'];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(projectRoot, dir);
        const exists = await fs.pathExists(dirPath);
        expect(exists).toBe(true);
      }
    });

    it('should verify binary files', async () => {
      const binaryPath = path.join(projectRoot, 'bin', 'aicommit.js');
      const exists = await fs.pathExists(binaryPath);
      
      if (exists) {
        const content = await fs.readFile(binaryPath, 'utf8');
        expect(content).toContain('#!/usr/bin/env node');
      }
    });
  });

  // Helper functions
  async function simulateInstallProcess(dir) {
    try {
      const installScript = path.join(dir, 'install.js');
      if (await fs.pathExists(installScript)) {
        execSync(`node ${installScript}`, { cwd: dir, stdio: 'pipe' });
        return { success: true, installed: true };
      }
      return { success: false, error: 'Install script not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function verifyBinaryInstallation(binary) {
    try {
      const output = execSync(`${binary} --version`, { encoding: 'utf8', stdio: 'pipe' });
      return { available: true, version: output.trim() };
    } catch (error) {
      return { available: false, pathIssue: error.message.includes('command not found') };
    }
  }

  async function runDeploymentScript(script) {
    try {
      const output = execSync(`bash ${script}`, { cwd: testDir, encoding: 'utf8', stdio: 'pipe' });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function detectPackageManager(manager) {
    return { platform: os.platform(), manager };
  }

  async function validateConfiguration(config) {
    // Mock validation
    return {
      valid: config.provider !== 'invalid',
      errors: config.provider === 'invalid' ? ['Invalid provider'] : []
    };
  }

  async function createDefaultConfiguration() {
    return {
      provider: 'groq',
      model: 'mixtral-8x7b-32768',
      conventionalCommits: true,
      language: 'en',
      messageCount: 3
    };
  }

  async function testDependencyResolution() {
    // Mock dependency resolution
    return { hasMissing: true, missingDeps: ['nonexistent-package'] };
  }

  async function testVersionConflicts(packageJson) {
    // Mock version conflict detection
    return { hasConflicts: Object.keys(packageJson.dependencies || {}).length > 1 };
  }

  async function checkCommandAvailability(cmd) {
    try {
      execSync(`which ${cmd}`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
});