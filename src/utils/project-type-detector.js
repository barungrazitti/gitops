/**
 * Project Type Detector - Enhanced project type detection with WordPress prioritization
 */

const fs = require('fs-extra');
const path = require('path');

class ProjectTypeDetector {
  /**
   * Detect project type with WordPress prioritization
   */
  static async detectProjectType(repoRoot) {
    try {
      // First, check for WordPress-specific indicators with high priority
      const wordpressInfo = await this.detectWordPress(repoRoot);
      const hasWordPress = wordpressInfo.isWordPress;

      // Check for other project indicators
      const indicators = {
        nodejs: ['package.json', 'node_modules'],
        python: [
          'requirements.txt',
          'setup.py',
          'pyproject.toml',
          '__pycache__',
        ],
        java: ['pom.xml', 'build.gradle', 'src/main/java'],
        react: ['package.json'], // Will check package.json content
        vue: ['package.json'], // Will check package.json content
        angular: ['angular.json', 'package.json'],
        dotnet: ['*.csproj', '*.sln', 'Program.cs'],
        php: ['composer.json', 'index.php'],
        ruby: ['Gemfile', 'Rakefile'],
        go: ['go.mod', 'main.go'],
        rust: ['Cargo.toml', 'src/main.rs'],
        docker: ['Dockerfile', 'docker-compose.yml'],
        wordpress: ['wp-config.php', 'wp-content', 'wp-includes', 'wp-admin'], // Keep for reference
      };

      const detectedTypes = [];

      for (const [type, files] of Object.entries(indicators)) {
        if (type === 'wordpress') continue; // Handled separately with priority

        for (const file of files) {
          const filePath = path.join(repoRoot, file);
          if (await fs.pathExists(filePath)) {
            detectedTypes.push(type);
            break;
          }
        }
      }

      // Add special handling for JavaScript frameworks within existing nodejs detection
      if (detectedTypes.includes('nodejs')) {
        const packageJsonPath = path.join(repoRoot, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            const deps = {
              ...packageJson.dependencies,
              ...packageJson.devDependencies,
            };

            if (deps.react || deps['@types/react']) {
              detectedTypes.push('react');
            }
            if (deps.vue || deps['@vue/cli']) {
              detectedTypes.push('vue');
            }
            if (deps['@angular/core']) {
              detectedTypes.push('angular');
            }
            if (deps.next || deps['next.js']) {
              detectedTypes.push('nextjs');
            }
            if (deps.express || deps.fastify || deps.koa) {
              detectedTypes.push('backend');
            }
            // Add WordPress-related Node.js dependencies
            if (deps['@wordpress'] || deps['wpapi'] || deps['wordpress']) {
              detectedTypes.push('wordpress-related');
            }
          } catch (error) {
            // Ignore package.json parsing errors
          }
        }
      }

      // Check for PHP-specific WordPress files when no clear WordPress detection but PHP exists
      if (detectedTypes.includes('php') || await fs.pathExists(path.join(repoRoot, 'wp-config.php'))) {
        if (!wordpressInfo.isWordPress) {
          // Check for WordPress patterns in PHP files
          const wordpressInPhP = await this.detectWordPressFromPHP(repoRoot);
          if (wordpressInPhP.isWordPress) {
            hasWordPress = true;
            Object.assign(wordpressInfo, wordpressInPhP);
          }
        }
      }

      // If WordPress indicators are strong, prioritize it even if Node.js files exist
      if (hasWordPress) {
        // Add WordPress as primary type if detected
        if (!detectedTypes.includes('wordpress')) {
          detectedTypes.unshift('wordpress'); // Add to beginning to prioritize
        }
        
        // Add WordPress-specific subtypes
        if (wordpressInfo.hasPlugins) {
          detectedTypes.push('wordpress-plugins');
        }
        if (wordpressInfo.hasThemes) {
          detectedTypes.push('wordpress-themes');
        }
        if (wordpressInfo.hasCore) {
          detectedTypes.push('wordpress-core');
        }
      }

      // Determine primary type based on priority order
      const priorityOrder = [
        'wordpress', 'wordpress-core', 'wordpress-themes', 'wordpress-plugins',
        'react', 'vue', 'angular', 'nextjs', 'nodejs', 'backend',
        'java', 'python', 'php', 'go', 'rust', 'dotnet', 
        'docker', 'ruby'
      ];

      let primary = 'unknown';
      for (const type of priorityOrder) {
        if (detectedTypes.includes(type)) {
          primary = type;
          break;
        }
      }

      // If no primary found, use the first detected type
      if (primary === 'unknown' && detectedTypes.length > 0) {
        primary = detectedTypes[0];
      }

      return {
        types: [...new Set(detectedTypes)],
        primary,
        isMonorepo: await this.detectMonorepo(repoRoot),
        hasTests: await this.hasTestFiles(repoRoot),
        hasCI: await this.hasCIConfig(repoRoot),
        wordpress: hasWordPress ? wordpressInfo : null,
      };
    } catch (error) {
      console.warn('Project type detection failed:', error.message);
      return {
        types: ['unknown'],
        primary: 'unknown',
        isMonorepo: false,
        hasTests: false,
        hasCI: false,
        wordpress: null,
      };
    }
  }

  /**
   * Detect WordPress project specifically
   */
  static async detectWordPress(repoRoot) {
    const info = {
      isWordPress: false,
      hasCore: false,
      hasThemes: false,
      hasPlugins: false,
      hasConfig: false,
      hasContent: false
    };

    // Check for WordPress core files
    const wpConfigPath = path.join(repoRoot, 'wp-config.php');
    const wpContentPath = path.join(repoRoot, 'wp-content');
    const wpIncludesPath = path.join(repoRoot, 'wp-includes');
    const wpAdminPath = path.join(repoRoot, 'wp-admin');
    
    info.hasConfig = await fs.pathExists(wpConfigPath);
    info.hasContent = await fs.pathExists(wpContentPath);
    info.hasCore = (await fs.pathExists(wpIncludesPath)) || (await fs.pathExists(wpAdminPath));

    // Check for themes and plugins
    if (info.hasContent) {
      const themesPath = path.join(wpContentPath, 'themes');
      const pluginsPath = path.join(wpContentPath, 'plugins');
      
      info.hasThemes = await fs.pathExists(themesPath);
      info.hasPlugins = await fs.pathExists(pluginsPath);
    }

    info.isWordPress = info.hasConfig || info.hasContent || info.hasCore;

    return info;
  }

  /**
   * Detect WordPress from PHP files and patterns
   */
  static async detectWordPressFromPHP(repoRoot) {
    const info = {
      isWordPress: false,
      hasCore: false,
      hasThemes: false,
      hasPlugins: false,
      hasConfig: false,
      hasContent: false
    };

    // Look for WordPress-specific PHP constants and functions
    const phpFiles = await this.findPHPTemplates(repoRoot);
    for (const phpFile of phpFiles) {
      try {
        const content = await fs.readFile(phpFile, 'utf8');
        
        // Check for WordPress-specific patterns
        if (this.containsWordPressPatterns(content)) {
          info.isWordPress = true;
          
          // Determine type based on file location
          const relativePath = path.relative(repoRoot, phpFile);
          
          if (relativePath.includes('wp-content/themes')) {
            info.hasThemes = true;
          } else if (relativePath.includes('wp-content/plugins')) {
            info.hasPlugins = true;
          } else if (relativePath.includes('wp-includes') || relativePath.includes('wp-admin')) {
            info.hasCore = true;
          }
          
          // If wp-config.php, mark as config
          if (relativePath.includes('wp-config.php')) {
            info.hasConfig = true;
          }
          
          break; // Found WordPress patterns, exit early
        }
      } catch (error) {
        continue; // Skip files that can't be read
      }
    }

    return info;
  }

  /**
   * Check if PHP content contains WordPress patterns
   */
  static containsWordPressPatterns(content) {
    const wordpressPatterns = [
      'wp-config.php',
      'WP_DEBUG',
      'DB_NAME',
      'ABSPATH',
      'WPINC',
      'functions.php',
      'wp_head',
      'wp_footer',
      'the_content',
      'the_title',
      'get_header',
      'get_footer',
      'get_sidebar',
      'wp_enqueue_script',
      'wp_enqueue_style',
      'add_action',
      'add_filter',
      'do_action',
      'apply_filters',
      'get_template_part',
      'the_post_thumbnail',
      'wp_reset_postdata',
      'wp_reset_query',
      'have_posts',
      'the_post',
      'is_admin',
      'wp_die',
      'current_user_can',
      'get_current_user_id',
      'is_user_logged_in',
      'wp_get_current_user',
      'get_option',
      'get_post_meta',
      'get_user_meta',
      'get_term_meta',
      'get_comment_meta',
      'add_shortcode',
      'register_activation_hook',
      'register_deactivation_hook',
      'register_uninstall_hook',
      'WP_PLUGIN_DIR',
      'WP_CONTENT_DIR',
      'WP_PLUGIN_URL',
      'WP_CONTENT_URL',
      'wp_create_nonce',
      'wp_verify_nonce',
      'wp_nonce_field',
      'wp_nonce_url',
      'esc_html',
      'esc_attr',
      'esc_url',
      'esc_js',
      'esc_textarea',
      'wp_kses',
      'wp_kses_post',
      'wp_kses_data',
      'sanitize_text_field',
      'sanitize_email',
      'sanitize_url',
      'current_user_can',
      '__',
      '_e',
      '_n',
      '_x',
      '_nx',
      'esc_html__',
      'esc_html_e',
      'esc_attr__',
      'esc_attr_e',
      'get_posts',
      'get_pages',
      'wp_get_recent_posts',
      'wp_count_posts',
      'get_categories',
      'get_tags',
      'get_terms',
      'wp_get_post_tags',
      'wp_get_post_categories',
      'wp_get_post_terms',
      'get_post',
      'get_page',
      'get_posts',
      'WP_Query',
      'WP_User_Query',
      'WP_Comment_Query',
      'get_option',
      'update_option',
      'add_option',
      'delete_option',
      'get_site_option',
      'update_site_option',
      'add_site_option',
      'delete_site_option',
      'get_user_option',
      'update_user_option',
      'add_user_option',
      'delete_user_option',
      'get_transient',
      'set_transient',
      'delete_transient',
      'get_site_transient',
      'set_site_transient',
      'delete_site_transient',
      'get_option',
      'update_option',
      'add_option',
      'delete_option',
      'get_post',
      'wp_insert_post',
      'wp_update_post',
      'wp_delete_post',
      'wp_insert_user',
      'wp_update_user',
      'wp_delete_user',
      'wp_insert_attachment',
      'wp_insert_comment',
      'wp_update_comment',
      'wp_delete_comment'
    ];

    const lowerContent = content.toLowerCase();
    return wordpressPatterns.some(pattern => lowerContent.includes(pattern.toLowerCase()));
  }

  /**
   * Find PHP template files in the repository
   */
  static async findPHPTemplates(repoRoot, results = []) {
    const items = await fs.readdir(repoRoot);
    
    for (const item of items) {
      const itemPath = path.join(repoRoot, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        if (!item.startsWith('.') && !item.startsWith('node_modules')) {
          await this.findPHPTemplates(itemPath, results);
        }
      } else if (path.extname(item) === '.php') {
        results.push(itemPath);
      }
    }
    
    return results;
  }

  /**
   * Detect if project is a monorepo
   */
  static async detectMonorepo(repoRoot) {
    const monorepoIndicators = [
      'lerna.json',
      'nx.json',
      'rush.json',
      'pnpm-workspace.yaml',
      'yarn.lock', // with workspaces in package.json
    ];

    for (const indicator of monorepoIndicators) {
      if (await fs.pathExists(path.join(repoRoot, indicator))) {
        return true;
      }
    }

    // Check for workspaces in package.json
    try {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        if (packageJson.workspaces) {
          return true;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return false;
  }

  /**
   * Check if project has test files
   */
  static async hasTestFiles(repoRoot) {
    // Simple check for common test directories
    const testDirs = ['test', 'tests', 'spec', '__tests__'];
    for (const dir of testDirs) {
      if (await fs.pathExists(path.join(repoRoot, dir))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if project has CI configuration
   */
  static async hasCIConfig(repoRoot) {
    const ciFiles = [
      '.github/workflows',
      '.gitlab-ci.yml',
      'jenkins.yml',
      'Jenkinsfile',
      '.travis.yml',
      'circle.yml',
      '.circleci/config.yml',
      'azure-pipelines.yml',
    ];

    for (const file of ciFiles) {
      if (await fs.pathExists(path.join(repoRoot, file))) {
        return true;
      }
    }

    return false;
  }
}

module.exports = ProjectTypeDetector;