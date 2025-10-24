// Large test file to trigger chunking
function generateLargeCode() {
  const functions = [];

  for (let i = 0; i < 500; i++) {
    functions.push(`
function processItem${i}(item) {
  return {
    id: item.id || ${i},
    name: item.name || 'item-${i}',
    value: item.value || Math.random() * 100,
    processed: true,
    timestamp: new Date().toISOString(),
    metadata: {
      index: ${i},
      batch: Math.floor(${i} / 10),
      category: ${i} % 5 === 0 ? 'important' : 'normal'
    }
  };
}

function validateItem${i}(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid item at index ${i}');
  }
  
  if (!item.id && item.id !== 0) {
    throw new Error('Missing id at index ${i}');
  }
  
  return true;
}

class ItemProcessor${i} {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 5000,
      retries: options.retries || 3,
      batchSize: options.batchSize || 50,
      ...options
    };
    this.processed = new Map();
    this.errors = [];
  }
  
  async process(items) {
    const results = [];
    
    for (const item of items) {
      try {
        validateItem${i}(item);
        const processed = processItem${i}(item);
        this.processed.set(item.id, processed);
        results.push(processed);
      } catch (error) {
        this.errors.push({ item, error: error.message, index: ${i} });
      }
    }
    
    return results;
  }
  
  getStats() {
    return {
      processed: this.processed.size,
      errors: this.errors.length,
      successRate: (this.processed.size / (this.processed.size + this.errors.length)) * 100
    };
  }
}
`);
  }

  return functions.join("\n");
}

const largeCode = generateLargeCode();

module.exports = { generateLargeCode, largeCode };
