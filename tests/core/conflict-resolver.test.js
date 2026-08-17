jest.mock('../../src/providers/ai-provider-factory', () => ({
  create: jest.fn(),
}));

const AIProviderFactory = require('../../src/providers/ai-provider-factory');
const ConflictResolver = require('../../src/core/conflict-resolver');

describe('ConflictResolver', () => {
  let resolver;
  let deps;
  let mockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    deps = {
      configManager: { getAll: jest.fn().mockResolvedValue({ defaultProvider: 'groq' }) },
      gitManager: { getStagedDiff: jest.fn() },
      activityLogger: { warn: jest.fn().mockResolvedValue(), info: jest.fn().mockResolvedValue() },
    };

    mockProvider = {
      generateResponse: jest.fn(),
    };
    AIProviderFactory.create.mockReturnValue(mockProvider);

    resolver = new ConflictResolver(deps);
  });

  describe('resolveConflictWithAI(conflictCtx) — single object interface', () => {
    const conflictCtx = {
      filePath: 'src/auth.js',
      currentVersion: 'const token = getCurrent();',
      incomingVersion: 'const token = getRefreshed();',
      language: 'javascript',
    };

    it('returns the resolved content from the provider', async () => {
      mockProvider.generateResponse.mockResolvedValue('const token = getRefreshed();');

      const result = await resolver.resolveConflictWithAI(conflictCtx);

      expect(result).toBe('const token = getRefreshed();');
    });

    it('preserves context: both versions and filePath reach the prompt', async () => {
      mockProvider.generateResponse.mockResolvedValue('resolved');

      await resolver.resolveConflictWithAI(conflictCtx);

      const [prompt] = mockProvider.generateResponse.mock.calls[0];
      expect(prompt).toContain('src/auth.js');
      expect(prompt).toContain('const token = getCurrent();');
      expect(prompt).toContain('const token = getRefreshed();');
    });

    it('redacts secrets before sending content to the provider', async () => {
      mockProvider.generateResponse.mockResolvedValue('resolved');

      await resolver.resolveConflictWithAI({
        ...conflictCtx,
        currentVersion: 'const key = "sk-1234567890abcdefghij";',
      });

      const [prompt] = mockProvider.generateResponse.mock.calls[0];
      expect(prompt).not.toContain('sk-1234567890abcdefghij');
    });

    it('uses generateResponse (never commit-message generation)', async () => {
      mockProvider.generateResponse.mockResolvedValue('resolved');

      await resolver.resolveConflictWithAI(conflictCtx);

      expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('strips markdown fences from the response', async () => {
      mockProvider.generateResponse.mockResolvedValue('```javascript\nresolved code\n```');

      const result = await resolver.resolveConflictWithAI(conflictCtx);

      expect(result).toBe('resolved code');
    });

    it('falls back to currentVersion when the provider fails', async () => {
      mockProvider.generateResponse.mockRejectedValue(new Error('provider down'));

      const result = await resolver.resolveConflictWithAI(conflictCtx);

      expect(result).toBe(conflictCtx.currentVersion);
    });

    it('falls back to currentVersion when the response is empty', async () => {
      mockProvider.generateResponse.mockResolvedValue('   ');

      const result = await resolver.resolveConflictWithAI(conflictCtx);

      expect(result).toBe(conflictCtx.currentVersion);
      expect(deps.activityLogger.warn).toHaveBeenCalledWith(
        'conflict_resolution_empty_response',
        expect.anything()
      );
    });

    it('rejects non-object call shapes (no positional arguments)', async () => {
      await expect(
        resolver.resolveConflictWithAI('src/auth.js', 'current', 'incoming')
      ).rejects.toThrow('requires { filePath, currentVersion, incomingVersion }');

      await expect(resolver.resolveConflictWithAI(null)).rejects.toThrow(
        'requires { filePath, currentVersion, incomingVersion }'
      );
    });
  });
});
