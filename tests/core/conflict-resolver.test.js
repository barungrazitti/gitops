jest.mock('../../src/providers/ai-provider-factory', () => ({
  create: jest.fn(),
}));
jest.mock('fs-extra');

const fs = require('fs-extra');
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

  describe('parseConflictBlocks — real line indices', () => {
    it('reports exact line positions even with duplicate lines', () => {
      const content = `const a = 1;
<<<<<<< HEAD
const kept = 'first';
=======
const kept = 'incoming';
>>>>>>> branch
const a = 1;
<<<<<<< HEAD
const second = 2;
=======
const second = 3;
>>>>>>> branch`;

      const conflicts = resolver.parseConflictBlocks(content);

      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].startLine).toBe(1);
      expect(conflicts[0].endLine).toBe(5);
      expect(conflicts[0].currentVersion).toBe("const kept = 'first';");
      expect(conflicts[0].incomingVersion).toBe("const kept = 'incoming';");
      expect(conflicts[1].startLine).toBe(7);
      expect(conflicts[1].endLine).toBe(11);
      expect(conflicts[1].currentVersion).toBe('const second = 2;');
      expect(conflicts[1].incomingVersion).toBe('const second = 3;');
    });

    it('returns an empty array when content has no markers', () => {
      expect(resolver.parseConflictBlocks('const a = 1;\nconst b = 2;')).toEqual([]);
    });
  });

  describe('_replaceConflictBlock', () => {
    const contentWithTwoBlocks = `const a = 1;
<<<<<<< HEAD
old
=======
new
>>>>>>> branch
const b = 2;
<<<<<<< HEAD
old2
=======
new2
>>>>>>> branch`;

    it('replaces only the first remaining block', () => {
      const result = resolver._replaceConflictBlock(contentWithTwoBlocks, 'resolved');

      expect(result.replaced).toBe(true);
      expect(result.content).toBe(`const a = 1;
resolved
const b = 2;
<<<<<<< HEAD
old2
=======
new2
>>>>>>> branch`);
    });

    it('reports not replaced when no markers remain', () => {
      const result = resolver._replaceConflictBlock('const a = 1;', 'resolved');

      expect(result.replaced).toBe(false);
      expect(result.content).toBe('const a = 1;');
    });
  });

  describe('detectAndCleanupConflictMarkers', () => {
    const conflictedDiff = `diff --git a/src/conflicted.js b/src/conflicted.js
index 0000000..1111111
--- a/src/conflicted.js
+++ b/src/conflicted.js
@@ -1,3 +1,6 @@
 const a = 1;
+<<<<<<< HEAD
+const kept = 'first';
+=======
+const kept = 'incoming';
+>>>>>>> branch
 const a = 1;
+<<<<<<< HEAD
+const second = 2;
+=======
+const second = 3;
+>>>>>>> branch`;

    const conflictedContent = `const a = 1;
<<<<<<< HEAD
const kept = 'first';
=======
const kept = 'incoming';
>>>>>>> branch
const a = 1;
<<<<<<< HEAD
const second = 2;
=======
const second = 3;
>>>>>>> branch`;

    beforeEach(() => {
      deps.gitManager.getStagedDiff = jest.fn().mockResolvedValue(conflictedDiff);
      fs.readFile = jest.fn().mockResolvedValue(conflictedContent);
      fs.writeFile = jest.fn().mockResolvedValue();
    });

    it('resolves every conflict block and writes the cleaned file', async () => {
      jest
        .spyOn(resolver, 'resolveConflictWithAI')
        .mockResolvedValue('const resolved = true;');

      const result = await resolver.detectAndCleanupConflictMarkers();

      expect(result.cleaned).toBe(true);
      expect(result.filesFixed).toBe(2);
      expect(result.aiUsed).toBe(true);
      expect(resolver.resolveConflictWithAI).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      const [writtenPath, writtenContent] = fs.writeFile.mock.calls[0];
      expect(writtenPath).toContain('src/conflicted.js');
      expect(writtenContent).toBe(`const a = 1;
const resolved = true;
const a = 1;
const resolved = true;`);
    });

    it('falls back to the current version when AI fails for a block', async () => {
      jest
        .spyOn(resolver, 'resolveConflictWithAI')
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValueOnce('const resolved = true;');

      const result = await resolver.detectAndCleanupConflictMarkers();

      expect(result.cleaned).toBe(true);
      expect(result.filesFixed).toBe(1);
      expect(result.aiUsed).toBe(true);
      const [, writtenContent] = fs.writeFile.mock.calls[0];
      expect(writtenContent).not.toContain('<<<<<<<');
      expect(writtenContent).not.toContain('=======');
      expect(writtenContent).not.toContain('>>>>>>>');
      expect(writtenContent).toContain("const kept = 'first';");
      expect(writtenContent).toContain('const resolved = true;');
    });

    it('reports unclean when every block falls back (no file written)', async () => {
      jest
        .spyOn(resolver, 'resolveConflictWithAI')
        .mockRejectedValue(new Error('provider down'));

      const result = await resolver.detectAndCleanupConflictMarkers();

      expect(result.cleaned).toBe(false);
      expect(result.filesFixed).toBe(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('skips diffs without conflict markers', async () => {
      deps.gitManager.getStagedDiff = jest
        .fn()
        .mockResolvedValue('diff --git a/x.js b/x.js\n+const ok = 1;');

      const result = await resolver.detectAndCleanupConflictMarkers();

      expect(result.cleaned).toBe(false);
      expect(result.filesFixed).toBe(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});