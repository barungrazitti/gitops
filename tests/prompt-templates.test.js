/**
 * Regression tests for prompt template interpolation.
 *
 * The rewrite to plain functions (handlebars removed) intentionally
 * interpolates RAW text: prompt content flows to an LLM, not a browser, so
 * HTML-escaping produced entities like &#x3D; in prompts. These assertions
 * lock the raw semantics so escaping can never be reintroduced.
 */

const {
  buildSingleLineChangePrompt,
  buildLargeDiffPrompt,
} = require('../src/utils/prompt-templates');

describe('PromptTemplates raw interpolation', () => {
  it('buildSingleLineChangePrompt keeps the highlighted line raw', () => {
    const prompt = buildSingleLineChangePrompt('export const u = () => {};');

    expect(prompt).toContain('= () =>');
    expect(prompt).not.toContain('&#x3D;');
    expect(prompt).not.toContain('&gt;');
    expect(prompt).toBe(
      'Single-line change detected: export const u = () => {};. Reflect this exact modification in the commit message.'
    );
  });

  it('buildLargeDiffPrompt keeps chunk summaries raw', () => {
    const prompt = buildLargeDiffPrompt({
      chunkCount: 1,
      chunkSummaries: 'if (a < b && c > d) return;',
      conventional: true,
    });

    expect(prompt).toContain('if (a < b && c > d) return;');
    expect(prompt).not.toContain('&lt;');
    expect(prompt).not.toContain('&amp;');
    expect(prompt).not.toContain('&gt;');
  });
});
