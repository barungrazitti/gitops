// Very large test file to definitely trigger chunking
const fs = require("fs");
const path = require("path");

class DataProcessor {
  constructor() {
    this.cache = new Map();
    this.stats = {
      processed: 0,
      errors: 0,
      startTime: Date.now(),
    };
  }

  // Generate 1000 methods to create a large file
  generateMethods() {
    const methods = [];

    for (let i = 0; i < 1000; i++) {
      methods.push(`
  async processBatch${i}(data) {
    const batch = data.slice(${i} * 100, (${i} + 1) * 100);
    const results = [];
    
    for (const item of batch) {
      try {
        const processed = await this.transformItem${i}(item);
        results.push(processed);
        this.stats.processed++;
      } catch (error) {
        this.stats.errors++;
        console.error(\`Error processing item \${item.id} in batch \${${i}}:\`, error);
      }
    }
    
    return results;
  }

  async transformItem${i}(item) {
    return {
      id: item.id || \${i},
      name: item.name || 'item-\${${i}}',
      value: this.calculateValue${i}(item),
      timestamp: new Date().toISOString(),
      batchId: ${i},
      metadata: {
        original: item,
        transformed: true,
        processor: 'DataProcessor',
        version: '1.0.0'
      }
    };
  }

  calculateValue${i}(item) {
    const base = item.value || 0;
    const multiplier = ${i} * 0.001;
    const offset = Math.sin(${i}) * 10;
    
    return {
      original: base,
      processed: base * multiplier + offset,
      normalized: (base * multiplier + offset) / 100,
      category: this.categorizeValue${i}(base * multiplier + offset)
    };
  }

  categorizeValue${i}(value) {
    if (value < 0) return 'negative';
    if (value < 10) return 'low';
    if (value < 50) return 'medium';
    if (value < 100) return 'high';
    return 'very-high';
  }

  validateItem${i}(item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item object in method \${${i}}');
    }
    
    if (item.id === undefined || item.id === null) {
      throw new Error('Missing item id in method \${${i}}');
    }
    
    if (typeof item.value !== 'number' && item.value !== undefined) {
      throw new Error('Invalid value type in method \${${i}}');
    }
    
    return true;
  }

  async cacheResult${i}(key, result) {
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(\`\${key}-\${${i}}\`, {
      result,
      timestamp: Date.now(),
      method: 'cacheResult${i}'
    });
  }

  getCachedResult${i}(key) {
    return this.cache.get(\`\${key}-\${${i}}\`);
  }

  clearCache${i}() {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.endsWith(\`-\${${i}}\`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }

  generateReport${i}() {
    const endTime = Date.now();
    const duration = endTime - this.stats.startTime;
    
    return {
      method: 'generateReport${i}',
      stats: { ...this.stats },
      duration,
      cacheSize: this.cache.size,
      performance: {
        itemsPerSecond: this.stats.processed / (duration / 1000),
        errorRate: this.stats.errors / (this.stats.processed + this.stats.errors) * 100,
        efficiency: this.stats.processed / (this.stats.processed + this.stats.errors)
      }
    };
  }
`);
    }

    return methods.join("\n");
  }

  // Add all generated methods to the class
  initializeMethods() {
    const methods = this.generateMethods();
    return methods;
  }
}

// Create a large configuration object
const config = {
  database: {
    host: "localhost",
    port: 5432,
    name: "large_database",
    options: {
      ssl: true,
      maxConnections: 100,
      connectionTimeout: 30000,
      queryTimeout: 10000,
    },
  },
  redis: {
    host: "localhost",
    port: 6379,
    db: 0,
    options: {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    middleware: ["cors", "helmet", "compression", "morgan"],
    routes: {
      api: "/api/v1",
      health: "/health",
      metrics: "/metrics",
    },
  },
  logging: {
    level: "info",
    format: "json",
    transports: ["console", "file", "elasticsearch"],
    options: {
      maxSize: "100MB",
      maxFiles: 10,
      datePattern: "YYYY-MM-DD",
    },
  },
  monitoring: {
    enabled: true,
    metrics: ["cpu", "memory", "disk", "network"],
    alerts: {
      cpu: { threshold: 80, duration: 300 },
      memory: { threshold: 90, duration: 180 },
      disk: { threshold: 85, duration: 600 },
    },
  },
};

// Generate large arrays of data
const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  description: `This is a detailed description for item number ${i} with lots of additional text to make it larger`,
  value: Math.random() * 1000,
  category: ["A", "B", "C", "D", "E"][i % 5],
  tags: [`tag${i}`, `category${i % 10}`, `type${i % 3}`],
  metadata: {
    created: new Date(Date.now() - i * 1000).toISOString(),
    updated: new Date().toISOString(),
    version: Math.floor(i / 100) + 1,
    priority: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
    status: i % 2 === 0 ? "active" : "inactive",
  },
}));

module.exports = {
  DataProcessor,
  config,
  largeDataSet,
};
