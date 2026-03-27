/**
 * Response Parser - Parses AI responses into structured commit messages
 */

class ResponseParser {
  constructor() {}

  /**
   * Parse AI response into commit messages
   * Handles various response formats from different AI providers
   */
  parseResponse(response) {
    if (!response) {
      return [];
    }

    // Handle string response
    if (typeof response === 'string') {
      return this._parseStringResponse(response);
    }

    // Handle object response (Groq format)
    if (response && typeof response === 'object') {
      // Handle Groq response format (with choices)
      if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        const messages = [];
        for (const choice of response.choices) {
          if (choice.message && choice.message.content) {
            const parsed = this._parseStringResponse(choice.message.content);
            messages.push(...parsed);
          }
        }
        return messages;
      }

      // Handle direct content
      if (response.content) {
        return this._parseStringResponse(response.content);
      }

      // Handle response field
      if (response.response) {
        return this._parseStringResponse(response.response);
      }
    }

    // Fallback: try to convert to string and parse
    return this._parseStringResponse(String(response));
  }

  /**
   * Parse string response into commit messages
   */
  _parseStringResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return [];
    }

    // Split by lines and filter out empty lines
    const lines = responseText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Filter out lines that look like explanations or metadata
    const commitMessages = lines.filter(line => {
      // Skip lines that are clearly not commit messages
      const lowerLine = line.toLowerCase();
      return !(
        lowerLine.startsWith('here') ||
        lowerLine.startsWith('the ') &&
        (lowerLine.includes('commit') || lowerLine.includes('message')) ||
        lowerLine.startsWith('you can') ||
        lowerLine.startsWith('this ') &&
        (lowerLine.includes('commit') || lowerLine.includes('message')) ||
        lowerLine.includes('as an ai') ||
        lowerLine.includes('i am') ||
        lowerLine.startsWith('note:') ||
        lowerLine.startsWith('please') ||
        lowerLine.startsWith('make sure')
      );
    });

    // If no valid commit messages found, return the original lines as fallback
    return commitMessages.length > 0 ? commitMessages : lines.slice(0, 3); // Return max 3 as fallback
  }

  /**
   * Extract conventional commit type from message
   */
  extractType(message) {
    const match = message.match(/^(\w+)(?:\([^)]*\))?:\s+/);
    return match ? match[1] : null;
  }

  /**
   * Extract scope from conventional commit message
   */
  extractScope(message) {
    const match = message.match(/^\w+\(([^)]+)\):\s+/);
    return match ? match[1] : null;
  }

  /**
   * Extract description from conventional commit message
   */
  extractDescription(message) {
    const match = message.match(/^\w+(?:\([^)]*\))?:\s+(.+)$/);
    return match ? match[1] : message;
  }

  /**
   * Check if message follows conventional commit format
   */
  isConventionalFormat(message) {
    return /^\w+(?:\([^)]*\))?:\s+.+/.test(message);
  }
}

module.exports = ResponseParser;