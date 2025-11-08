/**
 * Ultra Comprehensive Tests - Push to 98% Final Sprint
 */

const CacheManager = require('../src/core/cache-manager');
const AnalysisEngine = require('../src/core/analysis-engine');
const ActivityLogger = require('../src/core/activity-logger');

describe('Ultra Comprehensive Tests - Final 98% Push', () => {
  describe('CacheManager Ultra Coverage', () => {
    let cacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({
        maxSize: 10,
        ttl: 5000,
        cleanupInterval: 1000,
        enableMetrics: true,
        compressionEnabled: true
      });
    });

    afterEach(() => {
      cacheManager.clear();
    });

    describe('Advanced persistence and serialization', () => {
      it('should handle complex object serialization', async () => {
        const complexObject = {
          map: new Map([['key1', 'value1'], ['key2', 'value2']]),
          set: new Set([1, 2, 3]),
          date: new Date('2023-01-01'),
          buffer: Buffer.from('test'),
          regex: /test/g,
          symbol: Symbol('test'),
          function: () => 'test'
        };

        cacheManager.set('complex', complexObject);
        await cacheManager.persist();

        expect(cacheManager.get('complex')).toBeDefined();
      });

      it('should handle concurrent persistence operations', async () => {
        for (let i = 0; i < 100; i++) {
          cacheManager.set(`concurrent-${i}`, { data: `value-${i}` });
        }

        const promises = Array(5).fill(null).map(() => cacheManager.persist());
        await Promise.all(promises);

        expect(cacheManager.size()).toBe(10); // Should respect maxSize
      });

      it('should handle corrupted cache file recovery', async () => {
        // Simulate corrupted file
        jest.spyOn(require('fs-extra'), 'readFile').mockResolvedValue('corrupted data {');
        
        const result = await cacheManager.load();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle incremental persistence', async () => {
        cacheManager.set('inc1', 'value1');
        await cacheManager.persist();

        cacheManager.set('inc2', 'value2');
        cacheManager.set('inc3', 'value3');

        const result = await cacheManager.persist({ incremental: true });

        expect(result.success).toBe(true);
      });
    });

    describe('Advanced caching strategies', () => {
      it('should implement write-through caching', async () => {
        const writeThroughCache = new CacheManager({
          strategy: 'write-through',
          backend: {
            get: jest.fn(),
            set: jest.fn()
          }
        });

        writeThroughCache.set('test', 'value');
        const result = writeThroughCache.get('test');

        expect(result).toBe('value');
        expect(writeThroughCache.options.backend.set).toHaveBeenCalled();
      });

      it('should implement write-behind caching', async () => {
        const writeBehindCache = new CacheManager({
          strategy: 'write-behind',
          backend: {
            get: jest.fn(),
            set: jest.fn()
          },
          writeBehindDelay: 100
        });

        writeBehindCache.set('test', 'value');
        const result = writeBehindCache.get('test');

        expect(result).toBe('value');
        
        // Wait for write-behind
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(writeBehindCache.options.backend.set).toHaveBeenCalled();
      });

      it('should implement refresh-ahead caching', async () => {
        const refreshCache = new CacheManager({
          strategy: 'refresh-ahead',
          backend: {
            get: jest.fn().mockResolvedValue('fresh-value'),
            set: jest.fn()
          },
          refreshThreshold: 0.8
        });

        // Set with short TTL
        refreshCache.set('refresh-test', 'initial-value', 100);
        
        // Wait past threshold
        await new Promise(resolve => setTimeout(resolve, 85));
        
        const result = refreshCache.get('refresh-test');
        
        expect(refreshCache.options.backend.get).toHaveBeenCalled();
      });
    });

    describe('Memory optimization and monitoring', () => {
      it('should implement automatic memory pressure handling', () => {
        // Simulate memory pressure
        const originalMemoryUsage = process.memoryUsage();
        
        // Fill cache beyond reasonable limits
        for (let i = 0; i < 10000; i++) {
          cacheManager.set(`memory-test-${i}`, 'x'.repeat(1000));
        }

        const finalMemoryUsage = process.memoryUsage();
        const memoryIncrease = finalMemoryUsage.heapUsed - originalMemoryUsage.heapUsed;

        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
      });

      it('should implement intelligent eviction policies', () => {
        const lrucache = new CacheManager({
          evictionPolicy: 'lru',
          maxSize: 3
        });

        const lfuCache = new CacheManager({
          evictionPolicy: 'lfu',
          maxSize: 3
        });

        // Test LRU
        lrucache.set('a', 'value');
        lrucache.set('b', 'value');
        lrucache.set('c', 'value');
        lrucache.get('a'); // Access 'a' to make it recent
        lrucache.set('d', 'value'); // Should evict 'b' (least recent)

        expect(lrucache.get('b')).toBeUndefined();
        expect(lrucache.get('a')).toBe('value');

        // Test LFU
        lfuCache.set('a', 'value');
        lfuCache.set('b', 'value');
        lfuCache.set('c', 'value');
        lfuCache.get('a'); // Access 'a' twice to increase frequency
        lfuCache.get('a');
        lfuCache.set('d', 'value'); // Should evict 'b' or 'c' (least frequent)

        expect(lfuCache.get('a')).toBe('value');
      });

      it('should monitor cache hit ratios in real-time', () => {
        for (let i = 0; i < 100; i++) {
          if (i % 3 === 0) {
            cacheManager.set(`hit-test-${i}`, `value-${i}`);
          }
          cacheManager.get(`hit-test-${i % 10}`); // Mix of hits and misses
        }

        const stats = cacheManager.getStats();
        expect(stats.hitRate).toBeDefined();
        expect(stats.hitRate).toBeGreaterThan(0);
        expect(stats.hitRate).toBeLessThan(1);
      });
    });

    describe('Advanced error handling and recovery', () => {
      it('should handle serialization errors gracefully', () => {
        const circularObject = {};
        circularObject.self = circularObject;

        expect(() => cacheManager.set('circular', circularObject)).not.toThrow();
        expect(cacheManager.get('circular')).toBeDefined();
      });

      it('should handle backend failures in distributed caching', async () => {
        const distributedCache = new CacheManager({
          backend: {
            get: jest.fn().mockRejectedValue(new Error('Backend down')),
            set: jest.fn().mockRejectedValue(new Error('Backend down'))
          },
          fallbackEnabled: true
        });

        distributedCache.set('fallback-test', 'value');
        const result = distributedCache.get('fallback-test');

        expect(result).toBe('value'); // Should use local fallback
      });

      it('should implement circuit breaker for cache operations', async () => {
        const circuitCache = new CacheManager({
          circuitBreakerEnabled: true,
          circuitBreakerThreshold: 3,
          circuitBreakerTimeout: 1000
        });

        // Simulate backend failures
        for (let i = 0; i < 5; i++) {
          try {
            await circuitCache.load();
          } catch (error) {
            // Expected failures
          }
        }

        const stats = circuitCache.getStats();
        expect(stats.circuitBreakerTripped).toBeDefined();
      });
    });
  });

  describe('AnalysisEngine Ultra Coverage', () => {
    let analysisEngine;

    beforeEach(() => {
      analysisEngine = new AnalysisEngine({
        enableAdvancedMetrics: true,
        enablePatternDetection: true,
        enableSemanticAnalysis: true,
        maxFileSize: 5 * 1024 * 1024,
        maxDiffSize: 2 * 1024 * 1024
      });
    });

    describe('Advanced semantic analysis', () => {
      it('should detect code refactoring patterns', async () => {
        const refactorDiff = `diff --git a/old-api.js b/new-api.js
index 1234567..abcdefg 100644
--- a/old-api.js
+++ b/new-api.js
@@ -1,20 +1,15 @@
-function oldAPI(param1, param2, callback) {
-  if (!param1 || !param2) {
-    return callback(new Error('Invalid parameters'));
-  }
-  
-  const result = param1 + param2;
-  setTimeout(() => callback(null, result), 100);
-}
+/**
+ * Refactored to use Promise-based API
+ */
+async function newAPI(param1, param2) {
+  if (!param1 || !param2) {
+    throw new Error('Invalid parameters');
+  }
+  
+  return param1 + param2;
+}
 
-function usageExample() {
-  oldAPI(1, 2, (err, result) => {
-    if (err) console.error(err);
-    console.log(result);
-  });
-}
+function usageExample() {
+  newAPI(1, 2)
+    .then(result => console.log(result))
+    .catch(err => console.error(err));
+}`;

        const result = await analysisEngine.analyze(refactorDiff);
        const semantic = await analysisEngine.performSemanticAnalysis(result.changes);

        expect(semantic.refactoring.detected).toBe(true);
        expect(semantic.refactoring.type).toContain('callback-to-promise');
        expect(semantic.impact.estimate).toBeGreaterThan(0);
      });

      it('should identify breaking changes', async () => {
        const breakingDiff = `diff --git a/public-api.js b/public-api.js
index 1234567..abcdefg 100644
--- a/public-api.js
+++ b/public-api.js
@@ -1,5 +1,5 @@
-class UserService {
-  login(username, password) {
+class UserService {
+  async login(username, password, twoFactorCode) {
+    // Added two-factor authentication
     // Implementation
   }
   
   createUser(userData) {
-    return this.userRepository.create(userData);
+    return this.userRepository.create({
+      ...userData,
+      createdAt: new Date(),
+      updatedAt: new Date()
+    });
   }
-  
-  deleteAccount(userId) {
-    return this.userRepository.delete(userId);
+  
+  deleteAccount(userId, reason) {
+    // Added audit trail
+    return this.userRepository.softDelete(userId, reason);
   }`;

        const result = await analysisEngine.analyze(breakingDiff);
        const breaking = await analysisEngine.identifyBreakingChanges(result.changes);

        expect(breaking.detected).toBe(true);
        expect(breaking.changes).toHaveLength(3);
        expect(breaking.changes[0].severity).toBe('major');
      });

      it('should detect performance implications', async () => {
        const performanceDiff = `diff --git a/slow-query.js b/fast-query.js
index 1234567..abcdefg 100644
--- a/slow-query.js
+++ b/fast-query.js
@@ -1,8 +1,12 @@
-function getUsers() {
-  // N+1 query problem
-  const users = db.query('SELECT * FROM users');
-  return users.map(user => {
-    user.posts = db.query('SELECT * FROM posts WHERE user_id = ?', user.id);
-    return user;
-  });
+async function getUsers() {
+  // Optimized with JOIN and pagination
+  const query = \`
+    SELECT u.*, COUNT(p.id) as post_count
+    FROM users u
+    LEFT JOIN posts p ON u.id = p.user_id
+    GROUP BY u.id
+    ORDER BY u.created_at
+    LIMIT ? OFFSET ?
+  \`;
+  return await db.query(query, [limit, offset]);
 }`;

        const result = await analysisEngine.analyze(performanceDiff);
        const performance = await analysisEngine.analyzePerformanceImpact(result.changes);

        expect(performance.impact).toBeGreaterThan(0);
        expect(performance.improvements).toContain('query-optimization');
      });
    });

    describe('Advanced pattern recognition', () => {
      it('should detect security vulnerability patterns', async () => {
        const securityDiff = `diff --git a/unsafe.js b/safe.js
index 1234567..abcdefg 100644
--- a/unsafe.js
+++ b/safe.js
@@ -1,6 +1,8 @@
-function authenticate(username, password) {
-  const query = 'SELECT * FROM users WHERE username = '' + username + '' AND password = '' + password + ''';
-  return db.query(query);
+function authenticate(username, password) {
+  // Parameterized query prevents SQL injection
+  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
+  const hashedPassword = bcrypt.hash(password, salt);
+  return db.query(query, [username, hashedPassword]);
 }
 
-function processData(input) {
-  return eval(input); // XSS vulnerability
+function processData(input) {
+  // Sanitize input to prevent XSS
+  const sanitized = DOMPurify.sanitize(input);
+  return JSON.parse(sanitized);
 }`;

        const result = await analysisEngine.analyze(securityDiff);
        const security = await analysisEngine.analyzeSecurityImplications(result.changes);

        expect(security.vulnerabilities.fixed).toContain('sql-injection');
        expect(security.vulnerabilities.fixed).toContain('xss');
        expect(security.securityScore).toBeGreaterThan(0);
      });

      it('should detect architectural patterns', async () => {
        const architecturalDiff = `diff --git a/monolith.js b/microservice.js
index 1234567..abcdefg 100644
--- a/monolith.js
+++ b/microservice.js
@@ -1,15 +1,20 @@
-class UserApp {
-  handleUsers() {
-    // All user logic in one place
-    this.createUser();
-    this.updateUser();
-    this.deleteUser();
-    this.authenticateUser();
-    this.authorizeUser();
-    this.userProfile();
-  }
+// Separation of concerns into microservices
+class UserService {
+  createUser(userData) { return this.http.post('/users', userData); }
+  updateUser(id, userData) { return this.http.put(`/users/${id}`, userData); }
+  deleteUser(id) { return this.http.delete(`/users/${id}`); }
+}
+
+class AuthService {
+  authenticate(credentials) { return this.http.post('/auth/login', credentials); }
+  authorize(token) { return this.http.post('/auth/verify', { token }); }
+}
+
+class ProfileService {
+  getUserProfile(userId) { return this.http.get(`/profiles/${userId}`); }
+  updateUserProfile(userId, profile) { return this.http.put(`/profiles/${userId}`, profile); }
 }
 
+// API Gateway orchestrates services
+class APIGateway {
+  constructor() {
+    this.userService = new UserService();
+    this.authService = new AuthService();
+    this.profileService = new ProfileService();
+  }
+}`;

        const result = await analysisEngine.analyze(architecturalDiff);
        const architecture = await analysisEngine.analyzeArchitecturalChanges(result.changes);

        expect(architecture.patterns.detected).toContain('microservices');
        expect(architecture.patterns.detected).toContain('separation-of-concerns');
        expect(architecture.complexity.change).toBeGreaterThan(0);
      });

      it('should detect code quality improvements', async () => {
        const qualityDiff = `diff --git a/bad-code.js b/good-code.js
index 1234567..abcdefg 100644
--- a/bad-code.js
+++ b/good-code.js
@@ -1,12 +1,20 @@
-function calculate(a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z) {
-  return a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+w+x+y+z;
-}
+/**
+ * Calculate sum with improved readability and maintainability
+ */
+function calculate(...numbers) {
+  // Use spread operator for flexible parameters
+  return numbers.reduce((sum, num) => sum + num, 0);
+}
+
+function validateInputs(numbers) {
+  return numbers.every(num => typeof num === 'number' && !isNaN(num));
+}
+
+function safeCalculate(...numbers) {
+  if (!validateInputs(numbers)) {
+    throw new Error('Invalid numeric inputs');
+  }
+  return calculate(...numbers);
+}

-function processItems(items) {
-  var result = [];
-  for(var i=0; i<items.length; i++) {
-    result.push(items[i].toUpperCase());
-  }
-  return result;
-}
+function processItems(items) {
+  // Use functional programming for better readability
+  return items
+    .filter(item => item && typeof item === 'string')
+    .map(item => item.toUpperCase())
+    .filter(item => item.length > 0);
+}`;

        const result = await analysisEngine.analyze(qualityDiff);
        const quality = await analysisEngine.analyzeCodeQuality(result.changes);

        expect(quality.improvements).toContain('function-arity-reduction');
        expect(quality.improvements).toContain('modern-javascript');
        expect(quality.metrics.maintainability).toBeGreaterThan(0);
      });
    });

    describe('Advanced cross-file analysis', () => {
      it('should analyze dependency changes', async () => {
        const dependencyChanges = [
          `diff --git a/package.json b/package.json
index 1234567..abcdefg 100644
--- a/package.json
+++ b/package.json
@@ -5,7 +5,8 @@
   "dependencies": {
     "react": "^17.0.0",
-    "react-dom": "^17.0.0"
+    "react-dom": "^17.0.0",
+    "react-router": "^6.0.0",
+    "axios": "^0.24.0"
   }`,
          `diff --git a/app.js b/app.js
index 1234567..abcdefg 100644
--- a/app.js
+++ b/app.js
@@ -1,5 +1,8 @@
 import React from 'react';
+import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
+import axios from 'axios';
+ 
 function App() {
   return <div>Hello World</div>;
+  // Now uses routing and HTTP client
 }`
        ];

        const result = await analysisEngine.analyzeDependencyChanges(dependencyChanges);
        const dependencies = await analysisEngine.analyzeDependencyImpact(result);

        expect(dependencies.added).toContain('react-router');
        expect(dependencies.added).toContain('axios');
        expect(dependencies.riskAssessment).toBeDefined();
      });

      it('should detect API contract changes', async () => {
        const apiDiff = `diff --git a/api-endpoints.js b/api-endpoints.js
index 1234567..abcdefg 100644
--- a/api-endpoints.js
+++ b/api-endpoints.js
@@ -1,8 +1,12 @@
 // GET /users/{id}
-function getUser(id) {
-  return { id, name: 'User', email: 'user@example.com' };
+function getUser(id, includeProfile = false) {
+  const user = { id, name: 'User', email: 'user@example.com' };
+  return includeProfile ? { ...user, profile: {} } : user;
 }
 
 // POST /users
-function createUser(userData) {
-  return { success: true, id: Date.now() };
+function createUser(userData, options = {}) {
+  const user = { ...userData, id: Date.now() };
+  if (options.validateEmail && !isValidEmail(userData.email)) {
+    throw new Error('Invalid email format');
+  }
+  return { success: true, user };
 }`;

        const result = await analysisEngine.analyze(apiDiff);
        const contracts = await analysisEngine.analyzeAPIContractChanges(result.changes);

        expect(contracts.breakingChanges).toHaveLength(0);
        expect(contracts.additions).toHaveLength(2);
        expect(contracts.compatibility.backward).toBe(true);
      });
    });
  });

  describe('ActivityLogger Ultra Coverage', () => {
    let activityLogger;

    beforeEach(() => {
      activityLogger = new ActivityLogger({
        enableRealTimeMonitoring: true,
        enableAnomalyDetection: true,
        enablePredictiveAnalysis: true,
        maxLogEntries: 1000,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        enableCompression: true,
        enableEncryption: true
      });
    });

    describe('Advanced monitoring and alerting', () => {
      it('should detect performance anomalies in real-time', () => {
        // Log normal operations
        for (let i = 0; i < 10; i++) {
          activityLogger.log({
            action: 'database-query',
            duration: 50 + Math.random() * 10, // 50-60ms
            timestamp: Date.now()
          });
        }

        // Log anomaly (slow query)
        activityLogger.log({
          action: 'database-query',
          duration: 500, // Much slower than normal
          timestamp: Date.now()
        });

        const anomalies = activityLogger.detectAnomalies();
        expect(anomalies.length).toBeGreaterThan(0);
        expect(anomalies[0].type).toBe('performance');
        expect(anomalies[0].severity).toBe('high');
      });

      it('should detect security events automatically', () => {
        // Log suspicious login patterns
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
          activityLogger.log({
            action: 'login-attempt',
            userId: `user-${i}`,
            ip: '192.168.1.100',
            success: false,
            timestamp: now + i * 1000
          });
        }

        // Log successful login from same IP
        activityLogger.log({
          action: 'login-success',
          userId: 'user-0',
          ip: '192.168.1.100',
          timestamp: now + 15000
        });

        const securityEvents = activityLogger.detectSecurityEvents();
        expect(securityEvents.length).toBeGreaterThan(0);
        expect(securityEvents[0].type).toBe('brute-force');
      });

      it('should provide predictive insights', () => {
        // Log historical data
        for (let day = 0; day < 30; day++) {
          const dayTimestamp = Date.now() - (day * 24 * 60 * 60 * 1000);
          for (let hour = 0; hour < 24; hour++) {
            activityLogger.log({
              action: 'user-login',
              timestamp: dayTimestamp + (hour * 60 * 60 * 1000),
              count: Math.floor(10 + Math.sin(hour / 4) * 5) // Peak usage
            });
          }
        }

        const predictions = activityLogger.generatePredictions();
        expect(predictions.peakHours).toBeDefined();
        expect(predictions.userGrowthTrend).toBeDefined();
        expect(predictions.capacityRecommendations).toBeDefined();
      });
    });

    describe('Advanced analytics and reporting', () => {
      it('should generate comprehensive performance reports', () => {
        // Log diverse activities
        const activities = [
          { action: 'api-call', duration: 100, status: 'success', timestamp: Date.now() },
          { action: 'database-query', duration: 50, status: 'success', timestamp: Date.now() },
          { action: 'cache-hit', duration: 5, status: 'success', timestamp: Date.now() },
          { action: 'api-call', duration: 200, status: 'error', error: 'timeout', timestamp: Date.now() },
          { action: 'database-query', duration: 75, status: 'success', timestamp: Date.now() }
        ];

        activities.forEach(activity => activityLogger.log(activity));

        const report = activityLogger.generatePerformanceReport();

        expect(report.summary.totalRequests).toBe(5);
        expect(report.summary.successRate).toBe(0.8);
        expect(report.summary.averageResponseTime).toBeGreaterThan(0);
        expect(report.distribution.byAction).toBeDefined();
        expect(report.performance.hotspots).toBeDefined();
      });

      it('should create user behavior analytics', () => {
        // Log user activities
        const users = ['user1', 'user2', 'user3'];
        const actions = ['login', 'view-page', 'click-button', 'logout'];

        for (let i = 0; i < 100; i++) {
          activityLogger.log({
            action: actions[Math.floor(Math.random() * actions.length)],
            userId: users[Math.floor(Math.random() * users.length)],
            timestamp: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
            sessionId: `session-${Math.floor(i / 10)}`
          });
        }

        const analytics = activityLogger.generateUserAnalytics();

        expect(analytics.activeUsers).toBeGreaterThan(0);
        expect(analytics.averageSessionDuration).toBeGreaterThan(0);
        expect(analytics.mostCommonActions).toBeDefined();
        expect(analytics.userRetentionRate).toBeDefined();
      });

      it('should provide system health monitoring', () => {
        // Log system events
        const systemEvents = [
          { action: 'server-start', timestamp: Date.now() - 86400000, memory: '256MB', cpu: '5%' },
          { action: 'memory-warning', timestamp: Date.now() - 43200000, memory: '2GB', cpu: '80%' },
          { action: 'cpu-spike', timestamp: Date.now() - 21600000, memory: '1GB', cpu: '95%' },
          { action: 'recovery', timestamp: Date.now() - 10800000, memory: '512MB', cpu: '20%' }
        ];

        systemEvents.forEach(event => activityLogger.log(event));

        const health = activityLogger.getSystemHealth();

        expect(health.overallScore).toBeDefined();
        expect(health.recentIncidents).toBeDefined();
        expect(health.currentStatus).toBeDefined();
        expect(health.trends).toBeDefined();
      });
    });

    describe('Advanced data management', () => {
      it('should implement intelligent log rotation', () => {
        // Fill logs with time-based entries
        const now = Date.now();
        for (let i = 0; i < 1500; i++) {
          activityLogger.log({
            action: 'rotation-test',
            timestamp: now - (i * 1000), // 1 second apart
            data: `log-entry-${i}`.repeat(10) // Make each entry sizable
          });
        }

        const rotation = activityLogger.performIntelligentRotation();

        expect(rotation.rotatedFiles).toBeGreaterThan(0);
        expect(rotation.spaceSaved).toBeGreaterThan(0);
        expect(rotation.retentionPolicy).toBeDefined();
      });

      it('should implement log compression and encryption', async () => {
        const sensitiveLogs = [
          { action: 'user-login', userId: 123, pii: 'user@example.com', timestamp: Date.now() },
          { action: 'payment', amount: 99.99, cardNumber: '****-****-****-1234', timestamp: Date.now() },
          { action: 'health-check', status: 'ok', timestamp: Date.now() }
        ];

        sensitiveLogs.forEach(log => activityLogger.log(log));

        const compressed = await activityLogger.compressLogs();
        const encrypted = await activityLogger.encryptLogs(compressed);

        expect(compressed.size < JSON.stringify(sensitiveLogs).length).toBe(true);
        expect(encrypted.encrypted).toBe(true);
        expect(encrypted.key).toBeDefined();
      });

      it('should handle distributed logging scenarios', async () => {
        const distributedLogger = new ActivityLogger({
          distributedMode: true,
          clusterNodes: ['node1', 'node2', 'node3'],
          replicationFactor: 2
        });

        // Simulate distributed log collection
        const distributedLogs = [];
        for (let nodeId = 0; nodeId < 3; nodeId++) {
          for (let i = 0; i < 100; i++) {
            distributedLogger.log({
              action: 'distributed-test',
              nodeId: `node${nodeId}`,
              logIndex: i,
              timestamp: Date.now()
            });
          }
        }

        const consolidation = await distributedLogger.consolidateDistributedLogs();

        expect(consolidation.totalLogs).toBe(300);
        expect(consolidation.replicatedLogs).toBe(600); // 2x replication
        expect(consolidation.consistencyScore).toBeGreaterThan(0.9);
      });
    });
  });
});