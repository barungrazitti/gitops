const parseDiff = require('parse-diff');
const TokenCounter = require('./token-counter');
const EntityExtractor = require('./entity-extractor');

class DiffSummarizer {
  constructor() {
    this.tokenCounter = new TokenCounter();
    this.entityExtractor = new EntityExtractor();
  }

  extractFileChunks(diff) {
    if (!diff || typeof diff !== 'string') {
      return [];
    }

    const parsed = parseDiff(diff);
    const chunks = [];

    for (const file of parsed) {
      if (file.from || file.to) {
        chunks.push({
          fileName: file.to || file.from || 'unknown',
          fromFile: file.from,
          toFile: file.to,
          chunks: file.chunks || [],
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          binary: file.binary || false,
        });
      }
    }

    return chunks;
  }

  summarizeChunk(chunk, index, total) {
    if (!chunk || !chunk.content) {
      return {
        fileName: 'unknown',
        changeType: 'unknown',
        entities: { functions: [], classes: [], variables: [], all: [] },
        keyChanges: [],
        chunkIndex: index,
        totalChunks: total,
      };
    }

    const content = chunk.content;
    const entities = this.entityExtractor.extractEntities(content);
    const changeType = this.detectChangeType(content);
    const keyChanges = this.extractKeyChanges(content);

    return {
      fileName: chunk.fileName || 'unknown',
      changeType,
      entities,
      keyChanges: keyChanges.slice(0, 3),
      chunkIndex: index,
      totalChunks: total,
    };
  }

  detectChangeType(content) {
    if (!content) return 'unknown';

    const patterns = {
      feat: /add|new|implement|feature|create|introduce|enhance/i,
      fix: /fix|bug|error|issue|problem|resolve|correct|patch/i,
      refactor: /refactor|restructure|reorganize|clean|improve|reorganize/i,
      test: /test|spec|describe|it\(|expect|assert|coverage/i,
      perf: /performance|optimize|cache|memo|speed|fast|efficien|bottleneck/i,
      docs: /doc|readme|comment|documentation|guide/i,
      style: /style|format|lint|prettier|beautify|indent|whitespace/i,
      chore: /chore|config|setup|build|deploy/i,
    };

    let maxScore = 0;
    let detectedType = 'chore';

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = content.match(pattern);
      if (matches) {
        const score = matches.length;
        if (score > maxScore) {
          maxScore = score;
          detectedType = type;
        }
      }
    }

    return detectedType;
  }

  extractKeyChanges(content) {
    if (!content) return [];

    const changes = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const trimmed = line.substring(1).trim();
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          changes.push(trimmed);
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const trimmed = line.substring(1).trim();
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          changes.push(`Removed: ${trimmed}`);
        }
      }
    }

    return changes;
  }

  combineSummaries(summaries, conventional = false) {
    if (!summaries || summaries.length === 0) {
      return {
        combined: '',
        fileCount: 0,
        changeTypes: [],
        allEntities: [],
      };
    }

    const fileCount = summaries.length;
    const changeTypes = [...new Set(summaries.map((s) => s.changeType))];
    const allEntities = summaries.flatMap((s) => s.entities.all);
    const allKeyChanges = summaries.flatMap((s) => s.keyChanges);

    const combined = summaries
      .map((s, i) => {
        let summary = `[${i + 1}] ${s.fileName} (${s.changeType}): `;
        if (s.keyChanges.length > 0) {
          summary += s.keyChanges.slice(0, 2).join('; ');
        } else {
          const entityNames = s.entities.functions.slice(0, 2);
          if (entityNames.length > 0) {
            summary += entityNames.join(', ');
          } else {
            summary += 'No specific changes detected';
          }
        }
        return summary;
      })
      .join('\n');

    return {
      combined,
      fileCount,
      changeTypes,
      allEntities,
      allKeyChanges,
    };
  }
}

module.exports = DiffSummarizer;
