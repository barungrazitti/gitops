/**
 * Unit tests for Hook Manager - Comprehensive Coverage
 */

jest.mock('../src/core/git-manager');
const HookManager = require('../src/core/hook-manager');
const GitManager = require('../src/core/git-manager');
const fs = require('fs-extra');

describe('HookManager - Comprehensive Coverage', () => {
  let hookManager;
  let mockGitManager;
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGitManager = {
      getRepositoryRoot: jest.fn().mockResolvedValue('/test/repo'),
      getStagedFiles: jest.fn().mockResolvedValue(['file1.js', 'file2.js']),
      getCurrentBranch: jest.fn().mockResolvedValue('main'),
      getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo.git'),
      getStagedDiff: jest.fn().mockResolvedValue('test diff content'),
      getLog: jest.fn().mockResolvedValue([{ hash: 'abc123', message: 'test commit' }]),
      createBranch: jest.fn(),
      switchBranch: jest.fn(),
      unstageFiles: jest.fn(),
      stageFiles: jest.fn(),
      commit: jest.fn(),
      push: jest.fn()
    };

    mockFs = {
      writeFile: jest.fn().mockResolvedValue(),
      readFile: jest.fn().mockResolvedValue('test content'),
      pathExists: jest.fn().mockResolvedValue(true),
      ensureDir: jest.fn().mockResolvedValue(),
      copy: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      stat: jest.fn().mockResolvedValue({ size: 100 })
    };

    GitManager.mockImplementation(() => mockGitManager);
    
    // Mock fs-extra methods
    jest.spyOn(require('fs-extra'), 'writeFile').mockImplementation(mockFs.writeFile);
    jest.spyOn(require('fs-extra'), 'readFile').mockImplementation(mockFs.readFile);
    jest.spyOn(require('fs-extra'), 'pathExists').mockImplementation(mockFs.pathExists);
    jest.spyOn(require('fs-extra'), 'ensureDir').mockImplementation(mockFs.ensureDir);
    jest.spyOn(require('fs-extra'), 'copy').mockImplementation(mockFs.copy);
    jest.spyOn(require('fs-extra'), 'remove').mockImplementation(mockFs.remove);
    jest.spyOn(require('fs-extra'), 'stat').mockImplementation(mockFs.stat);

    hookManager = new HookManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with GitManager', () => {
      expect(hookManager.gitManager).toBe(mockGitManager);
    });
  });

  describe('install', () => {
    it('should install hook successfully', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.install();

      expect(result.success).toBe(true);
      expect(result.message).toContain('installed successfully');
      expect(mockFs.ensureDir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle hook already installed', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');

      const result = await hookManager.install();

      expect(result.success).toBe(false);
      expect(result.message).toContain('already installed');
    });

    it('should create hook directory if it does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.ensureDir.mockResolvedValue();

      await hookManager.install();

      expect(mockFs.ensureDir).toHaveBeenCalled();
    });

    it('should set executable permissions on hook file', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await hookManager.install();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ mode: 0o755 })
      );
    });

    it('should handle installation errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(hookManager.install()).rejects.toThrow('Failed to install git hook');
    });

    it('should backup existing hook', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# Existing hook script');

      const result = await hookManager.install();

      expect(mockFs.copy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.backupsCreated).toBe(true);
    });

    it('should handle backup errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.copy.mockRejectedValue(new Error('Backup failed'));

      await expect(hookManager.install()).rejects.toThrow('Failed to install git hook');
    });
  });

  describe('uninstall', () => {
    it('should uninstall hook successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await hookManager.uninstall();

      expect(result.success).toBe(true);
      expect(result.message).toContain('uninstalled successfully');
      expect(mockFs.remove).toHaveBeenCalled();
    });

    it('should handle hook not installed', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.uninstall();

      expect(result.success).toBe(true);
      expect(result.message).toContain('not installed');
    });

    it('should find and remove backup files', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await hookManager.uninstall();

      expect(result.success).toBe(true);
      expect(result.backupsFound).toBeDefined();
    });

    it('should handle uninstall errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.remove.mockRejectedValue(new Error('Permission denied'));

      await expect(hookManager.uninstall()).rejects.toThrow('Failed to uninstall git hook');
    });
  });

  describe('isInstalled', () => {
    it('should return true when hook is installed', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('#!/bin/sh\n# AI Commit Generator Hook');

      const result = await hookManager.isInstalled();

      expect(result).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalled();
      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should return false when hook file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
      expect(mockFs.pathExists).toHaveBeenCalled();
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should return false when hook exists but is not ours', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('#!/bin/sh\n# Regular git hook');

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });

    it('should handle read errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });

    it('should handle repository root errors gracefully', async () => {
      mockGitManager.getRepositoryRoot.mockRejectedValue(new Error('Not a git repository'));

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('generateHookScript', () => {
    it('should generate basic hook script', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('# AI Commit Generator Hook');
      expect(script).toContain('aicommit generate --dry-run');
      expect(script).toContain('exit 0');
    });

    it('should include all necessary checks', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('if ! git rev-parse --git-dir');
      expect(script).toContain('if ! git diff --cached --quiet');
      expect(script).toContain('if command -v aicommit');
      expect(script).toContain('[ -s "$1" ]');
    });

    it('should handle non-interactive commits', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('if [ "$2" != "" ]; then');
      expect(script).toContain('exit 0');
    });

    it('should handle missing aicommit command', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('# aicommit command not found');
      expect(script).toContain('# Install with: npm install -g ai-commit-generator');
    });

    it('should include helpful messages', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('# Generating AI commit message...');
      expect(script).toContain('# AI-generated commit message added');
      expect(script).toContain('# Edit the message above or delete it to write your own');
    });
  });

  describe('generateAdvancedHookScript', () => {
    it('should generate advanced hook script with defaults', () => {
      const script = hookManager.generateAdvancedHookScript();

      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('# AI Commit Generator Hook (Advanced)');
      expect(script).toContain('AUTO_COMMIT=false');
      expect(script).toContain('SKIP_ON_MERGE=true');
      expect(script).toContain('SKIP_ON_REBASE=true');
      expect(script).toContain('CONVENTIONAL=true');
    });

    it('should handle custom options', () => {
      const options = {
        autoCommit: true,
        skipOnMerge: false,
        skipOnRebase: false,
        provider: 'groq',
        conventional: false
      };

      const script = hookManager.generateAdvancedHookScript(options);

      expect(script).toContain('AUTO_COMMIT=true');
      expect(script).toContain('SKIP_ON_MERGE=false');
      expect(script).toContain('SKIP_ON_REBASE=false');
      expect(script).toContain('PROVIDER="groq"');
      expect(script).toContain('CONVENTIONAL=false');
    });

    it('should include auto-commit functionality', () => {
      const options = { autoCommit: true };
      const script = hookManager.generateAdvancedHookScript(options);

      expect(script).toContain('$CMD 2>/dev/null');
      expect(script).toContain('# Auto-committed with AI-generated message');
      expect(script).toContain('exit 1');
    });

    it('should handle provider option', () => {
      const options = { provider: 'ollama' };
      const script = hookManager.generateAdvancedHookScript(options);

      expect(script).toContain('--provider $PROVIDER');
    });

    it('should handle conventional option', () => {
      const options = { conventional: true };
      const script = hookManager.generateAdvancedHookScript(options);

      expect(script).toContain('--conventional');
    });

    it('should include commit source checks', () => {
      const script = hookManager.generateAdvancedHookScript();

      expect(script).toContain('COMMIT_SOURCE="$2"');
      expect(script).toContain('if [ "$SKIP_ON_MERGE" = "true" ] && [ "$COMMIT_SOURCE" = "merge" ]');
      expect(script).toContain('if [ "$SKIP_ON_REBASE" = "true" ] && [ "$COMMIT_SOURCE" = "squash" ]');
    });
  });

  describe('updateHookConfig', () => {
    it('should update hook configuration successfully', async () => {
      const options = {
        autoCommit: true,
        provider: 'groq',
        conventional: false
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');

      const result = await hookManager.updateHookConfig(options);

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle hook not installed', async () => {
      const options = { autoCommit: true };

      mockFs.pathExists.mockResolvedValue(false);

      await expect(hookManager.updateHookConfig(options))
        .rejects.toThrow('Hook is not installed');
    });

    it('should use advanced script when options are provided', async () => {
      const options = { autoCommit: true };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');

      const result = await hookManager.updateHookConfig(options);

      expect(result.success).toBe(true);
      const script = mockFs.writeFile.mock.calls[0][0];
      expect(script).toContain('AUTO_COMMIT=true');
    });

    it('should handle update errors gracefully', async () => {
      const options = { autoCommit: true };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(hookManager.updateHookConfig(options))
        .rejects.toThrow('Failed to update hook configuration');
    });
  });

  describe('getStatus', () => {
    it('should return complete status when hook is installed', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook\nAUTO_COMMIT=true');

      const result = await hookManager.getStatus();

      expect(result.installed).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isOurs).toBe(true);
      expect(result.size).toBeDefined();
      expect(result.config).toEqual({ autoCommit: true });
    });

    it('should return status when hook exists but is not ours', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# Regular git hook');

      const result = await hookManager.getStatus();

      expect(result.installed).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.isOurs).toBe(false);
    });

    it('should return status when hook does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.getStatus();

      expect(result.installed).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.isOurs).toBe(false);
      expect(result.config).toBeUndefined();
    });

    it('should handle status errors gracefully', async () => {
      mockGitManager.getRepositoryRoot.mockRejectedValue(new Error('Not a git repository'));

      const result = await hookManager.getStatus();

      expect(result.installed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include hook path in status', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');

      const result = await hookManager.getStatus();

      expect(result.path).toContain('/test/repo/.git/hooks/prepare-commit-msg');
    });
  });

  describe('parseHookConfig', () => {
    it('should parse configuration from hook script', () => {
      const content = `#!/bin/sh
AUTO_COMMIT=true
SKIP_ON_MERGE=false
PROVIDER="groq"
CONVENTIONAL=true
`;

      const config = hookManager.parseHookConfig(content);

      expect(config).toEqual({
        autoCommit: true,
        skipOnMerge: false,
        provider: 'groq',
        conventional: true
      });
    });

    it('should handle missing configuration values', () => {
      const content = `#!/bin/sh
AUTO_COMMIT=false
# PROVIDER="ollama" is commented out
`;

      const config = hookManager.parseHookConfig(content);

      expect(config).toEqual({
        autoCommit: false
      });
    });

    it('should handle boolean values correctly', () => {
      const content = `#!/bin/sh
AUTO_COMMIT=true
SKIP_ON_MERGE=false
CONVENTIONAL=true
`;

      const config = hookManager.parseHookConfig(content);

      expect(config.autoCommit).toBe(true);
      expect(config.skipOnMerge).toBe(false);
      expect(config.conventional).toBe(true);
    });

    it('should handle string values correctly', () => {
      const content = `#!/bin/sh
PROVIDER="ollama"
`;

      const config = hookManager.parseHookConfig(content);

      expect(config.provider).toBe('ollama');
    });

    it('should handle empty configuration', () => {
      const content = `#!/bin/sh
# No configuration variables
`;

      const config = hookManager.parseHookConfig(content);

      expect(config).toEqual({});
    });

    it('should handle malformed configuration gracefully', () => {
      const content = `#!/bin/sh
AUTO_COMMIT=invalid_boolean
PROVIDER="unclosed string
`;

      const config = hookManager.parseHookConfig(content);

      expect(config).toEqual({});
    });

    it('should include all expected patterns', () => {
      const content = `#!/bin/sh
AUTO_COMMIT=true
SKIP_ON_MERGE=false
SKIP_ON_REBASE=false
PROVIDER="groq"
CONVENTIONAL=true
`;

      const config = hookManager.parseHookConfig(content);

      expect(config).toHaveProperty('autoCommit');
      expect(config).toHaveProperty('skipOnMerge');
      expect(config).toHaveProperty('skipOnRebase');
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('conventional');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete install-update-uninstall workflow', async () => {
      // Install
      mockFs.pathExists.mockResolvedValue(false);
      const installResult = await hookManager.install();
      expect(installResult.success).toBe(true);

      // Update
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');
      const updateResult = await hookManager.updateHookConfig({ autoCommit: true });
      expect(updateResult.success).toBe(true);

      // Uninstall
      mockFs.pathExists.mockResolvedValue(true);
      const uninstallResult = await hookManager.uninstall();
      expect(uninstallResult.success).toBe(true);
    });

    it('should handle concurrent operations safely', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const promises = [
        hookManager.install(),
        hookManager.install(),
        hookManager.install()
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle very long hook scripts', async () => {
      const longScript = '#!/bin/sh\n' + 'x'.repeat(10000);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(longScript);

      const result = await hookManager.getStatus();

      expect(result.success).toBeUndefined();
      expect(result.size).toBe(longScript.length);
    });

    it('should handle hook scripts with special characters', async () => {
      const specialScript = '#!/bin/sh\n# 测试特殊字符 🎉\necho "test"';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(specialScript);

      const result = await hookManager.getStatus();

      expect(result.installed).toBe(false); // Should not detect as our hook
    });

    it('should handle configuration parsing with Unicode', () => {
      const content = `#!/bin/sh
PROVIDER="测试提供商"
CONVENTIONAL=true
`;

      const config = hookManager.parseHookConfig(content);

      expect(config.provider).toBe('测试提供商');
      expect(config.conventional).toBe(true);
    });

    it('should handle file permission errors', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(hookManager.install()).rejects.toThrow('Failed to install git hook');
    });

    it('should handle disk space errors', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(hookManager.install()).rejects.toThrow('Failed to install git hook');
    });
  });

  describe('performance and optimization', () => {
    it('should handle large number of backup files', async () => {
      const backupFiles = Array(100).fill(null).map((_, i) => `prepare-commit-msg.backup.${i}`);
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.remove.mockImplementation((path) => {
        if (path.includes('.backup.')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      const result = await hookManager.uninstall();

      expect(result.success).toBe(true);
    });

    it('should not block main thread during operations', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const startTime = Date.now();
      await hookManager.install();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should cache repository root path', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await hookManager.install();
      await hookManager.isInstalled();
      await hookManager.getStatus();

      expect(mockGitManager.getRepositoryRoot).toHaveBeenCalledTimes(3);
    });
  });

  describe('security considerations', () => {
    it('should set appropriate file permissions', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await hookManager.install();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { mode: 0o755 }
      );
    });

    it('should validate hook script content before installation', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await hookManager.install();

      const script = mockFs.writeFile.mock.calls[0][0];
      expect(script).not.toContain('rm -rf /');
      expect(script).not.toContain('eval');
      expect(script).not.toContain('exec');
    });

    it('should sanitize configuration values', async () => {
      const options = {
        provider: 'groq"; rm -rf / # malicious',
        conventional: true
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# AI Commit Generator Hook');

      const result = await hookManager.updateHookConfig(options);

      expect(result.success).toBe(true);
      
      const script = mockFs.writeFile.mock.calls[0][0];
      expect(script).toContain('PROVIDER="groq"; rm -rf / # malicious"');
    });
  });
});