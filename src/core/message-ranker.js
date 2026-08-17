/**
 * A deep module for scoring, ranking, and validating commit messages.
 * Faithfully mirrors the commit ranking logic previously in index.js.
 */
class MessageRanker {
  selectBestMessages(messages, count = 3, diff = null) {
    if (!messages || messages.length === 0) return [];
    const uniqueMessages = [...new Set(messages)];
    const scored = uniqueMessages.map(msg => ({
      message: msg,
      score: this.scoreCommitMessage(msg, diff),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(item => item.message);
  }

  scoreCommitMessage(message, diff = null) {
    let score = 0;
    if (/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(message)) {
      score += 10;
    }
    const { length } = message;
    if (length >= 20 && length <= 100) {
      score += 5;
    } else if (length >= 10 && length <= 150) {
      score += 2;
    }
    if (message[0] === message[0].toUpperCase() && message[0] !== message[0].toLowerCase()) {
      score += 2;
    }
    if (!message.endsWith('.')) {
      score += 1;
    }
    const specificPatterns = [
      /\b[A-Z][a-zA-Z]*\b/,
      /\b\w+\(\)/,
      /\b(add|create|implement|remove|delete|update)\s+\w+/i,
      /\b(class|function|const|let|var)\s+\w+/i,
    ];
    specificPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        score += 3;
      }
    });
    const genericPatterns = [
      /\b(add|update|fix|change|modify|remove)\s+(functionality|features?|code|files?)\b/i,
      /\b(new|additional|extra)\s+(stuff|things|items)\b/i,
      /\b(general|misc|various|multiple)\s+(changes|updates|fixes)\b/i,
      /^\s*(improvements?|bug fix|updates?|refactor)\s*$/i,
    ];
    genericPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        score -= 20;
      }
    });
    const bannedPatterns = [/^\s*update\s*$/i, /^\s*fix\s*$/i, /^\s*commit\s*$/i, /^\s*changes\s*$/i];
    bannedPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        score = -100;
      }
    });
    if (message.split(' ').length <= 3 && !/[A-Z]\w+/.test(message)) {
      score -= 3;
    }
    if (diff) {
      score += this.calculateRelevanceScore(message, diff);
    }
    return score;
  }

  calculateRelevanceScore(message, diff) {
    let relevanceScore = 0;
    const entitiesFromDiff = this.extractEntitiesFromDiff(diff);
    const messageKeywords = this.extractKeywordsFromMessage(message);
    const entityOverlap = this.calculateEntityOverlap(entitiesFromDiff, messageKeywords);
    relevanceScore += entityOverlap * 8;
    if (this.checkTypeMatch(message, diff)) {
      relevanceScore += 5;
    }
    if (this.checkScopeMatch(message, diff)) {
      relevanceScore += 3;
    }
    if (this.isMessageTooGenericForDiff(message, diff)) {
      relevanceScore -= 10;
    }
    return relevanceScore;
  }

  extractEntitiesFromDiff(diff) {
    const entities = {
      functions: { added: [], removed: [] },
      classes: { added: [], removed: [] },
      variables: { added: [], removed: [] },
      filenames: { added: [], removed: [] },
      fileTypes: { added: [], removed: [] },
      methods: { added: [], removed: [] },
    };
    const fileMatches = diff.match(/diff --git a\/(.+?) b\/(.+)/g) || [];
    for (const match of fileMatches) {
      const fileMatch = match.match(/diff --git a\/(.+?) b\/(.+)/);
      if (fileMatch) {
        const filePath = fileMatch[2];
        entities.filenames.added.push(filePath);
        const ext = filePath.split('.').pop();
        if (ext) entities.fileTypes.added.push(ext);
      }
    }
    const lines = diff.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---'));
    const addedDiff = addedLines.join('\n');
    const removedDiff = removedLines.join('\n');
    const functionMatchesAdded = addedDiff.match(/(?:function\s+|def\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of functionMatchesAdded) {
      const funcName = match.replace(/(?:function\s+|def\s+)/, '').trim();
      if (funcName) entities.functions.added.push(funcName);
    }
    const functionMatchesRemoved = removedDiff.match(/(?:function\s+|def\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of functionMatchesRemoved) {
      const funcName = match.replace(/(?:function\s+|def\s+)/, '').trim();
      if (funcName) entities.functions.removed.push(funcName);
    }
    const classMatchesAdded = addedDiff.match(/(?:class\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of classMatchesAdded) {
      const className = match.replace('class\s+', '').replace('class ', '').trim();
      if (className) entities.classes.added.push(className);
    }
    const classMatchesRemoved = removedDiff.match(/(?:class\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of classMatchesRemoved) {
      const className = match.replace('class\s+', '').replace('class ', '').trim();
      if (className) entities.classes.removed.push(className);
    }
    const varMatchesAdded = addedDiff.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of varMatchesAdded) {
      const varName = match.replace(/(?:const|let|var)\s+/, '').trim();
      if (varName) entities.variables.added.push(varName);
    }
    const varMatchesRemoved = removedDiff.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of varMatchesRemoved) {
      const varName = match.replace(/(?:const|let|var)\s+/, '').trim();
      if (varName) entities.variables.removed.push(varName);
    }
    const methodMatchesAdded = addedDiff.match(/[A-Za-z_][A-Za-z0-9_]*\s*:\s*function|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) || [];
    for (const match of methodMatchesAdded) {
      const methodName = match.replace(/\s*:\s*function|\s*\(/, '').trim();
      if (methodName && !entities.functions.added.includes(methodName)) {
        entities.methods.added.push(methodName);
      }
    }
    const methodMatchesRemoved = removedDiff.match(/[A-Za-z_][A-Za-z0-9_]*\s*:\s*function|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) || [];
    for (const match of methodMatchesRemoved) {
      const methodName = match.replace(/\s*:\s*function|\s*\(/, '').trim();
      if (methodName && !entities.functions.removed.includes(methodName)) {
        entities.methods.removed.push(methodName);
      }
    }
    const importMatchesAdded = addedDiff.match(/(?:import|from|require)\s*.*?['"`]([^'"`]+)['"`]/g) || [];
    for (const match of importMatchesAdded) {
      const importName = match.replace(/(?:import|from|require)\s*/, '').replace(/['"`].*?['"`]/, '').trim();
      if (importName) entities.variables.added.push(importName);
    }
    const importMatchesRemoved = removedDiff.match(/(?:import|from|require)\s*.*?['"`]([^'"`]+)['"`]/g) || [];
    for (const match of importMatchesRemoved) {
      const importName = match.replace(/(?:import|from|require)\s*/, '').replace(/['"`].*?['"`]/, '').trim();
      if (importName) entities.variables.removed.push(importName);
    }
    return entities;
  }

  extractKeywordsFromMessage(message) {
    const content = message.replace(/^[a-z]+(\([^)]+\))?:\s*/, '');
    const words = content.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !this.isCommonStopWord(word));
    return [...new Set(words)];
  }

  isCommonStopWord(word) {
    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','this','that','these','those','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','what','which','who','when','where','why','how','if','then','else','so','than','too','very','just','now','up','down','out','off','over','under','again','further','once']);
    return stopWords.has(word.toLowerCase());
  }

  calculateEntityOverlap(entities, messageKeywords) {
    let overlapCount = 0;
    for (const func of entities.functions.added) {
      const funcName = func.toLowerCase();
      if (messageKeywords.some(keyword => funcName.includes(keyword) || keyword.includes(funcName))) overlapCount += 2;
    }
    for (const func of entities.functions.removed) {
      const funcName = func.toLowerCase();
      if (messageKeywords.some(keyword => funcName.includes(keyword) || keyword.includes(funcName))) overlapCount += 1;
    }
    for (const cls of entities.classes.added) {
      const className = cls.toLowerCase();
      if (messageKeywords.some(keyword => className.includes(keyword) || keyword.includes(className))) overlapCount += 2;
    }
    for (const cls of entities.classes.removed) {
      const className = cls.toLowerCase();
      if (messageKeywords.some(keyword => className.includes(keyword) || keyword.includes(className))) overlapCount += 1;
    }
    for (const varName of entities.variables.added) {
      const varNameLower = varName.toLowerCase();
      if (messageKeywords.some(keyword => varNameLower.includes(keyword) || keyword.includes(varNameLower))) overlapCount += 2;
    }
    for (const varName of entities.variables.removed) {
      const varNameLower = varName.toLowerCase();
      if (messageKeywords.some(keyword => varNameLower.includes(keyword) || keyword.includes(varNameLower))) overlapCount += 1;
    }
    for (const file of entities.filenames.added) {
      const fileName = file.toLowerCase().replace(/\.[^/.]+$/, '');
      const fileNameParts = fileName.split(/[\/\\]/);
      for (const part of fileNameParts) {
        if (messageKeywords.some(keyword => part.includes(keyword) || keyword.includes(part))) {
          overlapCount += 1; break;
        }
      }
    }
    return overlapCount;
  }

  checkTypeMatch(message, diff) {
    const typeMatch = message.match(/^([a-z]+)(\(.+\))?:/);
    if (!typeMatch) return false;
    const changeType = typeMatch[1];
    const diffIndicators = {
      feat: /(\+.*function|\+.*class|\+.*def|\+.*export|\+.*import)/.test(diff),
      fix: /(\-.*bug|\-.*error|\-.*issue|\+.*correct|\+.*resolve|\+.*patch)/i.test(diff),
      docs: /(\+.*\.(md|txt|rst)|\+.*README|\+.*documentation)/i.test(diff),
      refactor: /(\+.*refactor|\+.*restructure|\-.*\s+\+.*\s+.*reorganized)/.test(diff),
      test: /(\+.*test|\+.*spec|\+.*describe|\+.*it\(|\+.*expect|\+.*assert)/i.test(diff),
      style: /(\+.*css|\+.*style|\+.*format|\+.*indent|\+.*prettier)/i.test(diff),
    };
    return diffIndicators[changeType] || false;
  }

  checkScopeMatch(message, diff) {
    const scopeMatch = message.match(/^[a-z]+\(([^)]+)\):/);
    if (!scopeMatch) return false;
    const scope = scopeMatch[1];
    const entities = this.extractEntitiesFromDiff(diff);
    const fileTypes = entities.fileTypes.added;
    const scopeTypeMap = {
      api: ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      ui: ['jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less'],
      auth: ['js', 'ts', 'py', 'php', 'java', 'go'],
      db: ['sql', 'js', 'ts', 'py', 'php'],
      config: ['json', 'yaml', 'yml', 'env', 'xml', 'toml', 'conf'],
      test: ['test.js', 'spec.js', 'test.ts', 'spec.ts', 'test.py', 'spec.rb'],
      docs: ['md', 'txt', 'rst', 'adoc', 'tex'],
      build: ['js', 'ts', 'json', 'lock', 'yml', 'yaml', 'sh', 'gradle', 'xml'],
      ci: ['yml', 'yaml', 'sh', 'json'],
      utils: ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      types: ['ts', 'js', 'py', 'java', 'go'],
      perf: ['js', 'ts', 'py', 'java', 'go', 'php'],
      deps: ['json', 'lock', 'yml', 'yaml', 'xml', 'txt'],
    };
    if (scopeTypeMap[scope]) {
      return fileTypes.some(type => scopeTypeMap[scope].includes(type));
    }
    return false;
  }

  isMessageTooGenericForDiff(message, diff) {
    const entities = this.extractEntitiesFromDiff(diff);
    const hasSpecificEntities =
      entities.functions.added.length > 0 || entities.classes.added.length > 0 || entities.variables.added.length > 0;
    const genericTerms = [
      /\bchanges?\b/i, /\bupdates?\b/i, /\bfixes?\b/i, /\bstuff\b/i, /\bthings?\b/i,
      /\bvarious\b/i, /\bimprovements?\b/i, /\benhancements?\b/i,
    ];
    const hasGenericTerms = genericTerms.some(regex => regex.test(message));
    return hasSpecificEntities && hasGenericTerms;
  }
}

module.exports = MessageRanker;
