/**
 * Provider Performance Manager - Intelligent provider selection
 */

const ConfigManager = require('./config-manager');
const ActivityLogger = require('./activity-logger');

class ProviderPerformanceManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.activityLogger = new ActivityLogger();
    this.performanceMetrics = new Map();
    
    // Initialize provider weights
    this.providerWeights = {
      ollama: { speed: 0.3, reliability: 0.4, quality: 0.3 },
      groq: { speed: 0.4, reliability: 0.3, quality: 0.3 }
    };
  }

  /**
   * Select best provider based on current conditions and historical performance
   */
  async selectBestProvider(diff, options = {}) {
    const availableProviders = ['ollama', 'groq'];
    const diffSize = this.estimateTokens(diff);
    const context = options.context || {};
    
    // Get performance metrics for each provider
    const providerScores = await Promise.all(
      availableProviders.map(async provider => {
        const metrics = await this.getProviderMetrics(provider);
        const score = this.calculateProviderScore(provider, metrics, diffSize, context);
        
        return {
          provider,
          score,
          metrics,
          reasoning: this.getScoreReasoning(provider, score, metrics, diffSize)
        };
      })
    );

    // Sort by score (highest first)
    providerScores.sort((a, b) => b.score - a.score);
    
    const selected = providerScores[0];
    
    console.log(`🎯 Selected provider: ${selected.provider} (score: ${selected.score.toFixed(2)})`);
    console.log(`   Reasoning: ${selected.reasoning}`);
    
    return {
      provider: selected.provider,
      confidence: selected.score,
      alternatives: providerScores.slice(1, 2).map(p => p.provider),
      metrics: selected.metrics
    };
  }

  /**
   * Calculate provider score based on multiple factors
   */
  calculateProviderScore(provider, metrics, diffSize, context) {
    const weights = this.providerWeights[provider];
    
    // Speed score (0-100)
    const speedScore = this.calculateSpeedScore(metrics.averageResponseTime, diffSize);
    
    // Reliability score (0-100)
    const reliabilityScore = this.calculateReliabilityScore(metrics.successRate, metrics.circuitBreakerStatus);
    
    // Quality score (0-100)
    const qualityScore = this.calculateQualityScore(metrics.averageMessageQuality, context);
    
    // Context suitability score (0-100)
    const contextScore = this.calculateContextScore(provider, diffSize, context);
    
    // Cost efficiency score (0-100)
    const costScore = this.calculateCostScore(provider, metrics);
    
    // Weighted combination
    const baseScore = (
      speedScore * weights.speed +
      reliabilityScore * weights.reliability +
      qualityScore * weights.quality
    );
    
    // Apply context and cost modifiers
    const finalScore = baseScore * 
      (1 + contextScore * 0.2) * 
      (1 + costScore * 0.1);
    
    return Math.min(100, Math.max(0, finalScore));
  }

  /**
   * Calculate speed score based on response time expectations
   */
  calculateSpeedScore(averageResponseTime, diffSize) {
    // Expected response times based on diff size
    const expectedTimes = {
      small: 5000,    // < 1k tokens
      medium: 15000,  // 1k-3k tokens  
      large: 30000,   // 3k-6k tokens
      xlarge: 60000   // > 6k tokens
    };
    
    let expectedTime;
    if (diffSize < 1000) expectedTime = expectedTimes.small;
    else if (diffSize < 3000) expectedTime = expectedTimes.medium;
    else if (diffSize < 6000) expectedTime = expectedTimes.large;
    else expectedTime = expectedTimes.xlarge;
    
    // Score: faster than expected = higher score
    const ratio = averageResponseTime / expectedTime;
    if (ratio <= 0.5) return 100;
    if (ratio <= 0.8) return 90;
    if (ratio <= 1.0) return 80;
    if (ratio <= 1.5) return 60;
    if (ratio <= 2.0) return 40;
    return 20;
  }

  /**
   * Calculate reliability score based on success rate and circuit breaker status
   */
  calculateReliabilityScore(successRate, circuitBreakerStatus) {
    let score = successRate;
    
    // Penalize if circuit breaker is not closed
    if (circuitBreakerStatus.state !== 'CLOSED') {
      score *= 0.3;
    }
    
    // Bonus for high success rates
    if (successRate >= 95) score = Math.min(100, score + 10);
    if (successRate >= 98) score = Math.min(100, score + 5);
    
    return score;
  }

  /**
   * Calculate quality score based on message quality metrics
   */
  calculateQualityScore(averageQuality, context) {
    // Base quality score
    let score = averageQuality || 75; // Default if no data
    
    // Boost for semantic context availability
    if (context.hasSemanticContext) {
      score += 5;
    }
    
    // Language-specific quality adjustments
    if (context.primaryLanguage) {
      const languageBonus = this.getLanguageQualityBonus(context.primaryLanguage);
      score += languageBonus;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate context suitability score
   */
  calculateContextScore(provider, diffSize, context) {
    let score = 50; // Base score
    
    // Provider-specific strengths
    if (provider === 'ollama') {
      // Ollama is better for code-heavy diffs
      if (context.codeRatio > 0.7) score += 20;
      if (context.hasComplexLogic) score += 15;
      if (diffSize > 4000) score += 10; // Better with larger contexts
    }
    
    if (provider === 'groq') {
      // Groq is faster for smaller diffs
      if (diffSize < 2000) score += 20;
      if (context.isSimpleChange) score += 15;
      if (context.timeSensitive) score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Calculate cost efficiency score
   */
  calculateCostScore(provider, metrics) {
    // Relative cost scores (lower is better)
    const costFactors = {
      ollama: 0.1,   // Free/local
      groq: 0.8      // Paid API
    };
    
    const costFactor = costFactors[provider] || 1.0;
    
    // Invert cost factor so lower cost = higher score
    return Math.max(0, (1 - costFactor) * 100);
  }

  /**
   * Get provider performance metrics
   */
  async getProviderMetrics(provider) {
    try {
      // Get recent activity logs for this provider
      const logs = await this.activityLogger.getProviderLogs(provider, 50); // Last 50 interactions
      
      if (logs.length === 0) {
        return this.getDefaultMetrics(provider);
      }
      
      // Calculate metrics from logs
      const successfulLogs = logs.filter(log => log.success);
      const responseTimes = logs.map(log => log.responseTime || 0);
      
      const metrics = {
        provider,
        totalRequests: logs.length,
        successfulRequests: successfulLogs.length,
        successRate: Math.round((successfulLogs.length / logs.length) * 100),
        averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        lastUsed: new Date(Math.max(...logs.map(log => new Date(log.timestamp)))),
        circuitBreakerStatus: await this.getCircuitBreakerStatus(provider),
        averageMessageQuality: this.calculateMessageQuality(successfulLogs)
      };
      
      // Cache metrics
      this.performanceMetrics.set(provider, metrics);
      
      return metrics;
      
    } catch (error) {
      console.warn(`Failed to get metrics for ${provider}:`, error.message);
      return this.getDefaultMetrics(provider);
    }
  }

  /**
   * Get circuit breaker status for provider
   */
  async getCircuitBreakerStatus(provider) {
    try {
      const AIProviderFactory = require('../providers/ai-provider-factory');
      const providerInstance = AIProviderFactory.create(provider);
      
      if (providerInstance && providerInstance.circuitBreaker) {
        return providerInstance.circuitBreaker.getStatus();
      }
    } catch (error) {
      // Ignore errors, return default status
    }
    
    return { state: 'CLOSED', isOpen: false };
  }

  /**
   * Calculate message quality from logs
   */
  calculateMessageQuality(logs) {
    if (logs.length === 0) return 75;
    
    // Simple quality heuristics based on response characteristics
    let totalQuality = 0;
    
    logs.forEach(log => {
      let quality = 75; // Base quality
      
      const response = log.response || '';
      
      // Bonus for conventional commit format
      if (/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\(.+\))?:/.test(response)) {
        quality += 10;
      }
      
      // Bonus for appropriate length
      if (response.length > 20 && response.length < 100) {
        quality += 5;
      }
      
      // Penalty for very short or generic responses
      if (response.length < 15 || /^(update|add|fix|remove)\s+\w+$/.test(response)) {
        quality -= 15;
      }
      
      totalQuality += Math.max(0, Math.min(100, quality));
    });
    
    return Math.round(totalQuality / logs.length);
  }

  /**
   * Get default metrics for new providers
   */
  getDefaultMetrics(provider) {
    const defaults = {
      ollama: {
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        successRate: 85, // Assume decent reliability
        averageResponseTime: 20000,
        lastUsed: null,
        circuitBreakerStatus: { state: 'CLOSED', isOpen: false },
        averageMessageQuality: 80
      },
      groq: {
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        successRate: 90, // Assume high reliability
        averageResponseTime: 8000,
        lastUsed: null,
        circuitBreakerStatus: { state: 'CLOSED', isOpen: false },
        averageMessageQuality: 75
      }
    };
    
    return defaults[provider] || defaults.ollama;
  }

  /**
   * Get reasoning for provider selection
   */
  getScoreReasoning(provider, score, metrics, diffSize) {
    const reasons = [];
    
    if (metrics.averageResponseTime < 10000) {
      reasons.push('fast response times');
    }
    
    if (metrics.successRate >= 90) {
      reasons.push('high reliability');
    }
    
    if (metrics.averageMessageQuality >= 80) {
      reasons.push('high quality outputs');
    }
    
    if (provider === 'ollama' && diffSize > 3000) {
      reasons.push('better with large diffs');
    }
    
    if (provider === 'groq' && diffSize < 2000) {
      reasons.push('faster for small changes');
    }
    
    if (metrics.circuitBreakerStatus.state === 'CLOSED') {
      reasons.push('currently stable');
    }
    
    return reasons.join(', ') || 'balanced performance';
  }

  /**
   * Get language-specific quality bonus
   */
  getLanguageQualityBonus(language) {
    const bonuses = {
      'javascript': 5,
      'typescript': 5,
      'python': 3,
      'php': 2,
      'java': 1,
      'go': 0,
      'rust': 0,
      'default': 0
    };
    
    return bonuses[language.toLowerCase()] || bonuses.default;
  }

  /**
   * Estimate token count (simplified version)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Update provider weights based on performance
   */
  async updateProviderWeights() {
    for (const provider of ['ollama', 'groq']) {
      const metrics = await this.getProviderMetrics(provider);
      
      // Adjust weights based on recent performance
      if (metrics.successRate > 95) {
        this.providerWeights[provider].reliability += 0.05;
      } else if (metrics.successRate < 80) {
        this.providerWeights[provider].reliability -= 0.05;
      }
      
      if (metrics.averageResponseTime < 10000) {
        this.providerWeights[provider].speed += 0.05;
      } else if (metrics.averageResponseTime > 30000) {
        this.providerWeights[provider].speed -= 0.05;
      }
      
      // Normalize weights
      const total = Object.values(this.providerWeights[provider]).reduce((a, b) => a + b, 0);
      Object.keys(this.providerWeights[provider]).forEach(key => {
        this.providerWeights[provider][key] /= total;
      });
    }
  }
}

module.exports = ProviderPerformanceManager;