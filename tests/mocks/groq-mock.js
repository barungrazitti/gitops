/**
 * Mock for groq-sdk module
 */

class MockGroq {
  constructor() {
    this.chat = {
      completions: {
        create: jest.fn(),
      },
    };
  }
}

module.exports = MockGroq;
module.exports.default = MockGroq;
