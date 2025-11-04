/**
 * Activity Logger - Comprehensive logging system for AI Commit Generator
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Conf = require('conf');

class ActivityLogger {
  constructor() {
    this.config = new Conf({
      projectName: 'ai-commit-generator-logger',
      defaults: {
        logLevel: 'info', // debug, info, warn, error
        maxLogFiles: 50, // Keep last 50 log files
        maxLogSize: 10 * 1024 * 1024, // 10MB per file
        logRetentionDays: 30, // Keep logs for 30 days
      },
    });

    this.logDir = path.join(os.homedir(), '.ai-commit-generator', 'logs');
    this.sessionId = this.generateSessionId();
    this.currentLogFile = null;
    
    this.initializeLogDirectory();
  }

  /**
   * Initialize logging directory
   */
  async initializeLogDirectory() {
    try {
      await fs.ensureDir(this.logDir);
      await this.cleanOldLogs();
      this.currentLogFile = path.join(this.logDir, `activity-${this.getDateString()}.log`);
    } catch (error) {
      console.warn('Failed to initialize log directory:', error.message);
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current date string for log filename
   */
  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Clean old log files based on retention policy
   */
  async cleanOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.get('logRetentionDays'));

      const logFiles = files.filter(file => file.startsWith('activity-') && file.endsWith('.log'));
      
      // Sort by creation time and keep only the most recent N files
      const fileStats = await Promise.all(
        logFiles.map(async file => {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          return {
            file,
            filePath,
            created: stats.birthtime || stats.ctime,
            size: stats.size,
          };
        })
      );

      // Sort by creation time (newest first)
      fileStats.sort((a, b) => b.created - a.created);

      const maxFiles = this.config.get('maxLogFiles');
      const filesToKeep = fileStats.slice(0, maxFiles);
      const filesToDelete = fileStats.slice(maxFiles);

      // Delete files older than retention date
      const allFilesToDelete = [
        ...filesToDelete,
        ...fileStats.filter(f => f.created < retentionDate)
      ];

      for (const { filePath, file } of allFilesToDelete) {
        try {
          await fs.remove(filePath);
          console.log(`Cleaned old log file: ${file}`);
        } catch (error) {
          console.warn(`Failed to delete log file ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to clean old logs:', error.message);
    }
  }

  /**
   * Log an activity with structured data
   */
  async logActivity(level, action, data = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: level.toUpperCase(),
      action,
      data,
      system: {
        platform: os.platform(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      if (this.currentLogFile) {
        await fs.appendFile(this.currentLogFile, logLine);
        
        // Check file size and rotate if needed
        const stats = await fs.stat(this.currentLogFile);
        const maxSize = this.config.get('maxLogSize');
        
        if (stats.size > maxSize) {
          await this.rotateLogFile();
        }
      }
    } catch (error) {
      console.warn('Failed to write to log file:', error.message);
    }

    // Also log to console for immediate feedback
    this.logToConsole(level, action, data);
  }

  /**
   * Check if we should log at this level
   */
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = this.config.get('logLevel');
    return levels[level] >= levels[configLevel];
  }

  /**
   * Log to console with formatting
   */
  logToConsole(level, action, data) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] ${action}`;
    
    switch (level) {
      case 'debug':
        console.debug(prefix, data);
        break;
      case 'info':
        console.info(prefix, data);
        break;
      case 'warn':
        console.warn(prefix, data);
        break;
      case 'error':
        console.error(prefix, data);
        break;
    }
  }

  /**
   * Rotate log file when it gets too large
   */
  async rotateLogFile() {
    try {
      const baseName = path.basename(this.currentLogFile, '.log');
      const rotatedFile = path.join(this.logDir, `${baseName}-${Date.now()}.log`);
      await fs.move(this.currentLogFile, rotatedFile);
      console.log(`Rotated log file: ${path.basename(rotatedFile)}`);
    } catch (error) {
      console.warn('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async debug(action, data) {
    await this.logActivity('debug', action, data);
  }

  async info(action, data) {
    await this.logActivity('info', action, data);
  }

  async warn(action, data) {
    await this.logActivity('warn', action, data);
  }

  async error(action, data) {
    await this.logActivity('error', action, data);
  }

  /**
   * Log AI provider interaction
   */
  async logAIInteraction(provider, type, prompt, response, responseTime, success) {
    await this.info('ai_interaction', {
      provider,
      type, // 'commit_generation' or 'conflict_resolution'
      promptLength: prompt?.length || 0,
      responseLength: response?.length || 0,
      responseTime,
      success,
      timestamp: Date.now(),
      // Log the actual prompt for analysis (truncated if too large)
      prompt: prompt && prompt.length > 10000 ? prompt.substring(0, 10000) + '...[TRUNCATED]' : prompt,
      // Log the actual response for quality analysis (truncated if too large)
      response: response && response.length > 2000 ? response.substring(0, 2000) + '...[TRUNCATED]' : response,
    });
  }

  /**
   * Log git operation
   */
  async logGitOperation(operation, details = {}) {
    await this.info('git_operation', {
      operation, // 'commit', 'pull', 'push', 'merge'
      ...details,
      timestamp: Date.now(),
    });
  }

  /**
   * Log conflict resolution
   */
  async logConflictResolution(files, strategy, success, details = {}) {
    await this.info('conflict_resolution', {
      conflictedFiles: files,
      strategy, // 'ai', 'ours', 'theirs', 'manual'
      success,
      resolutionTime: details.resolutionTime,
      fallbackUsed: details.fallbackUsed,
      chunkingUsed: details.chunkingUsed,
      timestamp: Date.now(),
      ...details,
    });
  }

  /**
   * Log commit message generation
   */
  async logCommitGeneration(diff, generatedMessages, selectedMessage, context, provider) {
    await this.info('commit_generation', {
      diffLength: diff?.length || 0,
      generatedMessagesCount: generatedMessages?.length || 0,
      selectedMessageLength: selectedMessage?.length || 0,
      selectedMessage,
      provider,
      hasSemanticContext: context?.hasSemanticContext,
      projectType: context?.project?.primary,
      fileTypes: context?.files?.fileTypes,
      scope: context?.files?.scope,
      timestamp: Date.now(),
    });
  }

  /**
   * Get recent logs for analysis
   */
  async getRecentLogs(days = 7) {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('activity-') && file.endsWith('.log'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentLogs = [];
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime >= cutoffDate) {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line);
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (new Date(entry.timestamp) >= cutoffDate) {
                recentLogs.push(entry);
              }
            } catch (parseError) {
              // Skip malformed lines
            }
          }
        }
      }
      
      return recentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.warn('Failed to read recent logs:', error.message);
      return [];
    }
  }

  /**
   * Analyze logs for insights
   */
  async analyzeLogs(days = 30) {
    const logs = await this.getRecentLogs(days);
    
    const analysis = {
      totalSessions: new Set(logs.map(l => l.sessionId)).size,
      aiInteractions: logs.filter(l => l.action === 'ai_interaction').length,
      successfulCommits: logs.filter(l => l.action === 'git_operation' && l.data.operation === 'commit').length,
      conflictResolutions: logs.filter(l => l.action === 'conflict_resolution').length,
      providerUsage: {},
      averageResponseTime: 0,
      commonErrors: {},
      peakUsageHours: {},
      messagePatterns: {},
    };

    // Analyze provider usage
    const aiLogs = logs.filter(l => l.action === 'ai_interaction');
    aiLogs.forEach(log => {
      const provider = log.data.provider;
      analysis.providerUsage[provider] = (analysis.providerUsage[provider] || 0) + 1;
      
      if (log.data.responseTime) {
        analysis.averageResponseTime += log.data.responseTime;
      }
    });

    if (aiLogs.length > 0) {
      analysis.averageResponseTime = Math.round(analysis.averageResponseTime / aiLogs.length);
    }

    // Analyze errors
    const errorLogs = logs.filter(l => l.level === 'ERROR');
    errorLogs.forEach(log => {
      const errorType = log.data.error || log.action;
      analysis.commonErrors[errorType] = (analysis.commonErrors[errorType] || 0) + 1;
    });

    // Analyze usage patterns
    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      analysis.peakUsageHours[hour] = (analysis.peakUsageHours[hour] || 0) + 1;
    });

    // Analyze commit message patterns
    const commitLogs = logs.filter(l => l.action === 'commit_generation');
    commitLogs.forEach(log => {
      if (log.data.selectedMessage) {
        const message = log.data.selectedMessage;
        const type = this.extractCommitType(message);
        analysis.messagePatterns[type] = (analysis.messagePatterns[type] || 0) + 1;
      }
    });

    return analysis;
  }

  /**
   * Extract commit type from message
   */
  extractCommitType(message) {
    const match = message.match(/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/);
    return match ? match[1] : 'other';
  }

  /**
   * Export logs for external analysis
   */
  async exportLogs(days = 30, format = 'json') {
    const logs = await this.getRecentLogs(days);
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    } else if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }
    
    return logs;
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';
    
    const headers = ['timestamp', 'sessionId', 'level', 'action', 'provider', 'operation', 'success', 'responseTime'];
    const csvLines = [headers.join(',')];
    
    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.sessionId,
        log.level,
        log.action,
        log.data.provider || '',
        log.data.operation || '',
        log.data.success !== undefined ? log.data.success : '',
        log.data.responseTime || '',
      ];
      csvLines.push(row.join(','));
    });
    
    return csvLines.join('\n');
  }
}

module.exports = ActivityLogger;