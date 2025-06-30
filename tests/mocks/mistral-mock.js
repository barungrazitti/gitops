/**
 * Mock for @mistralai/mistralai
 */

class MistralClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(options) {
    return {
      choices: [{
        message: {
          content: 'Mock commit message from Mistral'
        }
      }]
    };
  }
}

module.exports = MistralClient;