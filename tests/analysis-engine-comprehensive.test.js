/**
 * Unit tests for Analysis Engine - Comprehensive Coverage
 */

jest.mock('diff');
jest.mock('simple-git');
const AnalysisEngine = require('../src/core/analysis-engine');
const Diff = require('diff');
const simpleGit = require('simple-git');

describe('AnalysisEngine - Comprehensive Coverage', () => {
  let analysisEngine;
  let mockDiff;
  let mockGit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDiff = {
      parsePatch: jest.fn(),
      diffLines: jest.fn(),
      structuredPatch: jest.fn()
    };

    mockGit = {
      raw: jest.fn(),
      diff: jest.fn(),
      log: jest.fn(),
      show: jest.fn()
    };

    Diff.parsePatch = mockDiff.parsePatch;
    Diff.diffLines = mockDiff.diffLines;
    Diff.structuredPatch = mockDiff.structuredPatch;
    simpleGit.mockImplementation(() => mockGit);

    analysisEngine = new AnalysisEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const engine = new AnalysisEngine();

      expect(engine.options).toBeDefined();
      expect(engine.options.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(engine.options.maxDiffSize).toBe(5 * 1024 * 1024); // 5MB
      expect(engine.options.maxLineLength).toBe(1000);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        maxFileSize: 20 * 1024 * 1024,
        maxDiffSize: 10 * 1024 * 1024,
        maxLineLength: 2000
      };

      const engine = new AnalysisEngine(customOptions);

      expect(engine.options.maxFileSize).toBe(20 * 1024 * 1024);
      expect(engine.options.maxDiffSize).toBe(10 * 1024 * 1024);
      expect(engine.options.maxLineLength).toBe(2000);
    });
  });

  describe('analyze', () => {
    it('should analyze basic diff', async () => {
      const diff = 'diff --git a/test.js b/test.js\n+new line\n-old line';
      const expectedResult = {
        summary: { files: 1, additions: 1, deletions: 1 },
        changes: [{ file: 'test.js', additions: 1, deletions: 1, changes: [] }]
      };

      mockDiff.parsePatch.mockReturnValue([{
        file: 'test.js',
        additions: 1,
        deletions: 1,
        changes: []
      }]);

      const result = await analysisEngine.analyze(diff);

      expect(result.summary.files).toBe(1);
      expect(result.summary.additions).toBe(1);
      expect(result.summary.deletions).toBe(1);
      expect(mockDiff.parsePatch).toHaveBeenCalledWith(diff);
    });

    it('should handle empty diff', async () => {
      const result = await analysisEngine.analyze('');

      expect(result.summary.files).toBe(0);
      expect(result.summary.additions).toBe(0);
      expect(result.summary.deletions).toBe(0);
      expect(result.changes).toEqual([]);
    });

    it('should handle null diff', async () => {
      const result = await analysisEngine.analyze(null);

      expect(result.summary.files).toBe(0);
      expect(result.changes).toEqual([]);
    });

    it('should handle invalid diff format', async () => {
      const invalidDiff = 'this is not a valid diff';
      mockDiff.parsePatch.mockReturnValue([]);

      const result = await analysisEngine.analyze(invalidDiff);

      expect(result.summary.files).toBe(0);
      expect(result.changes).toEqual([]);
    });

    it('should handle multiple file changes', async () => {
      const diff = 'diff --git a/file1.js b/file1.js\n+new content\ndiff --git a/file2.js b/file2.js\n-old content';
      
      mockDiff.parsePatch.mockReturnValue([
        { file: 'file1.js', additions: 1, deletions: 0, changes: [] },
        { file: 'file2.js', additions: 0, deletions: 1, changes: [] }
      ]);

      const result = await analysisEngine.analyze(diff);

      expect(result.summary.files).toBe(2);
      expect(result.summary.additions).toBe(1);
      expect(result.summary.deletions).toBe(1);
      expect(result.changes).toHaveLength(2);
    });

    it('should reject diff exceeding max size', async () => {
      const largeDiff = 'x'.repeat(6 * 1024 * 1024); // 6MB

      await expect(analysisEngine.analyze(largeDiff))
        .rejects.toThrow('Diff size exceeds maximum limit');
    });

    it('should handle diff with special characters', async () => {
      const diff = 'diff --git a/测试.js b/测试.js\n+测试内容\n-old内容';
      
      mockDiff.parsePatch.mockReturnValue([{
        file: '测试.js',
        additions: 1,
        deletions: 1,
        changes: []
      }]);

      const result = await analysisEngine.analyze(diff);

      expect(result.changes[0].file).toBe('测试.js');
      expect(result.summary.additions).toBe(1);
      expect(result.summary.deletions).toBe(1);
    });

    it('should handle binary file diffs', async () => {
      const binaryDiff = 'diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ';
      
      mockDiff.parsePatch.mockReturnValue([]);

      const result = await analysisEngine.analyze(binaryDiff);

      expect(result.summary.files).toBe(0);
      expect(result.binaryFiles).toContain('image.png');
    });
  });

  describe('getCommitAnalysis', () => {
    it('should analyze commit with diff', async () => {
      const commitHash = 'abc123';
      const mockDiff = 'diff --git a/test.js b/test.js\n+new line\n-old line';
      const mockLog = [{ hash: 'abc123', message: 'test commit' }];

      mockGit.raw.mockResolvedValue(mockDiff);
      mockGit.log.mockResolvedValue(mockLog);
      mockDiff.parsePatch.mockReturnValue([{
        file: 'test.js',
        additions: 1,
        deletions: 1,
        changes: []
      }]);

      const result = await analysisEngine.getCommitAnalysis(commitHash);

      expect(result.hash).toBe('abc123');
      expect(result.message).toBe('test commit');
      expect(result.summary.files).toBe(1);
      expect(mockGit.raw).toHaveBeenCalledWith(['show', '--format=', commitHash]);
    });

    it('should handle non-existent commit', async () => {
      const commitHash = 'nonexistent';

      mockGit.raw.mockRejectedValue(new Error('unknown commit'));

      await expect(analysisEngine.getCommitAnalysis(commitHash))
        .rejects.toThrow('unknown commit');
    });

    it('should handle commit with no diff', async () => {
      const commitHash = 'abc123';
      const mockDiff = '';
      const mockLog = [{ hash: 'abc123', message: 'empty commit' }];

      mockGit.raw.mockResolvedValue(mockDiff);
      mockGit.log.mockResolvedValue(mockLog);

      const result = await analysisEngine.getCommitAnalysis(commitHash);

      expect(result.hash).toBe('abc123');
      expect(result.summary.files).toBe(0);
      expect(result.changes).toEqual([]);
    });

    it('should handle merge commits', async () => {
      const commitHash = 'merge123';
      const mockLog = [
        { hash: 'merge123', message: 'Merge branch feature' }
      ];

      mockGit.log.mockResolvedValue(mockLog);
      mockGit.raw.mockResolvedValue('merge content');

      const result = await analysisEngine.getCommitAnalysis(commitHash);

      expect(result.isMerge).toBe(true);
      expect(result.message).toContain('Merge branch feature');
    });
  });

  describe('getRangeAnalysis', () => {
    it('should analyze commit range', async () => {
      const fromHash = 'abc123';
      const toHash = 'def456';
      const mockDiff = 'diff --git a/test.js b/test.js\n+new line';
      const mockLog = [
        { hash: 'abc123', message: 'first commit' },
        { hash: 'def456', message: 'second commit' }
      ];

      mockGit.raw.mockResolvedValue(mockDiff);
      mockGit.log.mockResolvedValue(mockLog);
      mockDiff.parsePatch.mockReturnValue([{
        file: 'test.js',
        additions: 1,
        deletions: 0,
        changes: []
      }]);

      const result = await analysisEngine.getRangeAnalysis(fromHash, toHash);

      expect(result.fromHash).toBe(fromHash);
      expect(result.toHash).toBe(toHash);
      expect(result.summary.files).toBe(1);
      expect(result.commits).toHaveLength(2);
    });

    it('should handle empty commit range', async () => {
      mockGit.raw.mockResolvedValue('');
      mockGit.log.mockResolvedValue([]);

      const result = await analysisEngine.getRangeAnalysis('abc123', 'def456');

      expect(result.summary.files).toBe(0);
      expect(result.commits).toEqual([]);
    });

    it('should handle range analysis errors', async () => {
      mockGit.raw.mockRejectedValue(new Error('range error'));

      await expect(analysisEngine.getRangeAnalysis('abc123', 'def456'))
        .rejects.toThrow('range error');
    });

    it('should analyze large commit ranges efficiently', async () => {
      const commits = Array(100).fill(null).map((_, i) => ({
        hash: `commit${i}`,
        message: `commit ${i}`
      }));

      mockGit.log.mockResolvedValue(commits);
      mockGit.raw.mockResolvedValue('range diff');

      const start = Date.now();
      const result = await analysisEngine.getRangeAnalysis('abc123', 'def456');
      const duration = Date.now() - start;

      expect(result.commits).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('getFileChanges', () => {
    it('should get changes for specific file', async () => {
      const filename = 'test.js';
      const mockDiff = 'diff --git a/test.js b/test.js\n+new line\n-old line';
      
      mockGit.diff.mockResolvedValue(mockDiff);
      mockDiff.diffLines.mockReturnValue({
        old: 'old line\n',
        new: 'new line\n'
      });

      const result = await analysisEngine.getFileChanges(filename);

      expect(result.filename).toBe(filename);
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(1);
      expect(result.diff).toBeDefined();
    });

    it('should handle unchanged file', async () => {
      const filename = 'unchanged.js';
      
      mockGit.diff.mockResolvedValue('');
      mockDiff.diffLines.mockReturnValue({ old: '', new: '' });

      const result = await analysisEngine.getFileChanges(filename);

      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(0);
      expect(result.diff).toBe('');
    });

    it('should handle non-existent file', async () => {
      const filename = 'nonexistent.js';
      
      mockGit.diff.mockRejectedValue(new Error('file does not exist'));

      await expect(analysisEngine.getFileChanges(filename))
        .rejects.toThrow('file does not exist');
    });

    it('should handle large file changes', async () => {
      const filename = 'large.js';
      const largeDiff = 'x'.repeat(100000);
      
      mockGit.diff.mockResolvedValue(largeDiff);
      mockDiff.diffLines.mockReturnValue({
        old: 'x'.repeat(50000),
        new: 'x'.repeat(50000)
      });

      const result = await analysisEngine.getFileChanges(filename);

      expect(result.diff).toBe(largeDiff);
    });
  });

  describe('getBinaryFiles', () => {
    it('should detect binary files in diff', () => {
      const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ
diff --git a/test.js b/test.js
+new line`;

      const result = analysisEngine.getBinaryFiles(diff);

      expect(result).toContain('image.png');
      expect(result).not.toContain('test.js');
    });

    it('should handle empty diff', () => {
      const result = analysisEngine.getBinaryFiles('');

      expect(result).toEqual([]);
    });

    it('should handle null diff', () => {
      const result = analysisEngine.getBinaryFiles(null);

      expect(result).toEqual([]);
    });

    it('should detect multiple binary files', () => {
      const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ
diff --git a/pdf.pdf b/pdf.pdf
Binary files a/pdf.pdf and b/pdf.pdf differ`;

      const result = analysisEngine.getBinaryFiles(diff);

      expect(result).toContain('image.png');
      expect(result).toContain('pdf.pdf');
      expect(result).toHaveLength(2);
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity for simple changes', () => {
      const changes = [
        { file: 'test.js', additions: 10, deletions: 5, changes: [] }
      ];

      const complexity = analysisEngine.calculateComplexity(changes);

      expect(complexity).toBeDefined();
      expect(complexity.score).toBeGreaterThan(0);
      expect(complexity.level).toBe('low');
    });

    it('should calculate complexity for complex changes', () => {
      const changes = [
        { 
          file: 'complex.js', 
          additions: 1000, 
          deletions: 500, 
          changes: Array(100).fill({}) // Many small changes
        }
      ];

      const complexity = analysisEngine.calculateComplexity(changes);

      expect(complexity.score).toBeGreaterThan(50);
      expect(complexity.level).toBe('high');
    });

    it('should handle empty changes', () => {
      const complexity = analysisEngine.calculateComplexity([]);

      expect(complexity.score).toBe(0);
      expect(complexity.level).toBe('low');
    });

    it('should handle null changes', () => {
      const complexity = analysisEngine.calculateComplexity(null);

      expect(complexity.score).toBe(0);
      expect(complexity.level).toBe('low');
    });

    it('should consider file types in complexity', () => {
      const changes = [
        { file: 'test.js', additions: 50, deletions: 25, changes: [] },
        { file: 'test.json', additions: 50, deletions: 25, changes: [] },
        { file: 'test.md', additions: 50, deletions: 25, changes: [] }
      ];

      const complexity = analysisEngine.calculateComplexity(changes);

      // JS should have higher complexity than JSON/MD
      expect(complexity.score).toBeGreaterThan(0);
      expect(complexity.fileTypes).toBeDefined();
    });
  });

  describe('detectFileType', () => {
    it('should detect JavaScript files', () => {
      const fileType = analysisEngine.detectFileType('app.js');

      expect(fileType).toBe('javascript');
    });

    it('should detect TypeScript files', () => {
      const fileType = analysisEngine.detectFileType('app.ts');

      expect(fileType).toBe('typescript');
    });

    it('should detect JSON files', () => {
      const fileType = analysisEngine.detectFileType('config.json');

      expect(fileType).toBe('json');
    });

    it('should detect Markdown files', () => {
      const fileType = analysisEngine.detectFileType('README.md');

      expect(fileType).toBe('markdown');
    });

    it('should detect CSS files', () => {
      const fileType = analysisEngine.detectFileType('style.css');

      expect(fileType).toBe('css');
    });

    it('should detect unknown file types', () => {
      const fileType = analysisEngine.detectFileType('unknown.xyz');

      expect(fileType).toBe('unknown');
    });

    it('should handle empty filename', () => {
      const fileType = analysisEngine.detectFileType('');

      expect(fileType).toBe('unknown');
    });

    it('should handle null filename', () => {
      const fileType = analysisEngine.detectFileType(null);

      expect(fileType).toBe('unknown');
    });

    it('should detect multiple file extensions', () => {
      expect(analysisEngine.detectFileType('test.jsx')).toBe('jsx');
      expect(analysisEngine.detectFileType('test.tsx')).toBe('tsx');
      expect(analysisEngine.detectFileType('test.vue')).toBe('vue');
      expect(analysisEngine.detectFileType('test.py')).toBe('python');
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from code', () => {
      const code = 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }';

      const keywords = analysisEngine.extractKeywords(code, 'javascript');

      expect(keywords).toContain('function');
      expect(keywords).toContain('reduce');
      expect(keywords).toContain('return');
    });

    it('should extract keywords from diff', () => {
      const diff = '+function newFeature() { console.log("feature added"); }';

      const keywords = analysisEngine.extractKeywords(diff, 'javascript');

      expect(keywords).toContain('function');
      expect(keywords).toContain('console');
      expect(keywords).toContain('log');
    });

    it('should handle empty content', () => {
      const keywords = analysisEngine.extractKeywords('', 'javascript');

      expect(keywords).toEqual([]);
    });

    it('should handle null content', () => {
      const keywords = analysisEngine.extractKeywords(null, 'javascript');

      expect(keywords).toEqual([]);
    });

    it('should extract keywords for different file types', () => {
      const pythonCode = 'def calculate_total(items): return sum(item.price for item in items)';
      
      const keywords = analysisEngine.extractKeywords(pythonCode, 'python');

      expect(keywords).toContain('def');
      expect(keywords).toContain('return');
      expect(keywords).toContain('sum');
    });

    it('should handle Unicode content', () => {
      const unicodeCode = 'function 测试函数() { console.log("测试消息"); }';

      const keywords = analysisEngine.extractKeywords(unicodeCode, 'javascript');

      expect(keywords).toContain('function');
      expect(keywords).toContain('console');
      expect(keywords).toContain('log');
    });
  });

  describe('getChangeMetrics', () => {
    it('should calculate change metrics', () => {
      const changes = [
        { file: 'test1.js', additions: 10, deletions: 5, changes: [] },
        { file: 'test2.js', additions: 20, deletions: 10, changes: [] }
      ];

      const metrics = analysisEngine.getChangeMetrics(changes);

      expect(metrics.totalAdditions).toBe(30);
      expect(metrics.totalDeletions).toBe(15);
      expect(metrics.netChange).toBe(15);
      expect(metrics.filesChanged).toBe(2);
      expect(metrics.averageChangesPerFile).toBe(7.5);
    });

    it('should handle empty changes', () => {
      const metrics = analysisEngine.getChangeMetrics([]);

      expect(metrics.totalAdditions).toBe(0);
      expect(metrics.totalDeletions).toBe(0);
      expect(metrics.netChange).toBe(0);
      expect(metrics.filesChanged).toBe(0);
      expect(metrics.averageChangesPerFile).toBe(0);
    });

    it('should handle null changes', () => {
      const metrics = analysisEngine.getChangeMetrics(null);

      expect(metrics.totalAdditions).toBe(0);
      expect(metrics.totalDeletions).toBe(0);
      expect(metrics.netChange).toBe(0);
      expect(metrics.filesChanged).toBe(0);
      expect(metrics.averageChangesPerFile).toBe(0);
    });

    it('should calculate percentages', () => {
      const changes = [
        { file: 'test1.js', additions: 10, deletions: 5, changes: [] },
        { file: 'test2.js', additions: 10, deletions: 5, changes: [] }
      ];

      const metrics = analysisEngine.getChangeMetrics(changes);

      expect(metrics.additionPercentage).toBe(66.67); // 20/30
      expect(metrics.deletionPercentage).toBe(33.33); // 10/30
    });
  });

  describe('integration scenarios', () => {
    it('should analyze complete commit workflow', async () => {
      const commitHash = 'abc123';
      const mockDiff = `diff --git a/app.js b/app.js
+function newFeature() { console.log("feature"); }
-function oldFeature() { console.log("old"); }
diff --git a/config.json b/config.json
+ "version": "2.0.0"
- "version": "1.0.0"`;

      mockGit.raw.mockResolvedValue(mockDiff);
      mockGit.log.mockResolvedValue([{ hash: 'abc123', message: 'Update application' }]);
      mockDiff.parsePatch.mockReturnValue([
        { file: 'app.js', additions: 1, deletions: 1, changes: [] },
        { file: 'config.json', additions: 1, deletions: 1, changes: [] }
      ]);

      const result = await analysisEngine.getCommitAnalysis(commitHash);

      expect(result.hash).toBe('abc123');
      expect(result.summary.files).toBe(2);
      expect(result.changes).toHaveLength(2);
      expect(result.summary.additions).toBe(2);
      expect(result.summary.deletions).toBe(2);
    });

    it('should analyze branch comparison', async () => {
      const fromBranch = 'feature';
      const toBranch = 'main';
      const mockDiff = 'diff --git a/feature.js b/feature.js\n+feature code';

      mockGit.diff.mockResolvedValue(mockDiff);
      mockDiff.diffLines.mockReturnValue({ old: '', new: '+feature code' });

      const result = await analysisEngine.getFileChanges('feature.js');

      expect(result.filename).toBe('feature.js');
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle diff parsing errors gracefully', async () => {
      const malformedDiff = 'malformed diff content';
      mockDiff.parsePatch.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await analysisEngine.analyze(malformedDiff);

      expect(result.summary.files).toBe(0);
      expect(result.changes).toEqual([]);
    });

    it('should handle very large diffs', async () => {
      const largeDiff = 'x'.repeat(4 * 1024 * 1024); // 4MB

      const result = await analysisEngine.analyze(largeDiff);

      expect(result).toBeDefined();
      expect(mockDiff.parsePatch).toHaveBeenCalledWith(largeDiff);
    });

    it('should handle diffs with line endings', async () => {
      const diffWithLineEndings = 'diff --git a/test.js b/test.js\n\r\n+new line\r\n-old line';
      
      mockDiff.parsePatch.mockReturnValue([{
        file: 'test.js',
        additions: 1,
        deletions: 1,
        changes: []
      }]);

      const result = await analysisEngine.analyze(diffWithLineEndings);

      expect(result.summary.files).toBe(1);
      expect(result.summary.additions).toBe(1);
      expect(result.summary.deletions).toBe(1);
    });

    it('should handle diffs with tabs and spaces', async () => {
      const diffWithWhitespace = 'diff --git a/test.js b/test.js\n+\tindented line\n+\t\tmore indented';
      
      mockDiff.parsePatch.mockReturnValue([{
        file: 'test.js',
        additions: 2,
        deletions: 0,
        changes: []
      }]);

      const result = await analysisEngine.analyze(diffWithWhitespace);

      expect(result.summary.files).toBe(1);
      expect(result.summary.additions).toBe(2);
      expect(result.summary.deletions).toBe(0);
    });

    it('should handle Unicode file names in diffs', async () => {
      const unicodeDiff = 'diff --git a/测试文件.js b/测试文件.js\n+测试内容';
      
      mockDiff.parsePatch.mockReturnValue([{
        file: '测试文件.js',
        additions: 1,
        deletions: 0,
        changes: []
      }]);

      const result = await analysisEngine.analyze(unicodeDiff);

      expect(result.changes[0].file).toBe('测试文件.js');
      expect(result.summary.additions).toBe(1);
    });
  });

  describe('performance and optimization', () => {
    it('should handle large number of files efficiently', async () => {
      const largeDiff = Array(100).fill(null).map((_, i) => 
        `diff --git a/file${i}.js b/file${i}.js\n+content`
      ).join('\n');

      mockDiff.parsePatch.mockReturnValue(Array(100).fill(null).map((_, i) => ({
        file: `file${i}.js`,
        additions: 1,
        deletions: 0,
        changes: []
      })));

      const start = Date.now();
      const result = await analysisEngine.analyze(largeDiff);
      const duration = Date.now() - start;

      expect(result.summary.files).toBe(100);
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it('should cache file type detection', () => {
      // Call multiple times to test caching
      const file1 = analysisEngine.detectFileType('test.js');
      const file2 = analysisEngine.detectFileType('test.js');
      const file3 = analysisEngine.detectFileType('test.js');

      expect(file1).toBe('javascript');
      expect(file2).toBe('javascript');
      expect(file3).toBe('javascript');
    });

    it('should handle concurrent analysis requests', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        analysisEngine.analyze(`diff --git a/file${i}.js b/file${i}.js\n+content${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.summary.files).toBe(1);
        expect(result.summary.additions).toBe(1);
      });
    });
  });
});