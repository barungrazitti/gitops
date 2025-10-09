/**
 * aicommit CLI Action Handler Tests
 */

// Mock the AICommitGenerator class before any other modules are imported
const mockGenerate = jest.fn();
const mockConfig = jest.fn();
const mockSetup = jest.fn();
const mockHook = jest.fn();
const mockStats = jest.fn();

jest.mock('../src/index.js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      generate: mockGenerate,
      config: mockConfig,
      setup: mockSetup,
      hook: mockHook,
      stats: mockStats,
    };
  });
});

// Import the handlers after the mock is set up
const {
  handleGenerate,
  handleConfig,
  handleSetup,
  handleHook,
  handleStats,
} = require('../bin/aicommit.js');

describe('aicommit CLI Action Handlers', () => {

  beforeEach(() => {
    // Clear all mocks before each test
    mockGenerate.mockClear();
    mockConfig.mockClear();
    mockSetup.mockClear();
    mockHook.mockClear();
    mockStats.mockClear();
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('handleGenerate', () => {
    test('should call the generate method with options', async () => {
      const options = { provider: 'openai', cache: true };
      await handleGenerate(options);
      expect(mockGenerate).toHaveBeenCalledWith(options);
    });

    test('should log an error and exit if generate fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      mockGenerate.mockRejectedValue(new Error('Generate failed'));
      await handleGenerate({});

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Generate failed');
      expect(exitSpy).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('handleConfig', () => {
    test('should call the config method with options', async () => {
      const options = { list: true };
      await handleConfig(options);
      expect(mockConfig).toHaveBeenCalledWith(options);
    });
  });

  describe('handleSetup', () => {
    test('should call the setup method', async () => {
      await handleSetup();
      expect(mockSetup).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleHook', () => {
    test('should call the hook method with options', async () => {
      const options = { install: true };
      await handleHook(options);
      expect(mockHook).toHaveBeenCalledWith(options);
    });
  });

  describe('handleStats', () => {
    test('should call the stats method with options', async () => {
      const options = { reset: false };
      await handleStats(options);
      expect(mockStats).toHaveBeenCalledWith(options);
    });
  });
});