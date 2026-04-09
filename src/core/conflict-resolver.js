/**
 * Handles AI-powered conflict resolution and cleanup
 */

const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const AIProviderFactory = require('../providers/ai-provider-factory');

class ConflictResolver {
  constructor(activityLogger, configManager) {
    this.activityLogger = activityLogger;
    this.configManager = configManager;
  }

  /**
   * Resolve a single conflict block using AI
   */
  async resolveConflictWithAI(filePath, currentVersion, incomingVersion, language = 'javascript') {
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
      
      const messages = await provider.generateCommitMessages(
        `RESOLVE CONFLICT IN ${filePath}:\n\n${prompt}`,
        { count: 1 }
      );

      if (messages && messages.length > 0) {
        let resolved = messages[0].trim();
        
        // Clean up any markdown code blocks if present
        resolved = resolved.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
        
        return resolved;
      }
    } catch (error) {
      console.warn(chalk.yellow(`AI resolution failed, using current version: ${error.message}`));
    }

    // Fallback: keep current version
    return currentVersion;
  }

  /**
   * Handle conflict markers in a diff using AI-powered resolution
   */
  async handleConflictMarkers(diff, filePath) {
    const conflictPattern = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> .+/g;
    const matches = [...diff.matchAll(conflictPattern)];

    if (matches.length === 0) {
      return { cleanedDiff: diff, hasConflicts: false, resolved: [] };
    }

    console.log(chalk.yellow(`⚠️  Found ${matches.length} conflict(s) in ${filePath}`));
    console.log(chalk.blue(`🧠 Using AI to intelligently resolve conflicts...`));

    let cleanedDiff = diff;
    const resolved = [];
    let aiUsed = false;

    for (const match of matches) {
      const currentVersion = match[1].trim();
      const incomingVersion = match[2].trim();
      const conflictBlock = match[0];

      // Detect language from file extension
      const ext = filePath.split('.').pop();
      const langMap = {
        'js': 'javascript', 'ts': 'typescript', 'py': 'python',
        'php': 'php', 'html': 'html', 'css': 'css',
        'json': 'json', 'md': 'markdown', 'sql': 'sql',
        'java': 'java', 'go': 'go', 'rs': 'rust'
      };
      const language = langMap[ext] || 'javascript';

      // Use AI to resolve the conflict
      let resolvedVersion;
      try {
        resolvedVersion = await this.resolveConflictWithAI(
          filePath,
          currentVersion,
          incomingVersion,
          language
        );
        aiUsed = true;
      } catch (error) {
        console.warn(chalk.yellow(`AI resolution failed: ${error.message}`));
        // Fallback to current version
        resolvedVersion = currentVersion;
      }

      // Replace the conflict block with resolved version
      cleanedDiff = cleanedDiff.replace(conflictBlock, resolvedVersion);

      resolved.push({
        file: filePath,
        resolutionType: aiUsed ? 'ai-merged' : 'kept-current',
        linesKept: resolvedVersion.split('\n').length
      });
    }

    const successType = aiUsed ? 'AI-merged' : 'fallback';
    console.log(chalk.green(`✅ Resolved ${resolved.length} conflict(s) in ${filePath} (${successType})`));

    return {
      cleanedDiff,
      hasConflicts: true,
      resolved,
      aiUsed
    };
  }

  /**
   * Detect and clean up conflict markers in all staged files using AI
   */
  async detectAndCleanupConflictMarkers() {
    const diff = await this.gitManager.getStagedDiff();

    if (!diff || !/<<<<<<<|=======|>>>>>>>/.test(diff)) {
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

    let cleanedDiff = diff;
    let totalResolved = 0;
    let aiUsed = false;

    for (const file of files) {
      // Extract file diff
      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileDiffPattern = new RegExp(
        `diff --git a/${escapeRegExp(file.fileA)} b/${escapeRegExp(file.fileB)}[\\s\\S]*?(?=diff --git a|$)`,
        'g'
      );
      const fileMatches = [...diff.matchAll(fileDiffPattern)];

      for (const fileMatch of fileMatches) {
        const fileDiff = fileMatch[0];
        if (/<<<<<<<|=======|>>>>>>>/.test(fileDiff)) {
          // Check if file exists and read it
          const fullPath = path.isAbsolute(file.fileB)
            ? file.fileB
            : path.resolve(process.cwd(), file.fileB);

          try {
            const content = await fs.readFile(fullPath, 'utf8');
            if (/<<<<<<<|=======|>>>>>>>/.test(content)) {
              // Parse and resolve conflicts using AI
              const conflicts = this.parseConflictBlocks(content);
              let cleanedContent = content;
              let fileResolved = 0;
              let fileAiUsed = false;

              for (const conflict of conflicts) {
                // Resolve each conflict block
                const ext = file.fileB.split('.').pop();
                const langMap = {
                  'js': 'javascript', 'ts': 'typescript', 'py': 'python',
                  'php': 'php', 'html': 'html', 'css': 'css',
                  'json': 'json', 'md': 'markdown', 'sql': 'sql'
                };
                const language = langMap[ext] || 'javascript';

                try {
                  const resolved = await this.resolveConflictWithAI(
                    file.fileB,
                    conflict.currentVersion,
                    conflict.incomingVersion,
                    language
                  );
                  
                  // Replace the conflict block
                  const conflictBlockStart = content.indexOf('<<<<<<<', conflict.startLine > 0 ? content.lastIndexOf('\n', conflict.startLine) : 0);
                  const conflictBlockEnd = content.indexOf('>>>>>>>', conflictBlockStart) + content.substring(content.indexOf('>>>>>>>', conflictBlockStart)).indexOf('\n') + 1;
                  
                  if (conflictBlockStart >= 0 && conflictBlockEnd > conflictBlockStart) {
                    cleanedContent = content.substring(0, conflictBlockStart) + resolved + '\n' + content.substring(conflictBlockEnd);
                  } else {
                    cleanedContent = cleanedContent.replace(
                      `<<<<<<< HEAD\n${conflict.currentVersion}\n=======\n${conflict.incomingVersion}\n>>>>>>> `,
                      resolved + '\n'
                    );
                  }
                  
                  fileResolved++;
                  fileAiUsed = true;
                } catch (e) {
                  // Fallback: use current version
                  cleanedContent = cleanedContent.replace(
                    `<<<<<<< HEAD\n${conflict.currentVersion}\n=======\n${conflict.incomingVersion}\n>>>>>>> `,
                    conflict.currentVersion + '\n'
                  );
                }
              }

              if (fileResolved > 0) {
                await fs.writeFile(fullPath, cleanedContent, 'utf8');
                console.log(chalk.green(`  ✅ Resolved ${fileResolved} conflict(s) in ${file.fileB}`));
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
      aiUsed
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

  /**
   * Parse conflict blocks from content
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
          incomingVersion: []
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
}

module.exports = ConflictResolver;