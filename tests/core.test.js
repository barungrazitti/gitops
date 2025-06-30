/**
 * Core Module Tests
 * 
 * Tests for the core functionality of the AI commit generator.
 */

const AICommitGenerator = require('../src/index.js');
const GitManager = require('../src/core/git-manager.js');
const ConfigManager = require('../src/core/config-manager.js');
const CacheManager = require('../src/core/cache-manager.js');
const AnalysisEngine = require('../src/core/analysis-engine.js');
const MessageFormatter = require('../src/core/message-formatter.js');
const StatsManager = require('../src/core/stats-manager.js');
const HookManager = require('../src/core/hook-manager.js');

describe('Core Module Tests', () => {
  
  describe('AICommitGenerator', () => {
    let generator;
    
    beforeEach(() => {
      generator = new AICommitGenerator();
    });
    
    test('should instantiate correctly', () => {
      expect(generator).toBeInstanceOf(AICommitGenerator);
      expect(generator.gitManager).toBeInstanceOf(GitManager);
      expect(generator.configManager).toBeInstanceOf(ConfigManager);
      expect(generator.cacheManager).toBeInstanceOf(CacheManager);
      expect(generator.analysisEngine).toBeInstanceOf(AnalysisEngine);
      expect(generator.messageFormatter).toBeInstanceOf(MessageFormatter);
      expect(generator.statsManager).toBeInstanceOf(StatsManager);
      expect(generator.hookManager).toBeInstanceOf(HookManager);
    });
    
    test('should have all required methods', () => {
      expect(typeof generator.generate).toBe('function');
      expect(typeof generator.config).toBe('function');
      expect(typeof generator.setup).toBe('function');
      expect(typeof generator.hook).toBe('function');
      expect(typeof generator.stats).toBe('function');
    });
  });
  
  describe('GitManager', () => {
    let gitManager;
    
    beforeEach(() => {
      gitManager = new GitManager();
    });
    
    test('should instantiate correctly', () => {
      expect(gitManager).toBeInstanceOf(GitManager);
    });
    
    test('should have required methods', () => {
      expect(typeof gitManager.validateRepository).toBe('function');
      expect(typeof gitManager.getStagedDiff).toBe('function');
      expect(typeof gitManager.getCommitHistory).toBe('function');
      expect(typeof gitManager.getCurrentBranch).toBe('function');
    });
  });
  
  describe('ConfigManager', () => {
    let configManager;
    
    beforeEach(() => {
      configManager = new ConfigManager();
    });
    
    test('should instantiate correctly', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });
    
    test('should load default configuration', async () => {
      const config = await configManager.load();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
    
    test('should have validation schema', () => {
      const schema = configManager.getValidationSchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });
    
    test('should get configuration schema', () => {
      const schema = configManager.getValidationSchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });
  });
  
  describe('CacheManager', () => {
    let cacheManager;
    
    beforeEach(() => {
      cacheManager = new CacheManager();
    });
    
    test('should instantiate correctly', () => {
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });
    
    test('should generate cache keys', () => {
      const data = 'test data';
      const key = cacheManager.generateKey(data);
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
    
    test('should store and retrieve cache values', async () => {
      const testDiff = 'diff --git a/test.js b/test.js\n+console.log("test");';
      const testMessages = ['test commit message'];
      
      await cacheManager.set(testDiff, testMessages);
      const retrieved = await cacheManager.get(testDiff);
      
      expect(retrieved).toEqual(testMessages);
    });
    
    test('should handle cache cleanup', async () => {
      // Test cache cleanup functionality
      const cleanedCount = await cacheManager.cleanup();
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('AnalysisEngine', () => {
    let analysisEngine;
    
    beforeEach(() => {
      analysisEngine = new AnalysisEngine();
    });
    
    test('should instantiate correctly', () => {
      expect(analysisEngine).toBeInstanceOf(AnalysisEngine);
    });
    
    test('should analyze repository', async () => {
      const analysis = await analysisEngine.analyzeRepository();
      
      expect(analysis).toBeDefined();
      expect(typeof analysis).toBe('object');
      expect(analysis.timestamp).toBeDefined();
    });
  });
  
  describe('MessageFormatter', () => {
    let messageFormatter;
    
    beforeEach(() => {
      messageFormatter = new MessageFormatter();
    });
    
    test('should instantiate correctly', () => {
      expect(messageFormatter).toBeInstanceOf(MessageFormatter);
    });
    
    test('should format commit messages', () => {
      const message = 'add user authentication feature';
      const options = { conventional: true };
      
      const formatted = messageFormatter.format(message, options);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
    
    test('should handle different formatting options', () => {
      const message = 'update API endpoints';
      const options = { conventional: false };
      
      const formatted = messageFormatter.format(message, options);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
  
  describe('StatsManager', () => {
    let statsManager;
    
    beforeEach(() => {
      statsManager = new StatsManager();
    });
    
    test('should instantiate correctly', () => {
      expect(statsManager).toBeInstanceOf(StatsManager);
    });
    
    test('should get initial stats', async () => {
      const stats = await statsManager.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      expect(typeof stats.totalCommits).toBe('number');
    });
    
    test('should record commit statistics', async () => {
      const initialStats = await statsManager.getStats();
      const initialCount = initialStats.totalCommits || 0;
      
      await statsManager.recordCommit('openai', 1000);
      
      const updatedStats = await statsManager.getStats();
      expect(updatedStats.totalCommits).toBe(initialCount + 1);
    });
  });
  
  describe('HookManager', () => {
    let hookManager;
    
    beforeEach(() => {
      hookManager = new HookManager();
    });
    
    test('should instantiate correctly', () => {
      expect(hookManager).toBeInstanceOf(HookManager);
    });
    
    test('should have hook management methods', () => {
      expect(typeof hookManager.install).toBe('function');
      expect(typeof hookManager.uninstall).toBe('function');
      expect(typeof hookManager.isInstalled).toBe('function');
    });
  });
  
});