/**
 * ConfigManager Tests
 */

const ConfigManager = require('../src/core/config-manager.js');

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    configManager.config.clear(); // Clear any stored config before each test
  });

  afterEach(() => {
    configManager.config.clear(); // Clean up after each test
  });

  test('should instantiate correctly', () => {
    expect(configManager).toBeInstanceOf(ConfigManager);
  });

  test('should load default configuration', async () => {
    const config = await configManager.load();
    const defaults = configManager.getDefaults();
    expect(config).toEqual(expect.objectContaining(defaults));
  });

  test('should set and get a configuration value', async () => {
    await configManager.set('defaultProvider', 'anthropic');
    const provider = await configManager.get('defaultProvider');
    expect(provider).toBe('anthropic');
  });

  test('should set multiple configuration values', async () => {
    const newConfig = {
      defaultProvider: 'gemini',
      language: 'fr',
    };
    await configManager.setMultiple(newConfig);
    const provider = await configManager.get('defaultProvider');
    const lang = await configManager.get('language');
    expect(provider).toBe('gemini');
    expect(lang).toBe('fr');
  });

  test('should reset configuration to defaults', async () => {
    await configManager.set('defaultProvider', 'ollama');
    await configManager.reset();
    const provider = await configManager.get('defaultProvider');
    const defaults = configManager.getDefaults();
    expect(provider).toBe(defaults.defaultProvider);
  });

  test('should not allow invalid provider', async () => {
    await expect(configManager.set('defaultProvider', 'invalid-provider')).rejects.toThrow();
  });

  test('should get provider-specific configuration', async () => {
    const openaiConfig = await configManager.getProviderConfig('openai');
    expect(openaiConfig.model).toBe('gpt-3.5-turbo');

    const ollamaConfig = await configManager.getProviderConfig('ollama');
    expect(ollamaConfig.baseURL).toBe('http://localhost:11434');
  });

  test('should validate API key for providers that require it', async () => {
    await expect(configManager.validateApiKey('openai')).rejects.toThrow();
    await configManager.set('apiKey', 'test-key');
    await expect(configManager.validateApiKey('openai')).resolves.toBe(true);
  });

  test('should not require API key for ollama', async () => {
    await expect(configManager.validateApiKey('ollama')).resolves.toBe(true);
  });
});