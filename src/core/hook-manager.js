/**
 * Hook Manager - Manages git hooks installation
 */

const fs = require('fs-extra');
const path = require('path');
const GitManager = require('./git-manager');

class HookManager {
  constructor() {
    this.gitManager = new GitManager();
  }

  /**
   * Install prepare-commit-msg hook
   */
  async install() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const hooksDir = path.join(repoRoot, '.git', 'hooks');
      const hookPath = path.join(hooksDir, 'prepare-commit-msg');

      // Ensure hooks directory exists
      await fs.ensureDir(hooksDir);

      // Check if hook already exists
      if (await fs.pathExists(hookPath)) {
        const existingContent = await fs.readFile(hookPath, 'utf8');

        // Check if our hook is already installed
        if (existingContent.includes('ai-commit-generator')) {
          throw new Error('AI commit generator hook is already installed');
        }

        // Backup existing hook
        const backupPath = `${hookPath}.backup.${Date.now()}`;
        await fs.copy(hookPath, backupPath);
        console.log(`Existing hook backed up to: ${backupPath}`);
      }

      // Create the hook script
      const hookScript = this.generateHookScript();
      await fs.writeFile(hookPath, hookScript, { mode: 0o755 });

      return {
        success: true,
        message: 'Git hook installed successfully',
        path: hookPath,
      };
    } catch (error) {
      throw new Error(`Failed to install git hook: ${error.message}`);
    }
  }

  /**
   * Uninstall prepare-commit-msg hook
   */
  async uninstall() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const hookPath = path.join(
        repoRoot,
        '.git',
        'hooks',
        'prepare-commit-msg'
      );

      if (!(await fs.pathExists(hookPath))) {
        throw new Error('Git hook is not installed');
      }

      const content = await fs.readFile(hookPath, 'utf8');

      // Check if it's our hook
      if (!content.includes('ai-commit-generator')) {
        throw new Error('Existing hook was not created by ai-commit-generator');
      }

      // Remove the hook
      await fs.remove(hookPath);

      // Look for backup files and offer to restore
      const hooksDir = path.dirname(hookPath);
      const backupFiles = await fs.readdir(hooksDir);
      const backups = backupFiles.filter((file) =>
        file.startsWith('prepare-commit-msg.backup.')
      );

      if (backups.length > 0) {
        // Get the most recent backup
        const latestBackup = backups.sort().pop();
        const backupPath = path.join(hooksDir, latestBackup);

        console.log(`Found backup: ${latestBackup}`);
        console.log('To restore it, run:');
        console.log(`mv "${backupPath}" "${hookPath}"`);
      }

      return {
        success: true,
        message: 'Git hook uninstalled successfully',
        backupsFound: backups.length,
      };
    } catch (error) {
      throw new Error(`Failed to uninstall git hook: ${error.message}`);
    }
  }

  /**
   * Check if hook is installed
   */
  async isInstalled() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const hookPath = path.join(
        repoRoot,
        '.git',
        'hooks',
        'prepare-commit-msg'
      );

      if (!(await fs.pathExists(hookPath))) {
        return false;
      }

      const content = await fs.readFile(hookPath, 'utf8');
      return content.includes('ai-commit-generator');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate the hook script
   */
  generateHookScript() {
    return `#!/bin/sh
#
# AI Commit Generator Hook
# This hook automatically generates commit messages using AI
#

# Check if this is an interactive commit (not merge, rebase, etc.)
if [ "$2" != "" ]; then
    exit 0
fi

# Check if commit message is already provided
if [ -s "$1" ]; then
    # If there's already content, don't override
    exit 0
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    exit 0
fi

# Check if there are staged changes
if ! git diff --cached --quiet; then
    # Generate commit message using aicommit
    if command -v aicommit > /dev/null 2>&1; then
        echo "# Generating AI commit message..." >&2
        
        # Generate message and write to commit file
        aicommit generate --dry-run 2>/dev/null | head -1 > "$1" 2>/dev/null
        
        if [ $? -eq 0 ] && [ -s "$1" ]; then
            echo "# AI-generated commit message added" >&2
            echo "# Edit the message above or delete it to write your own" >> "$1"
            echo "#" >> "$1"
        else
            echo "# Failed to generate AI commit message" >&2
        fi
    else
        echo "# aicommit command not found" >&2
        echo "# Install with: npm install -g ai-commit-generator" >&2
    fi
fi

exit 0
`;
  }

  /**
   * Generate a more advanced hook script with options
   */
  generateAdvancedHookScript(options = {}) {
    const {
      autoCommit = false,
      skipOnMerge = true,
      skipOnRebase = true,
      provider = null,
      conventional = true,
    } = options;

    return `#!/bin/sh
#
# AI Commit Generator Hook (Advanced)
# This hook automatically generates commit messages using AI
#

# Configuration
AUTO_COMMIT=${autoCommit ? 'true' : 'false'}
SKIP_ON_MERGE=${skipOnMerge ? 'true' : 'false'}
SKIP_ON_REBASE=${skipOnRebase ? 'true' : 'false'}
PROVIDER="${provider || ''}"
CONVENTIONAL=${conventional ? 'true' : 'false'}

# Check commit type
COMMIT_SOURCE="$2"
COMMIT_SHA="$3"

# Skip for merge commits if configured
if [ "$SKIP_ON_MERGE" = "true" ] && [ "$COMMIT_SOURCE" = "merge" ]; then
    exit 0
fi

# Skip for rebase if configured
if [ "$SKIP_ON_REBASE" = "true" ] && [ "$COMMIT_SOURCE" = "squash" ]; then
    exit 0
fi

# Skip if commit message already exists
if [ -s "$1" ]; then
    exit 0
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    exit 0
fi

# Check if there are staged changes
if ! git diff --cached --quiet; then
    if command -v aicommit > /dev/null 2>&1; then
        echo "# Generating AI commit message..." >&2
        
        # Build command with options
        CMD="aicommit generate"
        
        if [ "$PROVIDER" != "" ]; then
            CMD="$CMD --provider $PROVIDER"
        fi
        
        if [ "$CONVENTIONAL" = "true" ]; then
            CMD="$CMD --conventional"
        fi
        
        if [ "$AUTO_COMMIT" = "true" ]; then
            # Auto-commit mode: generate and commit automatically
            $CMD 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "# Auto-committed with AI-generated message" >&2
                exit 1  # Prevent the normal commit flow
            fi
        else
            # Interactive mode: generate message for editing
            $CMD --dry-run 2>/dev/null | head -1 > "$1" 2>/dev/null
            
            if [ $? -eq 0 ] && [ -s "$1" ]; then
                echo "# AI-generated commit message added" >&2
                echo "# Edit the message above or delete it to write your own" >> "$1"
                echo "#" >> "$1"
            fi
        fi
    else
        echo "# aicommit command not found" >&2
    fi
fi

exit 0
`;
  }

  /**
   * Update hook configuration
   */
  async updateHookConfig(options) {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const hookPath = path.join(
        repoRoot,
        '.git',
        'hooks',
        'prepare-commit-msg'
      );

      if (!(await this.isInstalled())) {
        throw new Error(
          'Hook is not installed. Install it first with --install'
        );
      }

      // Generate new hook script with options
      const hookScript = this.generateAdvancedHookScript(options);
      await fs.writeFile(hookPath, hookScript, { mode: 0o755 });

      return {
        success: true,
        message: 'Hook configuration updated successfully',
        options,
      };
    } catch (error) {
      throw new Error(`Failed to update hook configuration: ${error.message}`);
    }
  }

  /**
   * Get hook status and configuration
   */
  async getStatus() {
    try {
      const repoRoot = await this.gitManager.getRepositoryRoot();
      const hookPath = path.join(
        repoRoot,
        '.git',
        'hooks',
        'prepare-commit-msg'
      );

      const status = {
        installed: await this.isInstalled(),
        path: hookPath,
        exists: await fs.pathExists(hookPath),
      };

      if (status.exists) {
        const content = await fs.readFile(hookPath, 'utf8');
        status.isOurs = content.includes('ai-commit-generator');
        status.size = content.length;

        // Try to extract configuration
        status.config = this.parseHookConfig(content);
      }

      return status;
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse hook configuration from script content
   */
  parseHookConfig(content) {
    const config = {};

    const patterns = {
      autoCommit: /AUTO_COMMIT=(\w+)/,
      skipOnMerge: /SKIP_ON_MERGE=(\w+)/,
      skipOnRebase: /SKIP_ON_REBASE=(\w+)/,
      provider: /PROVIDER="([^"]*)"/,
      conventional: /CONVENTIONAL=(\w+)/,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = content.match(pattern);
      if (match) {
        config[key] =
          match[1] === 'true' ? true : match[1] === 'false' ? false : match[1];
      }
    }

    return config;
  }
}

module.exports = HookManager;
