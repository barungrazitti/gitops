/**
 * Mock for @google/generative-ai
 */

class GoogleGenerativeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  getGenerativeModel(options) {
    return {
      generateContent: async (prompt) => ({
        response: {
          text: () => 'Mock commit message from Gemini'
        }
      })
    };
  }
}

module.exports = { GoogleGenerativeAI };