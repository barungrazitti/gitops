
// Creating a large test file to reproduce hanging
function largeFunction1() {
  // Lots of code here
  const data = new Array(1000).fill(0).map((_, i) => i * 2);
  const result = data.filter(x => x % 2 === 0).map(x => x * 3);
  return result.reduce((a, b) => a + b, 0);
}

function largeFunction2() {
  // More code here
  const config = {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    }
  };
  return fetch(config.apiUrl, config);
}

function largeFunction3() {
  // Even more code
  class LargeClass {
    constructor() {
      this.data = [];
      this.metadata = {};
      this.cache = new Map();
    }
    
    async processData(input) {
      const processed = await this.transform(input);
      this.data.push(processed);
      return processed;
    }
    
    transform(item) {
      return {
        id: item.id,
        name: item.name,
        timestamp: Date.now(),
        processed: true
      };
    }
  }
  
  return new LargeClass();
}

function largeFunction4() {
  // Complex logic
  const operations = [
    (x) => x * 2,
    (x) => x + 1,
    (x) => Math.sqrt(x),
    (x) => Math.floor(x)
  ];
  
  return operations.reduce((acc, op) => op(acc), 42);
}

function largeFunction5() {
  // Database operations simulation
  const users = Array.from({length: 100}, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    active: i % 2 === 0
  }));
  
  return users.filter(user => user.active).map(user => ({
    ...user,
    displayName: user.name.toUpperCase()
  }));
}

