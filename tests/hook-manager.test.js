/**
 * Unit tests for Hook Manager
 */

jest.mock('fs-extra');
jest.mock('../src/core/git-manager');

const HookManager = require('../src/core/hook-manager');
const GitManager = require('../src/core/git-manager');
const fs = require('fs-extra');

describe('HookManager', () => {
  let hookManager;
  let mockGitManager;
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGitManager = {
      getRepositoryRoot: jest.fn().mockResolvedValue('/test/repo')
    };
    
    mockFs = {
      ensureDir: jest.fn(),
      pathExists: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      copy: jest.fn(),
      remove: jest.fn(),
      readDir: jest.fn()
    };
    
    GitManager.mockImplementation(() => mockGitManager);
    fs.ensureDir = mockFs.ensureDir;
    fs.pathExists = mockFs.pathExists;
    fs.readFile = mockFs.readFile;
    fs.writeFile = mockFs.writeFile;
    fs.copy = mockFs.copy;
    fs.remove = mockFs.remove;
    fs.readdir = mockFs.readDir;

    hookManager = new HookManager();
  });

  describe('constructor', () => {
    it('should initialize with GitManager', () => {
      expect(hookManager.gitManager).toBeInstanceOf(GitManager);
    });
  });

  describe('install', () => {
    const hookPath = '/test/repo/.git/hooks/prepare-commit-msg';
    const hooksDir = '/test/repo/.git/hooks';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should install hook successfully when none exists', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.install();

      expect(mockFs.ensureDir).toHaveBeenCalledWith(hooksDir);
      expect(mockFs.pathExists).toHaveBeenCalledWith(hookPath);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        hookPath,
        expect.stringContaining('ai-commit-generator'),
        { mode: 0o755 }
      );
      expect(result).toEqual({
        success: true,
        message: 'Git hook installed successfully',
        path: hookPath
      });
    });

    it('should throw error if hook already installed', async () => {
      const existingContent = 'existing script with ai-commit-generator reference';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(existingContent);

      await expect(hookManager.install())
        .rejects.toThrow('AI commit generator hook is already installed');
    });

    it('should backup existing hook before installing', async () => {
      const existingContent = '#!/bin/sh\nexisting hook script';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(existingContent);

      const result = await hookManager.install();

      expect(mockFs.copy).toHaveBeenCalledWith(
        hookPath,
        expect.stringMatching(/prepare-commit-msg\.backup\.\d+/)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        hookPath,
        expect.stringContaining('ai-commit-generator'),
        { mode: 0o755 }
      );
      expect(result.success).toBe(true);
    });

    it('should handle errors during installation', async () => {
      mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      const result = await hookManager.install();

      expect(result).toEqual({
        success: false,
        message: 'Permission denied',
        error: expect.any(Error)
      });
    });

    it('should handle git repository root errors', async () => {
      mockGitManager.getRepositoryRoot.mockRejectedValue(new Error('Not a git repository'));

      const result = await hookManager.install();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Not a git repository');
    });
  });

  describe('uninstall', () => {
    const hookPath = '/test/repo/.git/hooks/prepare-commit-msg';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should uninstall hook successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await hookManager.uninstall();

      expect(mockFs.remove).toHaveBeenCalledWith(hookPath);
      expect(result).toEqual({
        success: true,
        message: 'Git hook uninstalled successfully'
      });
    });

    it('should handle when hook does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.uninstall();

      expect(result).toEqual({
        success: true,
        message: 'Git hook was not installed'
      });
    });

    it('should restore backup if exists', async () => {
      const backupPath = '/test/repo/.git/hooks/prepare-commit-msg.backup.1234567890';
      mockFs.pathExists
        .mockResolvedValueOnce(true) // hook exists
        .mockResolvedValueOnce(true) // backup exists
        .mockResolvedValueOnce(false); // no other backups
      mockFs.readDir.mockResolvedValue(['prepare-commit-msg.backup.1234567890']);

      const result = await hookManager.uninstall();

      expect(mockFs.copy).toHaveBeenCalledWith(backupPath, hookPath);
      expect(mockFs.remove).toHaveBeenCalledWith(backupPath);
      expect(result.message).toContain('Restored backup');
    });

    it('should handle errors during uninstall', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.remove.mockRejectedValue(new Error('Permission denied'));

      const result = await hookManager.uninstall();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });

  describe('isInstalled', () => {
    const hookPath = '/test/repo/.git/hooks/prepare-commit-msg';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should return true if hook is installed', async () => {
      const hookContent = '#!/bin/sh\nai-commit-generator hook script';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(hookContent);

      const result = await hookManager.isInstalled();

      expect(result).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalledWith(hookPath);
      expect(mockFs.readFile).toHaveBeenCalledWith(hookPath, 'utf8');
    });

    it('should return false if hook is not installed', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });

    it('should return false if hook exists but not ours', async () => {
      const hookContent = '#!/bin/sh\nsome other hook script';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(hookContent);

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Read error'));

      const result = await hookManager.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('generateHookScript', () => {
    it('should generate proper hook script', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('ai-commit-generator');
      expect(script).toContain('prepare-commit-msg');
      expect(script).toContain('aic generate --message-file');
    });

    it('should include error handling', () => {
      const script = hookManager.generateHookScript();

      expect(script).toContain('|| exit 0');
      expect(script).toContain('2>/dev/null');
    });
  });

  describe('listBackups', () => {
    const hooksDir = '/test/repo/.git/hooks';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should list available backup files', async () => {
      mockFs.readDir.mockResolvedValue([
        'prepare-commit-msg.backup.1234567890',
        'prepare-commit-msg.backup.1234567891',
        'other-file.txt'
      ]);

      const backups = await hookManager.listBackups();

      expect(backups).toEqual([
        'prepare-commit-msg.backup.1234567890',
        'prepare-commit-msg.backup.1234567891'
      ]);
      expect(mockFs.readDir).toHaveBeenCalledWith(hooksDir);
    });

    it('should return empty array when no backups exist', async () => {
      mockFs.readDir.mockResolvedValue(['other-file.txt']);

      const backups = await hookManager.listBackups();

      expect(backups).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockFs.readDir.mockRejectedValue(new Error('Directory read error'));

      const backups = await hookManager.listBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('cleanupOldBackups', () => {
    const hooksDir = '/test/repo/.git/hooks';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should keep only recent backups', async () => {
      const oldTimestamp = Date.now() - (32 * 24 * 60 * 60 * 1000); // 32 days ago
      const recentTimestamp = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      mockFs.readDir.mockResolvedValue([
        `prepare-commit-msg.backup.${oldTimestamp}`,
        `prepare-commit-msg.backup.${recentTimestamp}`
      ]);
      mockFs.pathExists.mockResolvedValue(true);

      await hookManager.cleanupOldBackups();

      expect(mockFs.remove).toHaveBeenCalledWith(
        expect.stringContaining(oldTimestamp.toString())
      );
      expect(mockFs.remove).not.toHaveBeenCalledWith(
        expect.stringContaining(recentTimestamp.toString())
      );
    });

    it('should handle errors during cleanup', async () => {
      mockFs.readDir.mockResolvedValue(['prepare-commit-msg.backup.1234567890']);
      mockFs.remove.mockRejectedValue(new Error('Delete failed'));

      // Should not throw error
      await expect(hookManager.cleanupOldBackups()).resolves.toBeUndefined();
    });
  });

  describe('validateHook', () => {
    const hookPath = '/test/repo/.git/hooks/prepare-commit-msg';

    beforeEach(() => {
      mockGitManager.getRepositoryRoot.mockResolvedValue('/test/repo');
    });

    it('should validate properly formatted hook', async () => {
      const validHook = '#!/bin/sh\nai-commit-generator hook';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(validHook);

      const result = await hookManager.validateHook();

      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should detect invalid hook format', async () => {
      const invalidHook = 'not a proper hook script';
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(invalidHook);

      const result = await hookManager.validateHook();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('invalid');
    });

    it('should handle non-existent hook', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.validateHook();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('does not exist');
    });
  });

  describe('edge cases', () => {
    it('should handle very long hook paths', async () => {
      const longRepoPath = '/very/long/repository/path/that/exceeds/normal/limits/and/continues/for/quite/some/time';
      mockGitManager.getRepositoryRoot.mockResolvedValue(longRepoPath);
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.install();

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(longRepoPath),
        expect.any(String),
        { mode: 0o755 }
      );
    });

    it('should handle special characters in paths', async () => {
      const specialPath = '/test/repo with spaces & symbols';
      mockGitManager.getRepositoryRoot.mockResolvedValue(specialPath);
      mockFs.pathExists.mockResolvedValue(false);

      const result = await hookManager.install();

      expect(result.success).toBe(true);
    });

    it('should handle permission errors gracefully', async () => {
      mockGitManager.getRepositoryRoot.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await hookManager.install();

      expect(result.success).toBe(false);
      expect(result.message).toContain('permission denied');
    });
  });
});