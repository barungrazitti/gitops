/**
 * Mock for cohere-ai
 */

class CohereClient {
  constructor(options) {
    this.apiKey = options?.apiKey;
  }

  async generate(options) {
    return {
      generations: [{
        text: 'Mock commit message from Cohere'
      }]
    };
  }
}

module.exports = { CohereClient };