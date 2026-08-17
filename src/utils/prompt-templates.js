const Handlebars = require('handlebars');

const smallDiffTemplate = Handlebars.compile(
  `Small diff detected ({{category}}). Changed entities: {{entityList}}. Focus on WHAT specifically changed.`
);

const forcedSpecificityInstructions = Handlebars.compile(
  `DO NOT use generic phrases like 'update file', 'modify code', or 'make changes'. Be specific about WHAT changed and WHY it matters.`
);

const singleLineChangeTemplate = Handlebars.compile(
  `Single-line change detected: {{highlightedLine}}. Reflect this exact modification in the commit message.`
);

const largeDiffTemplate = Handlebars.compile(
  `Large diff detected ({{chunkCount}} files/chunks). Processing in parallel for better coverage.

{{chunkSummaries}}

{{#if conventional}}
Use conventional format: type(scope): description
{{/if}}`
);

function buildSmallDiffPrompt(options) {
  const { category, entityList, entityCount, conventional, context } = options;

  let prompt = smallDiffTemplate({ category, entityList });

  prompt += '\n\n' + forcedSpecificityInstructions({});

  if (conventional) {
    prompt += `\n\nUse conventional format: type(scope): description`;
  }

  if (context) {
    prompt += `\n\nContext: ${context}`;
  }

  return prompt;
}

function buildSingleLineChangePrompt(highlightedLine) {
  return singleLineChangeTemplate({ highlightedLine });
}

function buildLargeDiffPrompt(options) {
  const { chunkCount, chunkSummaries, conventional } = options;
  return largeDiffTemplate({ chunkCount, chunkSummaries, conventional });
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
