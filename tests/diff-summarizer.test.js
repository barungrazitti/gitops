const DiffSummarizer = require('../src/utils/diff-summarizer');

describe('DiffSummarizer', () => {
  let summarizer;

  beforeEach(() => {
    summarizer = new DiffSummarizer();
  });

  describe('extractFileChunks', () => {
    test('extracts file chunks from diff', () => {
      const diff = `diff --git a/file1.js b/file1.js
index 1234567..89abcdef 100644
--- a/file1.js
+++ b/file1.js
@@ -1,5 +1,6 @@
 const x = 1;
+const newLine = 'added';
 function test() {}`;

      const chunks = summarizer.extractFileChunks(diff);
      expect(chunks.length).toBe(1);
      expect(chunks[0].fileName).toBe('file1.js');
    });

    test('handles empty diff', () => {
      const diff = '';
      const chunks = summarizer.extractFileChunks(diff);
      expect(chunks).toHaveLength(0);
    });

    test('handles null diff', () => {
      const diff = null;
      const chunks = summarizer.extractFileChunks(diff);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('summarizeChunk', () => {
    test('returns correct structure with fileName, changeType, entities', () => {
      const chunk = {
        fileName: 'test.js',
        content: '+ function calculateTotal() {}\n+ const x = 1',
      };

      const summary = summarizer.summarizeChunk(chunk, 0, 1);

      expect(summary).toHaveProperty('fileName');
      expect(summary).toHaveProperty('changeType');
      expect(summary).toHaveProperty('entities');
      expect(summary).toHaveProperty('keyChanges');
      expect(summary.chunkIndex).toBe(0);
      expect(summary.totalChunks).toBe(1);
    });

    test('extracts entities from chunk content', () => {
      const chunk = {
        fileName: 'test.js',
        content:
          '+ function calculateTotal() {}\n+ class UserManager {}\n+ const userCount = 0',
      };

      const summary = summarizer.summarizeChunk(chunk, 0, 1);

      expect(summary.entities.functions).toContain('calculateTotal');
      expect(summary.entities.classes).toContain('UserManager');
      expect(summary.entities.variables).toContain('userCount');
    });

    test('limits keyChanges to top 3', () => {
      const chunk = {
        fileName: 'test.js',
        content:
          '+ const a = 1\n+ const b = 2\n+ const c = 3\n+ const d = 4\n+ const e = 5',
      };

      const summary = summarizer.summarizeChunk(chunk, 0, 1);

      expect(summary.keyChanges.length).toBeLessThanOrEqual(3);
    });

    test('handles empty chunk', () => {
      const chunk = { fileName: 'empty.js', content: '' };

      const summary = summarizer.summarizeChunk(chunk, 0, 1);

      expect(summary.keyChanges).toHaveLength(0);
      expect(summary.entities.functions).toHaveLength(0);
    });
  });

  describe('combineSummaries', () => {
    test('merges multiple chunk summaries', () => {
      const summaries = [
        {
          fileName: 'file1.js',
          changeType: 'feat',
          keyChanges: ['Added login'],
          entities: { all: [] },
        },
        {
          fileName: 'file2.js',
          changeType: 'fix',
          keyChanges: ['Fixed bug'],
          entities: { all: [] },
        },
      ];

      const combined = summarizer.combineSummaries(summaries);

      expect(combined.fileCount).toBe(2);
      expect(combined.changeTypes).toContain('feat');
      expect(combined.changeTypes).toContain('fix');
      expect(combined.combined).toContain('file1.js');
      expect(combined.combined).toContain('file2.js');
    });

    test('handles empty summaries array', () => {
      const combined = summarizer.combineSummaries([]);

      expect(combined.fileCount).toBe(0);
      expect(combined.combined).toBe('');
    });

    test('handles null summaries', () => {
      const combined = summarizer.combineSummaries(null);

      expect(combined.fileCount).toBe(0);
      expect(combined.combined).toBe('');
    });
  });

  describe('detectChangeType', () => {
    test('detects feature additions', () => {
      const content = '+ function addFeature() {}\n+ const newFeature = true';
      const type = summarizer.detectChangeType(content);
      expect(type).toBe('feat');
    });

    test('detects bug fixes', () => {
      const content = '+ function fixBug() {}\n+ const bugFixed = true';
      const type = summarizer.detectChangeType(content);
      expect(type).toBe('fix');
    });

    test('defaults to chore for unknown', () => {
      const content = '+ const x = 1;';
      const type = summarizer.detectChangeType(content);
      expect(type).toBe('chore');
    });
  });
});
