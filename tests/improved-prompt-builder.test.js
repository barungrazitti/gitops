/**
 * Tests for improved EfficientPromptBuilder
 */

const EfficientPromptBuilder = require('../src/utils/efficient-prompt-builder');

describe('Improved EfficientPromptBuilder', () => {
  let promptBuilder;

  beforeEach(() => {
    promptBuilder = new EfficientPromptBuilder();
  });

  describe('buildPrompt', () => {
    test('should generate concise, focused prompts', () => {
      const diff = '+function test() { return true; }';
      const prompt = promptBuilder.buildPrompt(diff, { count: 3 });

      expect(prompt.length).toBeLessThan(1500); // Much shorter than before
      expect(prompt).toContain('Generate 3 precise commit messages');
      expect(prompt).toContain('Focus:');
      expect(prompt).toContain(diff);
    });

    test('should include change-specific guidance for fixes', () => {
      const diff = '-function broken() { return null; }\n+function fixed() { return "value"; }';
      const prompt = promptBuilder.buildPrompt(diff, { count: 1 });

      expect(prompt).toContain('what was broken and how it was resolved');
    });

    test('should include change-specific guidance for features', () => {
      const diff = '+function newFeature() { return "added"; }';
      const prompt = promptBuilder.buildPrompt(diff, { count: 1 });

      expect(prompt).toContain('what new capability this adds');
    });

    test('should detect breaking changes', () => {
      const diff = '-function oldAPI() { return true; }\n+function newAPI() { throw new Error("Deprecated"); }';
      const prompt = promptBuilder.buildPrompt(diff, { count: 1 });

      expect(prompt).toContain('breaking changes');
    });

    test('should generate contextual examples for React projects', () => {
      const diff = '+const Component = () => <div>New</div>;';
      const context = {
        project: { primary: 'react' },
        files: { fileTypes: { jsx: 1 } }
      };
      const prompt = promptBuilder.buildPrompt(diff, { context, count: 1 });

      expect(prompt).toContain('feat(components): implement dark mode toggle');
    });

    test('should generate contextual examples for WordPress projects', () => {
      const diff = '+add_action("init", "new_function");';
      const context = {
        project: { primary: 'wordpress' },
        files: { semantic: { wordpress_hooks: ['init'] } }
      };
      const prompt = promptBuilder.buildPrompt(diff, { context, count: 1 });

      // The example should be generated based on the detected change type
      expect(prompt).toContain('Examples:');
    });

    test('should handle conventional commit format', () => {
      const diff = '+function newAPI() { return "data"; }';
      const prompt = promptBuilder.buildPrompt(diff, { conventional: true, count: 1 });

      expect(prompt).toContain('Format: type(scope): description');
      expect(prompt).toContain('Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build');
    });

    test('should extract relevant context efficiently', () => {
      const diff = '+export const utils = () => {};';
      const context = {
        project: { primary: 'nodejs' },
        files: {
          fileTypes: { js: 2, test: 1 },
          semantic: { functions: ['utils'] }
        }
      };
      const prompt = promptBuilder.buildPrompt(diff, { context, count: 1 });

      expect(prompt).toContain('nodejs');
      expect(prompt).toContain('js');
      expect(prompt).toContain('new: utils');
    });

    test('should handle chunking context', () => {
      const diff = '+function chunked() { return true; }';
      const options = {
        chunkIndex: 1,
        totalChunks: 3,
        context: { chunkInfo: { files: ['file1.js', 'file2.js'] } }
      };
      const prompt = promptBuilder.buildPrompt(diff, options);

      expect(prompt).toContain('Chunk 2/3');
      expect(prompt).toContain('file1.js, file2.js');
    });

    test('should compress prompts that are too long', () => {
      const longDiff = '+'.repeat(5000); // Smaller to allow compression
      const prompt = promptBuilder.buildPrompt(longDiff, { count: 3 });

      expect(prompt.length).toBeLessThan(promptBuilder.maxPromptLength);
    });
  });

  describe('analyzeChangeImpact', () => {
    test('should detect user-facing changes', () => {
      const diff = '+const Component = () => <div>UI Change</div>;';
      const context = { files: { fileTypes: { jsx: 1 } } };
      const impact = promptBuilder.analyzeChangeImpact(diff, context);

      expect(impact.userFacing).toBe(true);
      expect(impact.scope).toBe('user-facing');
    });

    test('should detect security changes', () => {
      const diff = '+function validateToken(token) { return jwt.verify(token); }';
      const impact = promptBuilder.analyzeChangeImpact(diff, {});

      expect(impact.security).toBe(true);
      expect(impact.scope).toBe('security');
    });

    test('should detect performance changes', () => {
      const diff = '+const memoized = useMemo(() => expensiveCalc(), [deps]);';
      const impact = promptBuilder.analyzeChangeImpact(diff, {});

      expect(impact.performance).toBe(true);
      expect(impact.scope).toBe('performance');
    });

    test('should detect dependency changes', () => {
      const diff = '"react": "^18.0.0"\n+"react": "^19.0.0"';
      const impact = promptBuilder.analyzeChangeImpact(diff, {});

      expect(impact.dependency).toBe(true);
    });
  });

  describe('buildChangeSpecificGuidance', () => {
    test('should provide fix guidance', () => {
      const changeAnalysis = { type: 'fix' };
      const impactAnalysis = { security: true };
      const guidance = promptBuilder.buildChangeSpecificGuidance(changeAnalysis, impactAnalysis);

      expect(guidance).toContain('what was broken and how it was resolved');
      expect(guidance).toContain('security fix');
    });

    test('should provide feature guidance', () => {
      const changeAnalysis = { type: 'feat' };
      const impactAnalysis = { userFacing: true };
      const guidance = promptBuilder.buildChangeSpecificGuidance(changeAnalysis, impactAnalysis);

      expect(guidance).toContain('what new capability this adds');
      expect(guidance).toContain('user-visible feature');
    });

    test('should include breaking change note', () => {
      const changeAnalysis = { type: 'refactor' };
      const impactAnalysis = { breaking: true };
      const guidance = promptBuilder.buildChangeSpecificGuidance(changeAnalysis, impactAnalysis);

      expect(guidance).toContain('breaking changes');
    });
  });

  describe('generateContextualExamples', () => {
    test('should generate React-specific examples', () => {
      const context = { project: { primary: 'react' } };
      const changeAnalysis = { type: 'feat' };
      const examples = promptBuilder.generateContextualExamples(context, changeAnalysis, false);

      expect(examples).toContain('feat(components): implement dark mode toggle');
    });

    test('should generate WordPress-specific examples', () => {
      const context = { project: { primary: 'wordpress' } };
      const changeAnalysis = { type: 'fix' };
      const examples = promptBuilder.generateContextualExamples(context, changeAnalysis, false);

      expect(examples).toContain('fix(plugin): handle undefined post ID error');
    });

    test('should add conventional format when requested', () => {
      const context = {};
      const changeAnalysis = { type: 'feat' };
      const examples = promptBuilder.generateContextualExamples(context, changeAnalysis, true);

      expect(examples).toContain('feat(api): add user profile endpoint');
    });
  });

  describe('getRelevantFileTypes', () => {
    test('should prioritize relevant file types for features', () => {
      const fileTypes = { js: 2, css: 1, md: 1, test: 3 };
      const changeAnalysis = { type: 'feat' };
      const relevant = promptBuilder.getRelevantFileTypes(fileTypes, changeAnalysis);

      expect(relevant).toEqual(['js', 'css']);
    });

    test('should prioritize test files for test changes', () => {
      const fileTypes = { js: 2, 'test.js': 3, css: 1 };
      const changeAnalysis = { type: 'test' };
      const relevant = promptBuilder.getRelevantFileTypes(fileTypes, changeAnalysis);

      expect(relevant).toEqual(['test.js']);
    });
  });

  describe('extractRelevantContext', () => {
    test('should extract most relevant context information', () => {
      const context = {
        project: { primary: 'react' },
        files: {
          fileTypes: { jsx: 2, js: 1 },
          semantic: { components: ['Button', 'Modal'] }
        }
      };
      const changeAnalysis = { type: 'feat' };
      const relevant = promptBuilder.extractRelevantContext(context, changeAnalysis);

      expect(relevant).toContain('react');
      expect(relevant).toContain('jsx');
      expect(relevant).toContain('components: Button, Modal');
    });

    test('should return null for empty context', () => {
      const relevant = promptBuilder.extractRelevantContext(null, {});
      expect(relevant).toBeNull();
    });
  });
});