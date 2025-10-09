/**
 * BaseProvider Tests
 */

const BaseProvider = require('../src/providers/base-provider');

describe('BaseProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new BaseProvider();
  });

  describe('parseResponse', () => {
    test('should parse a numbered list of messages', () => {
      const response = '1. feat: first message\n2. fix: second message\n3. chore: third message';
      const messages = provider.parseResponse(response);
      // The parseResponse method is designed to strip numbering.
      expect(messages).toEqual(['feat: first message', 'fix: second message', 'chore: third message']);
    });

    test('should parse a list of messages with bullet points', () => {
      const response = '- feat: first message\n- fix: second message';
      const messages = provider.parseResponse(response);
      expect(messages).toEqual(['feat: first message', 'fix: second message']);
    });

    test('should handle a single-line response', () => {
      const response = 'feat: a single message';
      const messages = provider.parseResponse(response);
      expect(messages).toEqual(['feat: a single message']);
    });

    test('should throw an error for an empty response', () => {
      expect(() => provider.parseResponse('')).toThrow('No valid commit messages found in AI response');
    });

    test('should throw an error for an invalid response type', () => {
      expect(() => provider.parseResponse(null)).toThrow('Invalid response from AI provider');
    });
  });

  describe('handleError', () => {
    test('should throw a specific error for 401 status', () => {
      const error = { response: { status: 401 } };
      expect(() => provider.handleError(error, 'TestProvider')).toThrow('Authentication failed for TestProvider. Please check your API key.');
    });

    test('should throw a specific error for 429 status', () => {
      const error = { response: { status: 429 } };
      expect(() => provider.handleError(error, 'TestProvider')).toThrow('Rate limit exceeded for TestProvider. Please try again later.');
    });

    test('should throw a generic API error for other statuses', () => {
      const error = { response: { status: 404, statusText: 'Not Found' } };
      expect(() => provider.handleError(error, 'TestProvider')).toThrow('TestProvider API error (404): Not Found');
    });

    test('should throw a timeout error', () => {
      const error = { code: 'ETIMEDOUT' };
      expect(() => provider.handleError(error, 'TestProvider')).toThrow('Request to TestProvider timed out. Please try again.');
    });
  });

  describe('withRetry', () => {
    test('should return the result on the first attempt if successful', async () => {
      const successfulFunction = jest.fn().mockResolvedValue('success');
      const result = await provider.withRetry(successfulFunction, 3);

      expect(result).toBe('success');
      expect(successfulFunction).toHaveBeenCalledTimes(1);
    });

    test('should retry and succeed if the function fails once', async () => {
      const failingFunction = jest.fn()
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValue('success');

      const result = await provider.withRetry(failingFunction, 3, 10); // Use short delay for test

      expect(result).toBe('success');
      expect(failingFunction).toHaveBeenCalledTimes(2);
    });

    test('should throw the last error after exhausting all retries', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(provider.withRetry(failingFunction, 3, 10)).rejects.toThrow('Persistent error');
      expect(failingFunction).toHaveBeenCalledTimes(3);
    });

    test('should not retry on authentication errors', async () => {
      const authError = new Error('Authentication failed');
      authError.response = { status: 401 }; // Simulate an API error response
      const failingFunction = jest.fn().mockRejectedValue(authError);

      await expect(provider.withRetry(failingFunction, 3, 10)).rejects.toThrow('Authentication failed');
      expect(failingFunction).toHaveBeenCalledTimes(1);
    });
  });
});