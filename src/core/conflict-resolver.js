/**
 * Conflict Resolver - AI-powered git merge conflict resolution
 *
 * Parses conflict markers, resolves blocks via AI (with secret redaction),
 * and cleans conflict markers from content.
 */

const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const AIProviderFactory = require('../providers/ai-provider-factory');
const SecretScanner = require('../utils/secret-scanner');

class ConflictResolver {
  /**
   * @param {Object} deps
   * @param {Object} deps.configManager - Config manager instance
   * @param {Object} deps.gitManager - Git manager instance
   * @param {Object} deps.activityLogger - Activity logger instance
   */
  constructor({ configManager, gitManager, activityLogger }) {
    this.configManager = configManager;
    this.gitManager = gitManager;
    this.activityLogger = activityLogger;
  }

  /**
   * Parse conflict markers from content and extract both versions
   */
  parseConflictBlocks(content) {
    const conflicts = [];
    const lines = content.split('\n');
    let currentConflict = null;
    let collectingCurrent = false;
    let collectingIncoming = false;

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        currentConflict = {
          startLine: lines.indexOf(line),
          currentVersion: [],
          incomingVersion: [],
        };
        collectingCurrent = true;
        collectingIncoming = false;
      } else if (line.startsWith('=======')) {
        collectingCurrent = false;
        collectingIncoming = true;
      } else if (line.startsWith('>>>>>>>')) {
        if (currentConflict) {
          currentConflict.endLine = lines.indexOf(line);
          currentConflict.currentVersion = currentConflict.currentVersion.join('\n');
          currentConflict.incomingVersion = currentConflict.incomingVersion.join('\n');
          conflicts.push(currentConflict);
        }
        currentConflict = null;
        collectingCurrent = false;
        collectingIncoming = false;
      } else if (currentConflict) {
        if (collectingCurrent) {
          currentConflict.currentVersion.push(line);
        } else if (collectingIncoming) {
          currentConflict.incomingVersion.push(line);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a single conflict block using AI.
   * Single interface shape: one object in, resolved content out.
   * @param {Object} conflictCtx
   * @param {string} conflictCtx.filePath - Path of the conflicted file.
   * @param {string} conflictCtx.currentVersion - HEAD/current side of the conflict.
   * @param {string} conflictCtx.incomingVersion - Incoming side of the conflict.
   * @param {string} [conflictCtx.language] - Language hint for the prompt.
   * @returns {Promise<string>} Resolved content (falls back to currentVersion on failure).
   */
  async resolveConflictWithAI({ filePath, currentVersion, incomingVersion, language = 'javascript' }) {
    if (!filePath || typeof currentVersion !== 'string' || typeof incomingVersion !== 'string') {
      throw new Error(
        'resolveConflictWithAI requires { filePath, currentVersion, incomingVersion }'
      );
    }

    // SECURITY: Redact secrets/PII before sending file content to AI
    const secretScanner = new SecretScanner();
    currentVersion = secretScanner.scanAndRedact(String(currentVersion || ''), true);
    incomingVersion = secretScanner.scanAndRedact(String(incomingVersion || ''), true);
    const redactionSummary = secretScanner.getRedactionSummary();
    if (redactionSummary.found) {
      await this.activityLogger.warn('sensitive_data_redacted', {
        source: 'conflict_resolution',
        redacted: redactionSummary.redacted,
        byCategory: redactionSummary.byCategory,
      });
    }
    secretScanner.clearRedactionLog();

    const prompt = `You are an expert software developer. Resolve a git merge conflict intelligently.

CONTEXT:
- File: ${filePath}
- Language: ${language}
- Original code (HEAD): The code before the conflict
- Incoming code: The new code that conflicts with HEAD

INSTRUCTIONS:
1. Analyze both versions and their purpose
2. Merge them intelligently - keep functionality from BOTH if possible
3. If the same lines were modified differently, choose the better implementation
4. Return ONLY the resolved code - NO explanations, NO comments about conflicts
5. Preserve all working code from both versions

CURRENT VERSION (HEAD):
\`\`\`
${currentVersion}
\`\`\`

INCOMING VERSION:
\`\`\`
${incomingVersion}
\`\`\`

RESOLVED CODE (output only):
`;

    try {
      const config = await this.configManager.getAll();
      const provider = AIProviderFactory.create(config.defaultProvider || 'groq');

      // Use the general-purpose completion path (generateResponse) - commit
      // generation prompts are wrapped in commit-only instructions at the
      // pipeline layer, which would contradict the resolve-code instructions.
      const response = await provider.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.2,
      });

      const resolved = Array.isArray(response) ? response[0] : response;

      if (resolved && resolved.trim()) {
        let cleaned = resolved.trim();

        // Clean up any markdown code blocks if present
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');

        // Reject non-resolutions (apologies, explanations, empty code blocks)
        if (cleaned.length > 0 && !/^```\s*$/.test(cleaned)) {
          return cleaned;
        }
      }

      await this.activityLogger.warn('conflict_resolution_empty_response', {
        file: filePath,
      });
    } catch (error) {
      console.warn(chalk.yellow(`AI resolution failed, using current version: ${error.message}`));
    }

    // Fallback: keep current version
    return currentVersion;
  }

  /**
   * Detect and clean up conflict markers in all staged files using AI
   */
  async detectAndCleanupConflictMarkers() {
    const diff = await this.gitManager.getStagedDiff();

    if (!diff || !/^<{7}|^={7}\s*$|^>{7}/m.test(diff)) {
      return { cleaned: false, filesFixed: 0, diff };
    }

    console.log(chalk.yellow('\n🔧 Detected conflict markers in staged changes'));

    // Parse diff to find which files have conflicts
    const filePattern = /diff --git a\/(.+?) b\/(.+)/g;
    const files = [];
    let match;
    while ((match = filePattern.exec(diff)) !== null) {
      files.push({ fileA: match[1], fileB: match[2] });
    }

    const cleanedDiff = diff;
    let totalResolved = 0;
    let aiUsed = false;

    for (const file of files) {
      // Extract file diff
      const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileDiffPattern = new RegExp(
        `diff --git a/${escapeRegExp(file.fileA)} b/${escapeRegExp(file.fileB)}[\\s\\S]*?(?=diff --git a|$)`,
        'g'
      );
      const fileMatches = [...diff.matchAll(fileDiffPattern)];

      for (const fileMatch of fileMatches) {
        const fileDiff = fileMatch[0];
        if (/^<{7}|^={7}\s*$|^>{7}/m.test(fileDiff)) {
          // Check if file exists and read it
          const fullPath = path.isAbsolute(file.fileB)
            ? file.fileB
            : path.resolve(process.cwd(), file.fileB);

          try {
            const content = await fs.readFile(fullPath, 'utf8');
            if (/^<{7}|^={7}\s*$|^>{7}/m.test(content)) {
              // Parse and resolve conflicts using AI
              const conflicts = this.parseConflictBlocks(content);
              let cleanedContent = content;
              let fileResolved = 0;
              let fileAiUsed = false;

              for (const conflict of conflicts) {
                // Resolve each conflict block
                const ext = file.fileB.split('.').pop();
                const langMap = {
                  js: 'javascript',
                  ts: 'typescript',
                  py: 'python',
                  php: 'php',
                  html: 'html',
                  css: 'css',
                  json: 'json',
                  md: 'markdown',
                  sql: 'sql',
                };
                const language = langMap[ext] || 'javascript';

                // Locate this conflict block in the working copy (sequential,
                // so earlier resolutions are preserved)
                const blockStart = cleanedContent.indexOf('<<<<<<<');
                const markerEnd = cleanedContent.indexOf('>>>>>>>', blockStart);

                try {
                  const resolved = await this.resolveConflictWithAI({
                    filePath: file.fileB,
                    currentVersion: conflict.currentVersion,
                    incomingVersion: conflict.incomingVersion,
                    language,
                  });

                  if (blockStart >= 0 && markerEnd >= blockStart) {
                    // Include the rest of the '>>>>>>>' line (branch label + newline)
                    let endOfBlock = markerEnd + '>>>>>>>'.length;
                    if (cleanedContent[endOfBlock] === '\n') endOfBlock += 1;

                    cleanedContent =
                      cleanedContent.slice(0, blockStart) + resolved + cleanedContent.slice(endOfBlock);
                  } else {
                    cleanedContent = cleanedContent.replace(
                      `<<<<<<< HEAD\n${conflict.currentVersion}\n=======\n${conflict.incomingVersion}\n>>>>>>> `,
                      `${resolved}\n`
                    );
                  }

                  fileResolved++;
                  fileAiUsed = true;
                } catch (e) {
                  // Fallback: use current version
                  if (blockStart >= 0 && markerEnd >= blockStart) {
                    let endOfBlock = markerEnd + '>>>>>>>'.length;
                    if (cleanedContent[endOfBlock] === '\n') endOfBlock += 1;
                    cleanedContent =
                      cleanedContent.slice(0, blockStart) +
                      conflict.currentVersion +
                      cleanedContent.slice(endOfBlock);
                  }
                }
              }

              if (fileResolved > 0) {
                await fs.writeFile(fullPath, cleanedContent, 'utf8');
                console.log(
                  chalk.green(`  ✅ Resolved ${fileResolved} conflict(s) in ${file.fileB}`)
                );
                totalResolved += fileResolved;
                if (fileAiUsed) aiUsed = true;
              }
            }
          } catch (e) {
            // File might not exist (deleted), skip
          }
        }
      }
    }

    return {
      cleaned: totalResolved > 0,
      filesFixed: totalResolved,
      diff: cleanedDiff,
      aiUsed,
    };
  }

  /**
   * Clean conflict markers from content string (simple version - keeps HEAD)
   */
  cleanConflictMarkers(content) {
    const lines = content.split('\n');
    const result = [];
    let inConflict = false;
    let collectingHead = true;
    let headLines = [];

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        collectingHead = true;
        continue;
      }

      if (line.startsWith('=======')) {
        collectingHead = false;
        continue;
      }

      if (line.startsWith('>>>>>>>')) {
        inConflict = false;
        result.push(...headLines);
        headLines = [];
        continue;
      }

      if (inConflict) {
        if (collectingHead) {
          headLines.push(line);
        }
      } else {
        result.push(line);
      }
    }
    return result.join('\n').trim();
  }
}

module.exports = ConflictResolver;
