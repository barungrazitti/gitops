/**
 * Unit tests for HookManager
 */

describe('HookManager', () => {
  let HookManager;
  let hookManager;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    jest.mock('fs-extra', () => ({
      ensureDir: jest.fn().mockResolvedValue(),
      pathExists: jest.fn().mockResolvedValue(false),
      readFile: jest.fn().mockResolvedValue(''),
      writeFile: jest.fn().mockResolvedValue(),
      copy: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      readdir: jest.fn().mockResolvedValue([]),
    }));
    
    jest.mock('./git-manager', () => {
      return jest.fn().mockImplementation(() => ({
        getRepositoryRoot: jest.fn().mockResolvedValue('/test/repo'),
      }));
    });
    
    HookManager = require('../src/core/hook-manager');
    hookManager = new HookManager();
  });

  describe('constructor', () => {
    it('should initialize with git manager', () => {
      expect(hookManager.gitManager).toBeDefined();
    });
  });

  describe('install', () => {
    it('should install hook successfully', async () => {
      const result = await hookManager.install();
      expect(result.success).toBe(true);
    });

    it('should throw if hook already installed', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('#!/bin/bash\naic commit');
      
      await expect(hookManager.install()).rejects.toThrow('already installed');
    });
  });

  describe('uninstall', () => {
    it('should throw if hook not installed', async () => {
      await expect(hookManager.uninstall()).rejects.toThrow('not installed');
    });

    it('should throw if not our hook', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('#!/bin/bash\necho "other"');
      
      await expect(hookManager.uninstall()).rejects.toThrow();
    });

    it('should uninstall successfully', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('#!/bin/bash\naic commit');
      
      const result = await hookManager.uninstall();
      expect(result.success).toBe(true);
    });
  });

  describe('generateHookScript', () => {
    it('should generate valid shell script', () => {
      const script = hookManager.generateHookScript();
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('aic');
    });
  });

  describe('checkHookInstalled', () => {
    it('should return true when hook is installed', async () => {
      const fs = require('fs-extra');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('#!/bin/bash\naic commit');
      
      const result = await hookManager.checkHookInstalled();
      expect(result).toBe(true);
    });

    it('should return false when not installed', async () => {
      const result = await hookManager.checkHookInstalled();
      expect(result).toBe(false);
    });
  });

  describe('getHookPath', () => {
    it('should return correct path', async () => {
      const path = await hookManager.getHookPath();
      expect(path).toContain('.git/hooks/prepare-commit-msg');
    });
  });
});
