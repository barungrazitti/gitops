function buildSmallDiffPrompt(options) {
  const { category, entityList, conventional: _conventional, context } = options;
  let prompt = `Small diff detected (${category}). Changed entities: ${entityList}. Focus on WHAT specifically changed.`;
  prompt += `\n\nDO NOT use generic phrases like 'update file', 'modify code', or 'make changes'. Be specific about WHAT changed and WHY it matters.`;
  if (_conventional) {
    prompt += `\n\nUse conventional format: type(scope): description`;
  }
  if (context) {
    prompt += `\n\nContext: ${context}`;
  }
  return prompt;
}

function buildSingleLineChangePrompt(highlightedLine) {
  return `Single-line change detected: ${highlightedLine}. Reflect this exact modification in the commit message.`;
}

function buildLargeDiffPrompt(options) {
  const { chunkCount, chunkSummaries, conventional } = options;
  return `Large diff detected (${chunkCount} files/chunks). Processing in parallel for better coverage.

${chunkSummaries}
${conventional ? '\nUse conventional format: type(scope): description\n' : ''}`;
}

function entityListByType(entities) {
  const parts = [];
  if (entities.functions && entities.functions.length > 0) {
    parts.push(`Functions: ${entities.functions.join(', ')}`);
  }
  if (entities.classes && entities.classes.length > 0) {
    parts.push(`Classes: ${entities.classes.join(', ')}`);
  }
  if (entities.variables && entities.variables.length > 0) {
    parts.push(`Variables: ${entities.variables.join(', ')}`);
  }
  return parts.join('; ');
}

module.exports = {
  buildSmallDiffPrompt,
  buildSingleLineChangePrompt,
  buildLargeDiffPrompt,
  entityListByType,
};
