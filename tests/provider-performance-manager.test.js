/**
 * Unit tests for Provider Performance Manager
 */

jest.mock('../src/core/config-manager');
jest.mock('../src/core/activity-logger');

const ProviderPerformanceManager = require('../src/core/provider-performance-manager');
const ConfigManager = require('../src/core/config-manager');
const ActivityLogger = require('../src/core/activity-logger');

describe('ProviderPerformanceManager', () => {
  let manager;
  let mockConfigManager;
  let mockActivityLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
    };
    mockActivityLogger = {
      getProviderLogs: jest.fn().mockResolvedValue([]),
    };
    
    ConfigManager.mockImplementation(() => mockConfigManager);
    ActivityLogger.mockImplementation(() => mockActivityLogger);

    manager = new ProviderPerformanceManager();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(manager.configManager).toBeDefined();
      expect(manager.activityLogger).toBeDefined();
      expect(manager.performanceMetrics).toBeInstanceOf(Map);
      expect(manager.performanceMetrics.size).toBe(0);
      expect(manager.providerWeights).toEqual({
        ollama: { speed: 0.3, reliability: 0.4, quality: 0.3 },
        groq: { speed: 0.4, reliability: 0.3, quality: 0.3 }
      });
    });
  });

  describe('selectBestProvider', () => {
    beforeEach(() => {
      mockActivityLogger.getProviderLogs.mockResolvedValue([]);
    });

    it('should select best provider based on metrics', async () => {
      const diff = 'test diff content';
      
      const result = await manager.selectBestProvider(diff);
      
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('metrics');
      expect(['ollama', 'groq']).toContain(result.provider);
    });

    it('should handle options with context', async () => {
      const diff = 'test diff';
      const options = {
        context: {
          hasSemanticContext: true,
          codeRatio: 0.8,
          primaryLanguage: 'javascript'
        }
      };
      
      const result = await manager.selectBestProvider(diff, options);
      
      expect(result).toHaveProperty('provider');
      expect(['ollama', 'groq']).toContain(result.provider);
    });

    it('should handle small diffs', async () => {
      const smallDiff = 'small change';
      
      const result = await manager.selectBestProvider(smallDiff);
      
      expect(result).toHaveProperty('provider');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle large diffs', async () => {
      const largeDiff = 'x'.repeat(10000);
      
      const result = await manager.selectBestProvider(largeDiff);
      
      expect(result).toHaveProperty('provider');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('calculateProviderScore', () => {
    it('should calculate score for provider with metrics', () => {
      const provider = 'ollama';
      const metrics = {
        averageResponseTime: 8000,
        successRate: 90,
        circuitBreakerStatus: { state: 'CLOSED' },
        averageMessageQuality: 80
      };
      const diffSize = 2000;
      const context = {};

      const score = manager.calculateProviderScore(provider, metrics, diffSize, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should apply context bonuses', () => {
      const provider = 'ollama';
      const metrics = {
        averageResponseTime: 3000,
        successRate: 95,
        circuitBreakerStatus: { state: 'CLOSED' },
        averageMessageQuality: 80
      };
      const diffSize = 5000;
      const context = {
        hasSemanticContext: true,
        codeRatio: 0.8,
        hasComplexLogic: true
      };

      const scoreWithBonus = manager.calculateProviderScore(provider, metrics, diffSize, context);
      const scoreWithoutBonus = manager.calculateProviderScore(provider, metrics, diffSize, {});

      expect(scoreWithBonus).toBeGreaterThanOrEqual(scoreWithoutBonus);
    });

    it('should penalize open circuit breaker', () => {
      const provider = 'groq';
      const metrics = {
        averageResponseTime: 5000,
        successRate: 90,
        circuitBreakerStatus: { state: 'OPEN' },
        averageMessageQuality: 80
      };
      const diffSize = 1000;
      const context = {};

      // Test reliability score directly to ensure penalty is applied
      const reliabilityScoreOpen = manager.calculateReliabilityScore(90, { state: 'OPEN' });
      const reliabilityScoreClosed = manager.calculateReliabilityScore(90, { state: 'CLOSED' });
      
      expect(reliabilityScoreOpen).toBeLessThan(reliabilityScoreClosed); // Should be penalized
    });
  });

  describe('calculateSpeedScore', () => {
    it('should return 100 for very fast responses', () => {
      const score = manager.calculateSpeedScore(2000, 5000);
      expect(score).toBe(100);
    });

    it('should return appropriate scores for different speeds', () => {
      expect(manager.calculateSpeedScore(4000, 5000)).toBe(100);
      expect(manager.calculateSpeedScore(5000, 5000)).toBe(100);
      expect(manager.calculateSpeedScore(7500, 5000)).toBe(100);
      expect(manager.calculateSpeedScore(10000, 5000)).toBe(100);
      expect(manager.calculateSpeedScore(15000, 5000)).toBe(80);
      expect(manager.calculateSpeedScore(20000, 5000)).toBe(60);
      expect(manager.calculateSpeedScore(30000, 5000)).toBe(40);
    });

    it('should handle different diff sizes', () => {
      expect(manager.calculateSpeedScore(3000, 1000)).toBe(100);
      expect(manager.calculateSpeedScore(15000, 5000)).toBe(100);
      expect(manager.calculateSpeedScore(40000, 10000)).toBe(90);
    });
  });

  describe('calculateReliabilityScore', () => {
    it('should return success rate for closed circuit breaker', () => {
      const score = manager.calculateReliabilityScore(85, { state: 'CLOSED' });
      expect(score).toBe(85);
    });

    it('should penalize open circuit breaker', () => {
      const score = manager.calculateReliabilityScore(90, { state: 'OPEN' });
      expect(score).toBe(27); // 90 * 0.3
    });

    it('should add bonus for high success rates', () => {
      expect(manager.calculateReliabilityScore(95, { state: 'CLOSED' })).toBe(100);
      expect(manager.calculateReliabilityScore(98, { state: 'CLOSED' })).toBe(100);
    });
  });

  describe('calculateQualityScore', () => {
    it('should return default score for no data', () => {
      const score = manager.calculateQualityScore(null, {});
      expect(score).toBe(75);
    });

    it('should add semantic context bonus', () => {
      const score = manager.calculateQualityScore(80, { hasSemanticContext: true });
      expect(score).toBe(85);
    });

    it('should add language bonus', () => {
      const score = manager.calculateQualityScore(80, { primaryLanguage: 'javascript' });
      expect(score).toBe(85);
    });

    it('should handle unknown language', () => {
      const score = manager.calculateQualityScore(80, { primaryLanguage: 'unknown' });
      expect(score).toBe(80);
    });
  });

  describe('calculateContextScore', () => {
    it('should return base score for no context', () => {
      const score = manager.calculateContextScore('ollama', 1000, {});
      expect(score).toBe(50);
    });

    it('should boost ollama for code-heavy diffs', () => {
      const score = manager.calculateContextScore('ollama', 5000, { codeRatio: 0.8 });
      expect(score).toBe(80);
    });

    it('should boost ollama for complex logic', () => {
      const score = manager.calculateContextScore('ollama', 2000, { hasComplexLogic: true });
      expect(score).toBe(65);
    });

    it('should boost groq for small diffs', () => {
      const score = manager.calculateContextScore('groq', 1000, {});
      expect(score).toBe(70);
    });

    it('should boost groq for simple changes', () => {
      const score = manager.calculateContextScore('groq', 1500, { isSimpleChange: true });
      expect(score).toBe(85);
    });

    it('should boost groq for time sensitive requests', () => {
      const score = manager.calculateContextScore('groq', 2000, { timeSensitive: true });
      expect(score).toBe(60);
    });
  });

  describe('calculateCostScore', () => {
    it('should return high score for ollama (free)', () => {
      const score = manager.calculateCostScore('ollama', {});
      expect(score).toBe(90); // (1 - 0.1) * 100
    });

    it('should return lower score for groq (paid)', () => {
      const score = manager.calculateCostScore('groq', {});
      expect(score).toBeCloseTo(20, 5); // (1 - 0.8) * 100
    });

    it('should return zero for unknown provider', () => {
      const score = manager.calculateCostScore('unknown', {});
      expect(score).toBe(0);
    });
  });

  describe('getProviderMetrics', () => {
    it('should return default metrics for provider with no logs', async () => {
      mockActivityLogger.getProviderLogs.mockResolvedValue([]);
      
      const metrics = await manager.getProviderMetrics('ollama');
      
      expect(metrics).toHaveProperty('provider', 'ollama');
      expect(metrics).toHaveProperty('totalRequests', 0);
      expect(metrics).toHaveProperty('successRate', 85);
    });

    it('should calculate metrics from logs', async () => {
      const logs = [
        { success: true, responseTime: 5000, timestamp: '2024-01-01T10:00:00Z' },
        { success: false, responseTime: 10000, timestamp: '2024-01-01T11:00:00Z' },
        { success: true, responseTime: 7000, timestamp: '2024-01-01T12:00:00Z' }
      ];
      mockActivityLogger.getProviderLogs.mockResolvedValue(logs);
      
      const metrics = await manager.getProviderMetrics('groq');
      
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.successRate).toBe(67);
      expect(metrics.averageResponseTime).toBe(7333);
    });

    it('should handle errors gracefully', async () => {
      mockActivityLogger.getProviderLogs.mockRejectedValue(new Error('Failed to get logs'));
      
      const metrics = await manager.getProviderMetrics('ollama');
      
      expect(metrics).toHaveProperty('provider', 'ollama');
      expect(metrics).toHaveProperty('totalRequests', 0);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return default status for provider without circuit breaker', async () => {
      jest.doMock('../src/providers/ai-provider-factory', () => ({
        create: jest.fn().mockReturnValue({ circuitBreaker: null })
      }));

      const status = await manager.getCircuitBreakerStatus('test');
      expect(status).toEqual({ state: 'CLOSED', isOpen: false });
    });

    it('should return circuit breaker status when available', async () => {
      // Test with a provider that should have a circuit breaker
      const status = await manager.getCircuitBreakerStatus('ollama');
      // Should return either mocked status or default status
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('isOpen');
    });
  });

  describe('calculateMessageQuality', () => {
    it('should return default score for empty logs', () => {
      const quality = manager.calculateMessageQuality([]);
      expect(quality).toBe(75);
    });

    it('should calculate quality from conventional commits', () => {
      const logs = [
        { response: 'feat: add new feature' },
        { response: 'fix: resolve bug' }
      ];
      const quality = manager.calculateMessageQuality(logs);
      expect(quality).toBe(88); // (85 + 90) / 2 = 87.5 rounded to 88
    });

    it('should penalize generic responses', () => {
      const logs = [
        { response: 'add feature' },
        { response: 'fix bug' }
      ];
      const quality = manager.calculateMessageQuality(logs);
      expect(quality).toBe(60); // (75 - 15 + 75 - 15) / 2
    });

    it('should bonus appropriate length responses', () => {
      const logs = [
        { response: 'feat: implement comprehensive authentication system with JWT tokens' }
      ];
      const quality = manager.calculateMessageQuality(logs);
      expect(quality).toBe(90); // 75 + 10 (conventional) + 5 (length)
    });
  });

  describe('getDefaultMetrics', () => {
    it('should return default metrics for ollama', () => {
      const metrics = manager.getDefaultMetrics('ollama');
      expect(metrics.provider).toBe('ollama');
      expect(metrics.successRate).toBe(85);
      expect(metrics.averageResponseTime).toBe(20000);
    });

    it('should return default metrics for groq', () => {
      const metrics = manager.getDefaultMetrics('groq');
      expect(metrics.provider).toBe('groq');
      expect(metrics.successRate).toBe(90);
      expect(metrics.averageResponseTime).toBe(8000);
    });

    it('should return ollama defaults for unknown provider', () => {
      const metrics = manager.getDefaultMetrics('unknown');
      expect(metrics.provider).toBe('unknown');
      expect(metrics.successRate).toBe(85);
    });
  });

  describe('getScoreReasoning', () => {
    it('should generate reasoning for fast response times', () => {
      const reasoning = manager.getScoreReasoning('groq', 90, {
        averageResponseTime: 5000,
        successRate: 95,
        averageMessageQuality: 80,
        circuitBreakerStatus: { state: 'CLOSED' }
      }, 1000);
      
      expect(reasoning).toContain('fast response times');
      expect(reasoning).toContain('high reliability');
      expect(reasoning).toContain('high quality outputs');
      expect(reasoning).toContain('currently stable');
    });

    it('should generate reasoning for large diffs with ollama', () => {
      const reasoning = manager.getScoreReasoning('ollama', 85, {
        averageResponseTime: 15000,
        successRate: 88,
        averageMessageQuality: 78,
        circuitBreakerStatus: { state: 'CLOSED' }
      }, 5000);
      
      expect(reasoning).toContain('better with large diffs');
    });

    it('should generate reasoning for small diffs with groq', () => {
      const reasoning = manager.getScoreReasoning('groq', 85, {
        averageResponseTime: 3000,
        successRate: 92,
        averageMessageQuality: 75,
        circuitBreakerStatus: { state: 'CLOSED' }
      }, 1000);
      
      expect(reasoning).toContain('faster for small changes');
    });

    it('should return balanced performance for no specific reasons', () => {
      const reasoning = manager.getScoreReasoning('ollama', 50, {
        averageResponseTime: 25000,
        successRate: 75,
        averageMessageQuality: 70,
        circuitBreakerStatus: { state: 'OPEN' } // Open to avoid "currently stable"
      }, 2000);
      
      expect(reasoning).toBe('balanced performance');
    });
  });

  describe('getLanguageQualityBonus', () => {
    it('should return appropriate bonuses for different languages', () => {
      expect(manager.getLanguageQualityBonus('javascript')).toBe(5);
      expect(manager.getLanguageQualityBonus('typescript')).toBe(5);
      expect(manager.getLanguageQualityBonus('python')).toBe(3);
      expect(manager.getLanguageQualityBonus('php')).toBe(2);
      expect(manager.getLanguageQualityBonus('java')).toBe(1);
      expect(manager.getLanguageQualityBonus('go')).toBe(0);
      expect(manager.getLanguageQualityBonus('rust')).toBe(0);
    });

    it('should handle case insensitive input', () => {
      expect(manager.getLanguageQualityBonus('JavaScript')).toBe(5);
      expect(manager.getLanguageQualityBonus('PYTHON')).toBe(3);
    });

    it('should return default bonus for unknown language', () => {
      expect(manager.getLanguageQualityBonus('unknown')).toBe(0);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens from text length', () => {
      expect(manager.estimateTokens('hello world')).toBe(3); // 11 chars / 4 rounded up
      expect(manager.estimateTokens('a'.repeat(100))).toBe(25);
      expect(manager.estimateTokens('')).toBe(0);
    });
  });

  describe('updateProviderWeights', () => {
    beforeEach(() => {
      mockActivityLogger.getProviderLogs.mockResolvedValue([]);
    });

    it('should update weights based on performance', async () => {
      // Mock high performance for ollama
      jest.spyOn(manager, 'getProviderMetrics').mockResolvedValueOnce({
        successRate: 96,
        averageResponseTime: 8000
      });

      await manager.updateProviderWeights();

      expect(manager.providerWeights.ollama.reliability).toBeGreaterThan(0.4);
      expect(manager.providerWeights.ollama.speed).toBeGreaterThan(0.3);
    });

    it('should decrease weights for poor performance', async () => {
      // Mock poor performance
      jest.spyOn(manager, 'getProviderMetrics').mockResolvedValueOnce({
        successRate: 75,
        averageResponseTime: 35000
      });

      await manager.updateProviderWeights();

      expect(manager.providerWeights.ollama.reliability).toBeLessThan(0.4);
      expect(manager.providerWeights.ollama.speed).toBeLessThan(0.3);
    });

    it('should normalize weights', async () => {
      jest.spyOn(manager, 'getProviderMetrics').mockResolvedValue({
        successRate: 90,
        averageResponseTime: 10000
      });

      await manager.updateProviderWeights();

      const ollamaWeights = manager.providerWeights.ollama;
      const total = Object.values(ollamaWeights).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });
  });
});