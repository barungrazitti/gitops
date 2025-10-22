# Advanced Code Formatting Guide

## Overview

The AI Commit Generator now includes advanced multi-language code formatting capabilities that go beyond basic linting to provide comprehensive code style enforcement across different programming languages.

## AI Usage Analysis

### Current AI Implementation:

1. **Commit Message Generation** - Primary use case for generating contextual commit messages
2. **Test Failure Fixes** - AI suggests code fixes for failing tests based on error analysis
3. **Conflict Resolution** - AI assists with complex git merge conflicts
4. **Repository Analysis** - AI analyzes code patterns for better commit message suggestions

### NOT Used For:

- **Advanced Linting** - Uses standard tools (ESLint, PHP_CodeSniffer, etc.)
- **Code Formatting** - Uses specialized formatters (Prettier, PHP-CS-Fixer, etc.)

## Supported Languages & Formatters

### JavaScript/TypeScript

- **Tool**: Prettier
- **Files**: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- **Features**: Automatic formatting, consistent style, import sorting

### PHP

- **Tools**:
  - PHP-CS-Fixer (preferred)
  - Laravel Pint
  - PHP_CodeSniffer (phpcbf)
- **Files**: `.php`, `.phtml`
- **Features**: PSR-12 compliance, automatic fixes, custom rules

### HTML/XML

- **Tool**: Prettier
- **Files**: `.html`, `.htm`, `.xml`, `.svg`
- **Features**: Proper indentation, attribute formatting

### CSS/Preprocessors

- **Tool**: Prettier
- **Files**: `.css`, `.scss`, `.sass`, `.less`
- **Features**: Consistent formatting, selector organization

### Other Formats

- **JSON**: Prettier formatting
- **Markdown**: Prettier formatting
- **YAML**: Prettier formatting
- **Vue**: Prettier formatting
- **Svelte**: Prettier formatting

## Usage Examples

### Basic Formatting

```bash
# Check available formatters
aic format --check
aicommit format --check

# Setup formatter configurations
aic format --setup
aicommit format --setup

# Format specific files
aicommit format --file src/index.js src/style.css
```

### Integration with Git Workflow

```bash
# Standard commit with formatting
aic --format-code

# Test validation + formatting
aic --test-validate --format-code

# Commit with specific message + formatting
aic "feat: add new feature" --format-code
```

### Configuration Options

```bash
# Set formatting preferences
aicommit config --set codeFormatting.enabled=true
aicommit config --set codeFormatting.phpTools=true
aicommit config --set codeFormatting.prettierConfig=.prettierrc.custom
```

## Configuration

### Default Configuration

```json
{
  "codeFormatting": {
    "enabled": false,
    "useAdvancedFormatting": true,
    "phpTools": true,
    "htmlTools": true,
    "cssTools": true,
    "jsTools": true,
    "prettierConfig": null,
    "formatTimeout": 30000,
    "autoSetupConfigs": true
  }
}
```

### Prettier Configuration (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### PHP CS Fixer Configuration (.php-cs-fixer.php)

```php
<?php
$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__)
    ->exclude(['vendor', 'node_modules', 'storage'])
    ->name(['*.php', '*.phtml']);

return (new PhpCsFixer\Config())
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
        'trailing_comma_in_multiline' => true,
    ])
    ->setFinder($finder);
```

## Installation Requirements

### For JavaScript/TypeScript Projects

```bash
npm install --save-dev prettier
# or globally
npm install -g prettier
```

### For PHP Projects

```bash
# PHP-CS-Fixer (recommended)
composer require --dev friendsofphp/php-cs-fixer

# Laravel Pint (Laravel projects)
composer require --dev laravel/pint

# PHP_CodeSniffer
composer require --dev squizlabs/php_codesniffer
```

## Workflow Integration

### Standard Workflow with Formatting

1. 🔍 Check repository and changes
2. 📦 Stage all changes
3. 🎨 **Run advanced formatting** (new)
4. 🤖 Generate AI commit message
5. 💾 Commit changes
6. ⬇️ Pull latest changes
7. 🔧 Auto-resolve conflicts
8. ⬆️ Push changes

### Test Validation + Formatting Workflow

1. 🔍 Check repository and changes
2. 📦 Stage all changes
3. 🧪 Run tests and validation
4. 🔧 Auto-fix any issues found
5. 🎨 **Run advanced formatting** (new)
6. 🤖 Generate AI commit message
7. 💾 Commit changes (original + fixed version)
8. ⬇️ Pull latest changes
9. 🔧 Auto-resolve conflicts
10. ⬆️ Push changes

## Benefits

### Code Quality

- **Consistent Style**: Enforces consistent formatting across all supported languages
- **Multi-Language Support**: One tool for all your formatting needs
- **Automatic Integration**: Seamlessly integrated into your git workflow

### Developer Experience

- **Zero Configuration**: Works out of the box with sensible defaults
- **Customizable**: Easy to configure for project-specific needs
- **Fast**: Optimized for performance with parallel processing

### Team Collaboration

- **Consistent Codebase**: Everyone uses the same formatting rules
- **Reduced Reviews**: Less time spent on style-related code reviews
- **Better Readability**: Consistently formatted code is easier to read

## Advanced Features

### Smart File Detection

- Automatically detects file types and applies appropriate formatters
- Ignores vendor directories and generated files
- Supports custom file extensions

### Error Handling

- Graceful fallback when formatters are unavailable
- Detailed error reporting for debugging
- Continues workflow even if some formatters fail

### Performance Optimization

- Parallel processing for multiple files
- Caching of formatter availability checks
- Incremental formatting for large projects

## Troubleshooting

### Common Issues

**Formatter not found:**

```bash
# Install missing formatters
npm install -g prettier
composer require --dev friendsofphp/php-cs-fixer
```

**Configuration conflicts:**

```bash
# Reset to defaults
aicommit config --reset
# Or check current config
aicommit config --list
```

**Permission issues:**

```bash
# Ensure write permissions for config files
chmod 644 .prettierrc .php-cs-fixer.php
```

### Debug Mode

```bash
# Enable verbose output
DEBUG=1 aic --format-code
```

## Future Enhancements

- **More Languages**: Support for Python, Go, Rust, Java
- **Custom Rules**: Project-specific formatting rules
- **IDE Integration**: VS Code, IntelliJ plugins
- **Performance**: Further optimizations for large repositories
- **Cloud Formatters**: Remote formatting services for complex projects
