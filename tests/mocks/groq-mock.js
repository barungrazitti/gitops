/**
 * Mock for groq-sdk
 */

class Groq {
  constructor(options) {
    this.apiKey = options?.apiKey;
  }

  get chat() {
    return {
      completions: {
        create: async (options) => ({
          choices: [{
            message: {
              content: 'Mock commit message from Groq'
            }
          }]
        })
      }
    };
  }
}

module.exports = Groq;