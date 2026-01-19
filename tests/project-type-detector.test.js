/**
 * Unit tests for ProjectTypeDetector
 */

jest.mock('fs-extra');
jest.mock('path');

const fs = require('fs-extra');
const path = require('path');
const ProjectTypeDetector = require('../src/utils/project-type-detector');

describe('ProjectTypeDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    path.join.mockImplementation((...args) => args.join('/'));
    path.isAbsolute.mockReturnValue(false);
  });

  describe('detectProjectType', () => {
    it('should detect Node.js project', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue({
        dependencies: {},
        devDependencies: {}
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('nodejs');
    });

    it('should detect Python project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('requirements.txt')) return true;
        if (p.includes('node_modules')) return false;
        return false;
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('python');
    });

    it('should detect React project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('package.json')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        dependencies: { react: '^18.0.0' },
        devDependencies: {}
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('react');
    });

    it('should detect WordPress project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('wp-config.php')) return true;
        if (p.includes('wp-content')) return true;
        if (p.includes('wp-includes')) return true;
        if (p.includes('wp-admin')) return true;
        if (p.includes('node_modules')) return false;
        return false;
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('wordpress');
      expect(result.primary).toBe('wordpress');
    });

    it('should detect Vue project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('package.json')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        dependencies: { vue: '^3.0.0' },
        devDependencies: {}
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('vue');
    });

    it('should detect Angular project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('package.json')) return true;
        if (p.includes('angular.json')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        dependencies: { '@angular/core': '^17.0.0' },
        devDependencies: {}
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('angular');
    });

    it('should detect Docker project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('Dockerfile')) return true;
        if (p.includes('node_modules')) return false;
        return false;
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('docker');
    });

    it('should detect Java project', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('pom.xml')) return true;
        if (p.includes('node_modules')) return false;
        return false;
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.types).toContain('java');
    });

    it('should handle error gracefully', async () => {
      fs.pathExists.mockRejectedValue(new Error('File system error'));

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.primary).toBe('unknown');
      expect(result.types).toContain('unknown');
    });

    it('should prioritize WordPress over Node.js', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('wp-config.php')) return true;
        if (p.includes('wp-content')) return true;
        if (p.includes('package.json')) return true;
        if (p.includes('node_modules')) return true;
        return false;
      });
      fs.readJson.mockResolvedValue({
        dependencies: { react: '^18.0.0' },
        devDependencies: {}
      });

      const result = await ProjectTypeDetector.detectProjectType('/test/repo');

      expect(result.primary).toBe('wordpress');
      expect(result.types).toContain('wordpress');
      expect(result.types).toContain('nodejs');
      expect(result.types).toContain('react');
    });
  });

  describe('detectWordPress', () => {
    it('should detect WordPress core files', async () => {
      fs.pathExists.mockResolvedValue(true);

      const result = await ProjectTypeDetector.detectWordPress('/test/repo');

      expect(result.isWordPress).toBe(true);
      expect(result.hasCore).toBe(true);
      expect(result.hasConfig).toBe(true);
      expect(result.hasContent).toBe(true);
    });

    it('should detect WordPress themes', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('wp-config.php')) return true;
        if (p.includes('wp-content')) return true;
        if (p.includes('themes')) return true;
        return false;
      });

      const result = await ProjectTypeDetector.detectWordPress('/test/repo');

      expect(result.hasThemes).toBe(true);
    });

    it('should detect WordPress plugins', async () => {
      fs.pathExists.mockImplementation((p) => {
        if (p.includes('wp-config.php')) return true;
        if (p.includes('wp-content')) return true;
        if (p.includes('plugins')) return true;
        return false;
      });

      const result = await ProjectTypeDetector.detectWordPress('/test/repo');

      expect(result.hasPlugins).toBe(true);
    });

    it('should return false when not WordPress', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await ProjectTypeDetector.detectWordPress('/test/repo');

      expect(result.isWordPress).toBe(false);
    });
  });
});
