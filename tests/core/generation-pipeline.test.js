const GenerationPipeline = require('../../src/core/generation-pipeline');

describe('GenerationPipeline', () => {
  let pipeline;
  let deps;

  const fakeDiff = 'diff --git a/f.js b/f.js\n+const x = 1;';

  beforeEach(() => {
    deps = {
      diffShaper: {
        manageDiffForAI: jest.fn().mockReturnValue({
          strategy: 'full',
          data: fakeDiff,
          chunks: null,
          info: { strategy: 'full', size: fakeDiff.length, chunks: 1, reasoning: 'test' },
        }),
        analyzeDiffType: jest.fn().mockReturnValue({
          type: 'feat',
          confidence: 0.8,
          keywords: ['add'],
        }),
        getCompatibleTypeHint: jest.fn().mockReturnValue('feat'),
      },
      promptBuilder: {
        buildPrompt: jest.fn().mockReturnValue('PROMPT FOR DIFF'),
      },
      messageRanker: {
        selectBestMessages: jest.fn(messages => messages),
      },
      messageValidator: {
        validateBatch: jest.fn().mockReturnValue({ stats: {} }),
        checkQualityThresholds: jest.fn().mockReturnValue({ qual01: true }),
      },
      activityLogger: {
        info: jest.fn().mockResolvedValue(),
        logAIInteraction: jest.fn().mockResolvedValue(),
      },
      statsManager: {
        recordCommit: jest.fn().mockResolvedValue(),
      },
      providerFactory: {
        create: jest.fn(),
      },
    };

    pipeline = new GenerationPipeline(deps);
  });

  describe('generate(diff, options)', () => {
    it('returns messages from the preferred provider', async () => {
      deps.providerFactory.create.mockReturnValue({
        generateResponse: jest
          .fn()
          .mockResolvedValue('feat: add new constant\n\nfix: unrelated message'),
      });

      const messages = await pipeline.generate(fakeDiff, {
        context: { files: {} },
        preferredProvider: 'groq',
        count: 1,
      });

      expect(messages).toEqual(['feat: add new constant', 'fix: unrelated message']);
      expect(deps.providerFactory.create).toHaveBeenCalledWith('groq', expect.anything());
      expect(deps.promptBuilder.buildPrompt).toHaveBeenCalledTimes(1);
    });

    it('ranks parsed candidates against the shaped diff with the requested count', async () => {
      deps.providerFactory.create.mockReturnValue({
        generateResponse: jest
          .fn()
          .mockResolvedValue('feat: add new constant\n\nfix: unrelated message\n\nchore: bump'),
      });

      await pipeline.generate(fakeDiff, {
        context: { files: {} },
        preferredProvider: 'groq',
        count: 2,
      });

      expect(deps.messageRanker.selectBestMessages).toHaveBeenCalledWith(
        ['feat: add new constant', 'fix: unrelated message', 'chore: bump'],
        2,
        fakeDiff
      );
    });

    it('builds the prompt once per provider attempt (no double building)', async () => {
      deps.providerFactory.create.mockReturnValue({
        generateResponse: jest.fn().mockResolvedValue('feat: add new constant'),
      });

      await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' });

      expect(deps.promptBuilder.buildPrompt).toHaveBeenCalledTimes(1);
    });

    it('falls back to the next provider when the preferred one fails', async () => {
      deps.providerFactory.create.mockImplementationOnce(() => ({
        generateResponse: jest.fn().mockRejectedValue(new Error('groq down')),
      }));
      deps.providerFactory.create.mockImplementationOnce(() => ({
        generateResponse: jest.fn().mockResolvedValue('feat: add new constant'),
      }));

      const messages = await pipeline.generate(fakeDiff, {
        context: { files: {} },
        preferredProvider: 'groq',
      });

      expect(messages).toEqual(['feat: add new constant']);
      expect(deps.providerFactory.create).toHaveBeenNthCalledWith(1, 'groq', expect.anything());
      expect(deps.providerFactory.create).toHaveBeenNthCalledWith(2, 'ollama', expect.anything());
    });

    it('throws when all providers fail', async () => {
      deps.providerFactory.create.mockReturnValue({
        generateResponse: jest.fn().mockRejectedValue(new Error('down')),
      });

      await expect(
        pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' })
      ).rejects.toThrow('All AI providers failed');
    });

    it('treats an empty provider response as a failure and falls through', async () => {
      deps.providerFactory.create.mockImplementationOnce(() => ({
        generateResponse: jest.fn().mockResolvedValue('   '),
      }));
      deps.providerFactory.create.mockImplementationOnce(() => ({
        generateResponse: jest.fn().mockResolvedValue('feat: add new constant'),
      }));

      const messages = await pipeline.generate(fakeDiff, {
        context: { files: {} },
        preferredProvider: 'groq',
      });

      expect(messages).toEqual(['feat: add new constant']);
    });

    it('passes pre-computed diff analysis to the prompt builder', async () => {
      deps.providerFactory.create.mockReturnValue({
        generateResponse: jest.fn().mockResolvedValue('feat: add new constant'),
      });

      await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' });

      const options = deps.promptBuilder.buildPrompt.mock.calls[0][1];
      expect(options.diffAnalysis).toEqual({ type: 'feat', confidence: 0.8, keywords: ['add'] });
    });

    it('prepends the ollama commit preamble for ollama only', async () => {
      const groqAdapter = { generateResponse: jest.fn().mockResolvedValue('feat: add x to file') };
      const ollamaAdapter = { generateResponse: jest.fn().mockResolvedValue('feat: add y to file') };
      deps.providerFactory.create.mockImplementation(name =>
        name === 'groq' ? groqAdapter : ollamaAdapter
      );

      await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' });
      await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'ollama' });

      const [groqPrompt] = groqAdapter.generateResponse.mock.calls[0];
      const [ollamaPrompt] = ollamaAdapter.generateResponse.mock.calls[0];

      expect(groqPrompt).toBe('PROMPT FOR DIFF');
      expect(ollamaPrompt).toContain('CRITICAL: Output ONLY commit messages');
      expect(ollamaPrompt.endsWith('PROMPT FOR DIFF')).toBe(true);
    });

    it('sends the commit system prompt with every generation call', async () => {
      const adapter = { generateResponse: jest.fn().mockResolvedValue('feat: add x to file') };
      deps.providerFactory.create.mockReturnValue(adapter);

      await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' });

      const [, options] = adapter.generateResponse.mock.calls[0];
      expect(options.systemPrompt).toContain('Output ONLY commit messages');
    });

    it('keeps console output to single-line summaries (quiet by default)', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        deps.providerFactory.create.mockReturnValue({
          generateResponse: jest.fn().mockResolvedValue('feat: add new constant'),
        });

        await pipeline.generate(fakeDiff, { context: { files: {} }, preferredProvider: 'groq' });

        const output = logSpy.mock.calls.map(args => String(args[0])).join('\n');
        expect(output).toContain('Diff: full');
        expect(output).not.toContain('provider mode');
        expect(output).not.toContain('semantic context');
      } finally {
        logSpy.mockRestore();
      }
    });

    it('synthesizes messages locally for binary-only diffs without calling providers', async () => {
      deps.diffShaper.manageDiffForAI.mockReturnValue({
        strategy: 'binary-only',
        data: '',
        chunks: null,
        info: {
          strategy: 'binary-only',
          size: 0,
          chunks: 1,
          reasoning: 'Binary/asset-only change',
          binaryFiles: [{ fileName: 'img.png', change: 'added' }],
        },
      });

      const messages = await pipeline.generate(fakeDiff, {
        context: { files: {} },
        preferredProvider: 'groq',
        count: 3,
      });

      expect(messages).toEqual(['chore: add img.png']);
      expect(deps.providerFactory.create).not.toHaveBeenCalled();
      expect(deps.promptBuilder.buildPrompt).not.toHaveBeenCalled();
    });
  });

  describe('synthesizeBinaryOnlyMessages()', () => {
    it('maps added/removed/changed to add/remove/update with basenames', () => {
      expect(
        pipeline.synthesizeBinaryOnlyMessages(
          [
            { fileName: 'assets/img.png', change: 'added' },
            { fileName: 'old/logo.png', change: 'removed' },
            { fileName: 'fonts/a.woff2', change: 'changed' },
          ],
          3
        )
      ).toEqual(['chore: add img.png', 'chore: remove logo.png', 'chore: update a.woff2']);
    });

    it('appends a combined message for multi-file changes within count', () => {
      const messages = pipeline.synthesizeBinaryOnlyMessages(
        [
          { fileName: 'a.png', change: 'added' },
          { fileName: 'b.png', change: 'changed' },
        ],
        3
      );

      expect(messages).toEqual(['chore: add a.png', 'chore: update b.png', 'chore: update 2 asset files']);
    });

    it('falls back to a generic message when no files are listed', () => {
      expect(pipeline.synthesizeBinaryOnlyMessages([], 3)).toEqual([
        'chore: update binary assets',
      ]);
    });
  });

  describe('parseCommitMessages(content)', () => {
    it('splits on blank lines and keeps first-line length >= 10', () => {
      const raw = `feat: add new constant

fix: unrelated message
`;
      expect(pipeline.parseCommitMessages(raw)).toEqual([
        'feat: add new constant',
        'fix: unrelated message',
      ]);
    });

    it('filters blocks whose first line is too short or too long', () => {
      const result = pipeline.parseCommitMessages(
        'short\n\n   fix: resolve timeout issue   '
      );
      expect(result).toEqual(['fix: resolve timeout issue']);
    });

    it('returns empty array for invalid input', () => {
      expect(pipeline.parseCommitMessages(null)).toEqual([]);
      expect(pipeline.parseCommitMessages(undefined)).toEqual([]);
      expect(pipeline.parseCommitMessages(42)).toEqual([]);
    });
  });
});
