
const AICommitGenerator = require('../src/index');

describe('AICommitGenerator Error Handling', () => {
    let generator;

    beforeEach(() => {
        generator = new AICommitGenerator({ provider: 'test', model: 'test' });
    });

    describe('identifyErrorType', () => {
        it('should identify "no staged changes" error', () => {
            const error = new Error('No staged changes found.');
            expect(generator.identifyErrorType(error)).toBe('git_no_changes');
        });

        it('should identify "not a git repository" error', () => {
            const error = new Error('fatal: not a git repository');
            expect(generator.identifyErrorType(error)).toBe('git_not_repo');
        });

        it('should identify "401" auth error', () => {
            const error = new Error('Request failed with status code 401');
            expect(generator.identifyErrorType(error)).toBe('ai_auth_error');
        });

        it('should identify "429" rate limit error', () => {
            const error = new Error('Request failed with status code 429');
            expect(generator.identifyErrorType(error)).toBe('ai_rate_limit');
        });

        it('should return "unknown" for an unhandled error', () => {
            const error = new Error('A completely random error.');
            expect(generator.identifyErrorType(error)).toBe('unknown');
        });
    });

    describe('getLocalSuggestion', () => {
        it('should return the correct suggestion for "no staged changes"', () => {
            const suggestion = generator.getLocalSuggestion('git_no_changes');
            expect(suggestion).toContain('git add');
        });

        it('should return the correct suggestion for "not a git repository"', () => {
            const suggestion = generator.getLocalSuggestion('git_not_repo');
            expect(suggestion).toContain('git init');
        });

        it('should return a generic message for "unknown" error type', () => {
            const suggestion = generator.getLocalSuggestion('unknown');
            expect(suggestion).toContain('An unexpected error occurred');
        });
    });

    describe('provideErrorSuggestions', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should not crash when called', async () => {
            const error = new Error('No staged changes found.');
            await expect(generator.provideErrorSuggestions(error, {})).resolves.not.toThrow();
        });

        it('should print a suggestion to the console', async () => {
            const error = new Error('No staged changes found.');
            await generator.provideErrorSuggestions(error, {});
            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleSpy.mock.calls[0][0]).toContain('💡 Suggestion:');
        });
    });
});
