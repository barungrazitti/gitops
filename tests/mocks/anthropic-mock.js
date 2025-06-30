/**
 * Mock for @anthropic-ai/sdk
 */

class Anthropic {
  constructor(options) {
    this.apiKey = options?.apiKey;
  }

  get messages() {
    return {
      create: async (options) => ({
        content: [{
          text: 'Mock commit message from Anthropic'
        }]
      })
    };
  }
}

module.exports = Anthropic;