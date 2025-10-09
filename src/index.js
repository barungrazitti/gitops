/**
 * AI Commit Message Generator - Main Class
 */

const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const GitManager = require("./core/git-manager");
const ConfigManager = require("./core/config-manager");
const AIProviderFactory = require("./providers/ai-provider-factory");
const CacheManager = require("./core/cache-manager");
const AnalysisEngine = require("./core/analysis-engine");
const MessageFormatter = require("./core/message-formatter");
const StatsManager = require("./core/stats-manager");
const HookManager = require("./core/hook-manager");

class AICommitGenerator {
  constructor() {
    this.gitManager = new GitManager();
    this.configManager = new ConfigManager();
    this.cacheManager = new CacheManager();
    this.analysisEngine = new AnalysisEngine();
    this.messageFormatter = new MessageFormatter();
    this.statsManager = new StatsManager();
    this.hookManager = new HookManager();
  }

  /**
   * Generate AI commit messages
   */
  async generate(options = {}) {
    const spinner = ora("Initializing AI commit generator...").start();

    try {
      // Load configuration
      const config = await this.configManager.load();
      const mergedOptions = { ...config, ...options };

      // Validate git repository
      spinner.text = "Checking git repository...";
      await this.gitManager.validateRepository();

      // Get staged changes
      spinner.text = "Analyzing staged changes...";
      const diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        spinner.fail(
          "No staged changes found. Please stage your changes first.",
        );
        return;
      }

      // Check cache
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = "Checking cache...";
        messages = await this.cacheManager.get(diff);
      }

      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = "Analyzing repository context...";
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages using AI with fallback logic
        spinner.text = "Generating commit messages...";
        messages = await this.generateWithFallback(diff, {
          context,
          count: parseInt(mergedOptions.count) || 3,
          type: mergedOptions.type,
          language: mergedOptions.language || "en",
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache the results
        if (mergedOptions.cache !== false) {
          await this.cacheManager.set(diff, messages);
        }
      }

      spinner.succeed("Commit messages generated successfully!");

      // Format messages
      const formattedMessages = messages.map((msg) =>
        this.messageFormatter.format(msg, mergedOptions),
      );

      // Show interactive selection
      if (mergedOptions.dryRun) {
        console.log(chalk.yellow("\n🔍 Dry run - Generated messages:"));
        formattedMessages.forEach((msg, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${msg}`));
        });
        return;
      }

      const selectedMessage = await this.selectMessage(formattedMessages);

      if (selectedMessage) {
        // Commit with selected message
        await this.gitManager.commit(selectedMessage);
        console.log(chalk.green("\n✅ Commit created successfully!"));

        // Update statistics
        await this.statsManager.recordCommit(
          mergedOptions.provider || config.defaultProvider,
        );
      }
    } catch (error) {
      spinner.fail(`Failed to generate commit message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Interactive message selection
   */
  async selectMessage(messages) {
    const choices = [
      ...messages.map((msg, index) => ({
        name: `${index + 1}. ${msg}`,
        value: msg,
        short: `Message ${index + 1}`,
      })),
      {
        name: chalk.gray("🔄 Regenerate messages"),
        value: "regenerate",
      },
      {
        name: chalk.gray("✏️  Write custom message"),
        value: "custom",
      },
      {
        name: chalk.gray("❌ Cancel"),
        value: "cancel",
      },
    ];

    const { selectedMessage } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedMessage",
        message: "Select a commit message:",
        choices,
        pageSize: 10,
      },
    ]);

    if (selectedMessage === "cancel") {
      console.log(chalk.yellow("Commit cancelled."));
      return null;
    }

    if (selectedMessage === "regenerate") {
      // TODO: Implement regeneration logic
      console.log(chalk.yellow("Regeneration not implemented yet."));
      return null;
    }

    if (selectedMessage === "custom") {
      const { customMessage } = await inquirer.prompt([
        {
          type: "input",
          name: "customMessage",
          message: "Enter your custom commit message:",
          validate: (input) =>
            input.trim().length > 0 || "Message cannot be empty",
        },
      ]);
      return customMessage;
    }

    return selectedMessage;
  }

  /**
   * Configuration management
   */
  async config(options) {
    if (options.set) {
      const [key, value] = options.set.split("=");
      await this.configManager.set(key, value);
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
    } else if (options.get) {
      const value = await this.configManager.get(options.get);
      console.log(`${options.get}: ${value || "not set"}`);
    } else if (options.list) {
      const config = await this.configManager.load();
      console.log(chalk.cyan("Current configuration:"));
      Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else if (options.reset) {
      await this.configManager.reset();
      console.log(chalk.green("✅ Configuration reset to defaults"));
    }
  }

  /**
   * Interactive setup wizard
   */
  async setup() {
    console.log(chalk.cyan("🚀 AI Commit Generator Setup Wizard\n"));

    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select your preferred AI provider:",
        choices: [
          { name: "OpenAI (GPT-3.5/GPT-4)", value: "openai" },
          { name: "Anthropic Claude", value: "anthropic" },
          { name: "Google Gemini", value: "gemini" },
          { name: "Mistral AI", value: "mistral" },
          { name: "Cohere", value: "cohere" },
          { name: "Groq", value: "groq" },
          { name: "Ollama (Local)", value: "ollama" },
        ],
      },
      {
        type: "password",
        name: "apiKey",
        message: "Enter your API key:",
        when: (answers) => answers.provider !== "ollama",
        validate: (input) => input.trim().length > 0 || "API key is required",
      },
      {
        type: "confirm",
        name: "conventionalCommits",
        message: "Use conventional commit format?",
        default: true,
      },
      {
        type: "list",
        name: "language",
        message: "Select commit message language:",
        choices: [
          { name: "English", value: "en" },
          { name: "Spanish", value: "es" },
          { name: "French", value: "fr" },
          { name: "German", value: "de" },
          { name: "Chinese", value: "zh" },
          { name: "Japanese", value: "ja" },
        ],
        default: "en",
      },
    ]);

    // Save configuration
    await this.configManager.setMultiple({
      defaultProvider: answers.provider,
      apiKey: answers.apiKey,
      conventionalCommits: answers.conventionalCommits,
      language: answers.language,
    });

    console.log(chalk.green("\n✅ Setup completed successfully!"));
    console.log(
      chalk.cyan('You can now use "aicommit" to generate commit messages.'),
    );
  }

  /**
   * Git hook management
   */
  async hook(options) {
    if (options.install) {
      await this.hookManager.install();
      console.log(chalk.green("✅ Git hook installed successfully!"));
    } else if (options.uninstall) {
      await this.hookManager.uninstall();
      console.log(chalk.green("✅ Git hook uninstalled successfully!"));
    } else {
      console.log(chalk.yellow("Please specify --install or --uninstall"));
    }
  }

  /**
   * Generate commit messages with fallback logic
   */
  async generateWithFallback(diff, options) {
    const { preferredProvider, ...generationOptions } = options;
    const providers = ["groq", "ollama"];

    // If user specified a provider, try it first
    let providerOrder = preferredProvider ? [preferredProvider] : [];

    // Add remaining providers for fallback
    providers.forEach((provider) => {
      if (provider !== preferredProvider) {
        providerOrder.push(provider);
      }
    });

    let lastError = null;

    for (const providerName of providerOrder) {
      try {
        const provider = AIProviderFactory.create(providerName);
        const messages = await provider.generateCommitMessages(
          diff,
          generationOptions,
        );

        if (messages && messages.length > 0) {
          // Record successful provider usage
          await this.statsManager.recordCommit(providerName);
          return messages;
        }
      } catch (error) {
        lastError = error;
        console.warn(
          chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`),
        );

        // If it's the preferred provider that failed, try fallback
        if (providerName === preferredProvider) {
          console.log(chalk.blue(`🔄 Falling back to local Ollama model...`));
        }
      }
    }

    // If all providers failed, throw the last error
    throw (
      lastError ||
      new Error("All AI providers failed to generate commit messages")
    );
  }

  /**
   * Show usage statistics
   */
  async stats(options) {
    if (options.reset) {
      await this.statsManager.reset();
      console.log(chalk.green("✅ Statistics reset successfully!"));
      return;
    }

    const stats = await this.statsManager.getStats();
    console.log(chalk.cyan("\n📊 Usage Statistics:"));
    console.log(`Total commits: ${stats.totalCommits}`);
    console.log(`Most used provider: ${stats.mostUsedProvider}`);
    console.log(`Average response time: ${stats.averageResponseTime}ms`);
    console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  }
}

module.exports = AICommitGenerator;
