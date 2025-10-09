/**
 * OpenAIProvider Tests
 */

const OpenAIProvider = require('../src/providers/openai-provider');

describe('OpenAIProvider', () => {
  let provider;
  let mockCreate;

  beforeEach(() => {
    // Instantiate the provider
    provider = new OpenAIProvider();

    // Mock the internal client and its methods before they are used
    mockCreate = jest.fn();
    provider.client = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    // Mock getConfig to avoid file system access and return a valid config
    jest.spyOn(provider, 'getConfig').mockResolvedValue({
      apiKey: 'test-key',
      model: 'gpt-3.5-turbo',
      retries: 1,
    });

    // Spy on initializeClient to ensure it's called, but prevent it from running the real implementation
    jest.spyOn(provider, 'initializeClient').mockResolvedValue();
  });

  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
  });

  test('should generate commit messages successfully', async () => {
    const mockResponse = {
      choices: [
        { message: { content: 'feat: Add new feature\nfix: Resolve bug' } },
      ],
    };
    mockCreate.mockResolvedValue(mockResponse);

    const messages = await provider.generateCommitMessages('diff...');

    // Ensure the client was initialized and the create method was called
    expect(provider.initializeClient).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-3.5-turbo',
    }));

    // Verify that the response is parsed correctly
    expect(messages).toEqual(['feat: Add new feature', 'fix: Resolve bug']);
  });

  test('should handle API errors gracefully', async () => {
    const apiError = new Error('Request failed with status code 500');
    mockCreate.mockRejectedValue(apiError);

    // The provider's handleError method is expected to catch the API error and re-throw a formatted error
    await expect(provider.generateCommitMessages('diff...')).rejects.toThrow('OpenAI error: Request failed with status code 500');
  });
});