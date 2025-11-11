# WordPress Project Detection Improvements

## Overview
The AI Commit Message Generator now has enhanced WordPress project detection and analysis capabilities. These improvements ensure that WordPress projects are properly identified and treated with higher priority, even when Node.js tooling files (like package.json) are present.

## Key Improvements

### 1. Enhanced Project Type Detection (`src/utils/project-type-detector.js`)
- **WordPress Priority Detection**: WordPress projects are now detected with higher priority than generic Node.js projects
- **Comprehensive PHP Analysis**: Scans PHP files for WordPress-specific patterns and functions
- **Directory Structure Recognition**: Properly identifies WordPress core, themes, and plugins directories
- **Pattern Matching**: Detects WordPress patterns like `wp-config.php`, `wp-content`, `wp-includes`, `wp-admin`

### 2. Improved Scope Inference (`src/core/analysis-engine.js`)
- **WordPress-Specific Scopes**: Enhanced patterns to identify WordPress-related changes
- **Priority-Based Sorting**: WordPress scopes now take precedence over generic scopes
- **File Path Analysis**: Better detection of WordPress theme and plugin files
- **Template Recognition**: Identifies WordPress template files (single.php, page.php, etc.)

### 3. Enhanced Semantic Analysis for PHP Files**
- **WordPress Hook Detection**: Identifies `add_action`, `add_filter`, `add_shortcode` hooks
- **WordPress Function Recognition**: Detects common WordPress functions like `wp_enqueue_script`, `get_template_part`, etc.
- **Template Function Detection**: Recognizes WordPress template functions

### 4. Improved AI Prompt Generation**
- **WordPress Context**: AI prompts now include WordPress-specific context information
- **Hook Information**: WordPress hooks and functions are included in semantic analysis
- **Better Commit Messages**: More accurate and WordPress-appropriate commit messages

## How It Works

1. **Project Detection**: When you run the tool in a WordPress project directory:
   - It first checks for WordPress-specific files and patterns
   - Even if `package.json` exists (for tooling), WordPress is prioritized
   - PHP files are analyzed for WordPress patterns

2. **Scope Inference**: The system recognizes:
   - WordPress core files (`wp-includes`, `wp-admin`)
   - Theme files (in `wp-content/themes/`)
   - Plugin files (in `wp-content/plugins/`)
   - Template files (`single.php`, `page.php`, etc.)

3. **Semantic Analysis**: When analyzing diffs:
   - WordPress hooks and functions are identified
   - Changes to WordPress-specific functionality are noted
   - Context is provided to the AI for better commit message generation

## Example

Before this enhancement, a WordPress project with Node.js tooling might have been detected as a generic Node.js project. Now:

- A project with `wp-config.php`, `wp-content/`, and `package.json` is correctly identified as a WordPress project
- Commit messages will reflect WordPress context (e.g., "feat(theme): add custom post type support to single.php")
- Scope detection prioritizes WordPress-specific scopes over generic ones

## Benefits

- **Better Project Recognition**: WordPress projects are properly identified even with mixed technology stacks
- **Improved Commit Messages**: AI generates more appropriate WordPress-specific commit messages
- **Accurate Context**: Better understanding of WordPress-specific changes and functionality
- **Enhanced Analysis**: Deeper understanding of WordPress hooks, functions, and templates