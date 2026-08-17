/**
 * Tests for MessageRanker - commit message scoring and selection.
 * Moved from reach-through tests in index.test.js; now covers the
 * diff-aware relevance scoring that the live pipeline path activates.
 */

const MessageRanker = require('../../src/core/message-ranker');

describe('MessageRanker', () => {
  let ranker;

  beforeEach(() => {
    ranker = new MessageRanker();
  });

  describe('selectBestMessages(messages, count, diff)', () => {
    it('should return at most count messages', () => {
      const messages = [
        'feat: add new feature',
        'fix: resolve bug',
        'chore: update dependencies',
        'update functionality',
      ];

      const result = ranker.selectBestMessages(messages, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty input', () => {
      expect(ranker.selectBestMessages([])).toEqual([]);
    });

    it('should handle null input', () => {
      expect(ranker.selectBestMessages(null)).toEqual([]);
    });

    it('should deduplicate messages', () => {
      const result = ranker.selectBestMessages(['feat: add auth', 'feat: add auth'], 3);

      expect(result).toEqual(['feat: add auth']);
    });

    it('should rank diff-relevant messages above generic ones when diff is provided', () => {
      const diff = 'diff --git a/auth.js b/auth.js\n+ function authenticateUser() {\n+   return true;\n}';
      const messages = [
        'update functionality',
        'feat: add authenticateUser function',
      ];

      const result = ranker.selectBestMessages(messages, 1, diff);

      expect(result[0]).toBe('feat: add authenticateUser function');
    });
  });

  describe('scoreCommitMessage(message, diff)', () => {
    it('should score conventional commit format higher', () => {
      const conventional = 'feat: add new feature';
      const nonConventional = 'add new feature';

      const conventionalScore = ranker.scoreCommitMessage(conventional);
      const nonConventionalScore = ranker.scoreCommitMessage(nonConventional);

      expect(conventionalScore).toBeGreaterThan(nonConventionalScore);
    });

    it('should penalize generic messages', () => {
      const generic = 'update functionality';
      const specific = 'feat: add UserAuthentication class';

      const genericScore = ranker.scoreCommitMessage(generic);
      const specificScore = ranker.scoreCommitMessage(specific);

      expect(specificScore).toBeGreaterThan(genericScore);
    });

    it('should return low score for very short messages', () => {
      expect(ranker.scoreCommitMessage('ab')).toBeLessThan(0);
    });

    it('should boost relevance when message mentions entities added in the diff', () => {
      const diff = 'diff --git a/auth.js b/auth.js\n+ function authenticateUser() {\n+   return true;\n}';
      const relevant = 'feat: add authenticateUser function';
      const irrelevant = 'feat: add logging helper';

      const relevantScore = ranker.scoreCommitMessage(relevant, diff);
      const irrelevantScore = ranker.scoreCommitMessage(irrelevant, diff);

      expect(relevantScore).toBeGreaterThan(irrelevantScore);
    });

    it('should penalize messages that are too generic for a diff with specific entities', () => {
      const diff = 'diff --git a/auth.js b/auth.js\n+ function authenticateUser() {\n+   return true;\n}';

      expect(ranker.isMessageTooGenericForDiff('update things', diff)).toBe(true);
      expect(ranker.isMessageTooGenericForDiff('feat: add authenticateUser function', diff)).toBe(
        false
      );
    });

    it('should detect type match between message and diff', () => {
      const testDiff = 'diff --git a/auth.test.js b/auth.test.js\n+ describe("auth", () => {\n+   expect(true).toBe(true);\n+ });';
      const featDiff = 'diff --git a/auth.js b/auth.js\n+ function authenticateUser() {}\n';

      expect(ranker.checkTypeMatch('test: add auth suite', testDiff)).toBe(true);
      expect(ranker.checkTypeMatch('feat: add auth', featDiff)).toBe(true);
      expect(ranker.checkTypeMatch('test: add auth suite', featDiff)).toBe(false);
    });

    it('should detect scope match between message and diff file types', () => {
      const jsxDiff = 'diff --git a/App.jsx b/App.jsx\n+ export const App = () => null;\n';
      const sqlDiff = 'diff --git a/migrate.sql b/migrate.sql\n+ CREATE TABLE users (id INT);\n';

      expect(ranker.checkScopeMatch('feat(ui): add layout', jsxDiff)).toBe(true);
      expect(ranker.checkScopeMatch('feat(ui): add layout', sqlDiff)).toBe(false);
    });
  });
});
