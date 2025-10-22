#!/usr/bin/env node

/**
 * AI Commit Message Generator CLI Entry Point
 */

const { program } = require("commander");
const chalk = require("chalk");
const { version } = require("../package.json");
const AICommitGenerator = require("../src/index.js");

// --- Action Handlers ---

async function handleGenerate(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.generate(options);
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function handleConfig(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.config(options);
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function handleSetup() {
  try {
    const generator = new AICommitGenerator();
    await generator.setup();
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function handleHook(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.hook(options);
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function handleStats(options) {
  try {
    const generator = new AICommitGenerator();
    await generator.stats(options);
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

// --- CLI Configuration ---

program
  .name("aicommit")
  .description("AI-powered commit message generator")
  .version(version, "-v, --version", "display version number");

program
  .command("generate", { isDefault: true })
  .alias("gen")
  .description("Generate AI commit messages for staged changes")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (openai, anthropic, gemini, etc.)",
  )
  .option("-m, --model <model>", "Specific model to use")
  .option("-c, --count <number>", "Number of commit messages to generate", "3")
  .option("-t, --type <type>", "Commit type (conventional commits)")
  .option("-l, --language <lang>", "Language for commit messages", "en")
  .option("--no-cache", "Disable caching")
  .option("--dry-run", "Show what would be committed without making changes")
  .option("--conventional", "Force conventional commit format")
  .option("--test-validate", "Run tests and auto-fix errors before committing")
  .option("--no-auto-fix", "Disable automatic error fixing")
  .option("--push", "Push commits to remote after validation")
  .option("--format-code", "Run advanced multi-language code formatting")
  .option("--no-format", "Disable code formatting")
  .action(handleGenerate);

program
  .command("config")
  .description("Manage configuration settings")
  .option("--set <key=value>", "Set a configuration value")
  .option("--get <key>", "Get a configuration value")
  .option("--list", "List all configuration values")
  .option("--reset", "Reset configuration to defaults")
  .action(handleConfig);

program
  .command("setup")
  .description("Interactive setup wizard")
  .action(handleSetup);

program
  .command("hook")
  .description("Install/uninstall git hooks")
  .option("--install", "Install prepare-commit-msg hook")
  .option("--uninstall", "Uninstall prepare-commit-msg hook")
  .action(handleHook);

program
  .command("stats")
  .description("Show usage statistics")
  .option("--reset", "Reset statistics")
  .action(handleStats);

program
  .command("format")
  .description("Format code with multi-language support")
  .option("--setup", "Setup formatter configuration files")
  .option("--check", "Check available formatters")
  .option("--files <files...>", "Format specific files")
  .action(async (options) => {
    try {
      const CodeFormatter = require("../src/core/code-formatter");
      const formatter = new CodeFormatter();

      if (options.setup) {
        console.log(chalk.cyan("🔧 Setting up formatter configurations..."));
        const configs = await formatter.setupFormatterConfigs();
        console.log(chalk.green("✅ Formatter configurations created:"));
        Object.entries(configs).forEach(([tool, file]) => {
          console.log(chalk.dim(`   ${tool}: ${file}`));
        });
        return;
      }

      if (options.check) {
        console.log(chalk.cyan("🔍 Checking available formatters..."));
        const available = await formatter.checkAvailableFormatters();
        console.log(chalk.cyan("\n📋 Available Formatters:"));
        Object.entries(available).forEach(([tool, isAvailable]) => {
          const status = isAvailable ? chalk.green("✅") : chalk.red("❌");
          console.log(`   ${status} ${tool}`);
        });
        return;
      }

      if (options.files && options.files.length > 0) {
        console.log(
          chalk.cyan(`📝 Formatting ${options.files.length} file(s)...`),
        );
        const results = await formatter.formatFiles(options.files);
        const summary = formatter.generateSummary(results);

        console.log(chalk.cyan(`\n📊 Formatting Results: ${summary.status}`));
        console.log(
          `   Total: ${summary.total} | Formatted: ${summary.formatted} | Failed: ${summary.failed}`,
        );

        if (summary.tools.length > 0) {
          console.log(`   Tools used: ${summary.tools.join(", ")}`);
        }
        return;
      }

      console.log(
        chalk.yellow(
          "Please specify --setup, --check, or provide files to format",
        ),
      );
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// --- Main Execution ---

const main = () => {
  program.parse(process.argv);
};

if (require.main === module) {
  main();
}

module.exports = {
  program,
  handleGenerate,
  handleConfig,
  handleSetup,
  handleHook,
  handleStats,
};
