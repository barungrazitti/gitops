const FALSE_POSITIVES = new Set([
  'if',
  'for',
  'while',
  'return',
  'else',
  'case',
  'switch',
  'try',
  'catch',
  'throw',
  'new',
  'class',
  'function',
  'const',
  'let',
  'var',
  'import',
  'export',
  'default',
  'extends',
  'async',
  'await',
  'static',
  'public',
  'private',
  'protected',
  'this',
  'super',
  'typeof',
  'instanceof',
  'void',
  'null',
  'true',
  'false',
]);

class EntityExtractor {
  constructor() {
    this.functionPatterns = [
      /function\s+(\w+)/g,
      /const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/g,
      /(\w+)\s*:\s*function/g,
      /def\s+(\w+)/g,
      /public\s+(?:static\s+)?(\w+)\s*\(/g,
      /private\s+(?:static\s+)?(\w+)\s*\(/g,
      /(\w+)\s*\([^)]*\)\s*\{/g,
    ];

    this.classPatterns = [
      /class\s+(\w+)/g,
      /interface\s+(\w+)/g,
      /type\s+(\w+)\s*=/g,
      /enum\s+(\w+)/g,
    ];

    this.variablePatterns = [
      /(?:let|const|var)\s+(\w+)\s*=/g,
      /this\.(\w+)\s*=/g,
      /(\w+)\s*:\s*[^{]/g,
    ];
  }

  extractEntities(diff) {
    const result = {
      functions: [],
      classes: [],
      variables: [],
      all: [],
    };

    if (!diff || typeof diff !== 'string') {
      return result;
    }

    result.functions = this.extractFunctions(diff);
    result.classes = this.extractClasses(diff);
    result.variables = this.extractVariables(diff);

    result.all = [
      ...result.functions.map((f) => ({ name: f, type: 'function' })),
      ...result.classes.map((c) => ({ name: c, type: 'class' })),
      ...result.variables.map((v) => ({ name: v, type: 'variable' })),
    ];

    return result;
  }

  extractFunctions(diff) {
    const functions = new Set();

    for (const pattern of this.functionPatterns) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(diff)) !== null) {
        const name = match[1];
        if (name && !FALSE_POSITIVES.has(name) && name.length > 1) {
          functions.add(name);
        }
      }
    }

    return Array.from(functions).sort();
  }

  extractClasses(diff) {
    const classes = new Set();

    for (const pattern of this.classPatterns) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(diff)) !== null) {
        const name = match[1];
        if (name && !FALSE_POSITIVES.has(name) && name.length > 1) {
          classes.add(name);
        }
      }
    }

    return Array.from(classes).sort();
  }

  extractVariables(diff) {
    const variables = new Set();

    for (const pattern of this.variablePatterns) {
      const regex = new RegExp(pattern.source, 'g');
      let match;
      while ((match = regex.exec(diff)) !== null) {
        const name = match[1];
        if (name && !FALSE_POSITIVES.has(name) && name.length > 1) {
          variables.add(name);
        }
      }
    }

    return Array.from(variables).sort();
  }

  formatEntityListByType(entities) {
    const parts = [];

    if (entities.functions.length > 0) {
      parts.push(`Functions: ${entities.functions.join(', ')}`);
    }

    if (entities.classes.length > 0) {
      parts.push(`Classes: ${entities.classes.join(', ')}`);
    }

    if (entities.variables.length > 0) {
      parts.push(`Variables: ${entities.variables.join(', ')}`);
    }

    return parts.join('; ');
  }
}

module.exports = EntityExtractor;
