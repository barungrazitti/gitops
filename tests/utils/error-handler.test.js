/**
 * ErrorHandler Tests
 */

describe('ErrorHandler', () => {
  let ErrorHandler;

  beforeEach(() => {
    jest.resetModules();
    ErrorHandler = require('../../src/utils/error-handler');
  });

  describe('handleError', () => {
    it('should handle 401 authentication error', () => {
      const error = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'TestProvider')).toThrow(
        'Authentication failed for TestProvider. Please check your API key.'
      );
    });

    it('should handle 403 forbidden error', () => {
      const error = {
        response: {
          status: 403,
          data: { error: { message: 'Access denied' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'TestProvider')).toThrow(
        'Access forbidden for TestProvider. Please check your permissions.'
      );
    });

    it('should handle 429 rate limit error', () => {
      const error = {
        response: {
          status: 429,
          data: { error: { message: 'Too many requests' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'TestProvider')).toThrow(
        'Rate limit exceeded for TestProvider. Please try again later.'
      );
    });

    it('should handle 500 server error', () => {
      const error = {
        response: {
          status: 500,
          data: { error: { message: 'Internal error' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'TestProvider')).toThrow(
        'TestProvider service is temporarily unavailable. Please try again later.'
      );
    });

    it('should handle connection refused error', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      expect(() => ErrorHandler.handleError(error, 'Ollama')).toThrow(
        'Cannot connect to Ollama. Please check your internet connection.'
      );
    });

    it('should handle timeout error', () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'Request timed out',
      };

      expect(() => ErrorHandler.handleError(error, 'Groq')).toThrow(
        'Request to Groq timed out. Please try again.'
      );
    });

    it('should handle generic error', () => {
      const error = {
        message: 'Something went wrong',
      };

      expect(() => ErrorHandler.handleError(error, 'Provider')).toThrow(
        'Provider error: Something went wrong'
      );
    });

    it('should handle error with undefined message', () => {
      const error = {};

      expect(() => ErrorHandler.handleError(error, 'Provider')).toThrow(
        'Provider error: Unknown error occurred'
      );
    });

    it('should handle error with no response and no code', () => {
      const error = new Error('Network error');

      expect(() => ErrorHandler.handleError(error, 'Provider')).toThrow(
        'Provider error: Network error'
      );
    });

    it('should handle 502 bad gateway error', () => {
      const error = {
        response: {
          status: 502,
          data: { error: { message: 'Bad gateway' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'Provider')).toThrow(
        'Provider service is temporarily unavailable. Please try again later.'
      );
    });

    it('should handle 503 service unavailable error', () => {
      const error = {
        response: {
          status: 503,
          data: { error: { message: 'Service unavailable' } },
        },
      };

      expect(() => ErrorHandler.handleError(error, 'Provider')).toThrow(
        'Provider service is temporarily unavailable. Please try again later.'
      );
    });
  });
});