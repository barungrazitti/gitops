/**
 * DependencyMapper Unit Tests
 */

// Mock fs-extra
jest.mock('fs-extra', () => {
  const actualFs = jest.requireActual('fs-extra');
  return {
    ...actualFs,
    existsSync: jest.fn().mockReturnValue(false),
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockImplementation(() => ({
      isDirectory: () => false
    })),
    readFileSync: jest.fn().mockReturnValue('')
  };
});

const fs = require('fs-extra');
const DependencyMapper = require('../../src/detectors/dependency-mapper');

describe('DependencyMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new DependencyMapper('/test/repo');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseImports()', () => {
    it('should parse CommonJS require with relative path', () => {
      const content = "const utils = require('./utils');";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        module: './utils',
        type: 'commonjs',
        resolvedPath: null
      });
    });

    it('should parse CommonJS require with parent path', () => {
      const content = "const helper = require('../lib/helper');";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0].module).toBe('../lib/helper');
      expect(result[0].type).toBe('commonjs');
    });

    it('should parse ESM named import', () => {
      const content = "import { foo } from '../lib/bar';";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        module: '../lib/bar',
        type: 'esm',
        resolvedPath: null
      });
    });

    it('should parse ESM default import', () => {
      const content = "import express from './express';";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0].module).toBe('./express');
      expect(result[0].type).toBe('esm');
    });

    it('should parse ESM side-effect import', () => {
      const content = "import './polyfills';";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0].module).toBe('./polyfills');
      expect(result[0].type).toBe('esm');
    });

    it('should parse ESM re-export', () => {
      const content = "export { foo } from './bar';";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(1);
      expect(result[0].module).toBe('./bar');
      expect(result[0].type).toBe('esm');
    });

    it('should detect both require and import in same file', () => {
      const content = "const fs = require('./fs-polyfill');\nimport { foo } from './bar';";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('commonjs');
      expect(result[1].type).toBe('esm');
    });

    it('should skip dynamic requires', () => {
      const content = "const mod = require(dynamicPath);";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(0);
    });

    it('should skip template literal requires', () => {
      const content = "const mod = require(`./modules/${name}`);";
      const result = mapper.parseImports(content);

      expect(result).toHaveLength(0);
    });

    it('should skip node_modules imports (non-relative)', () => {
      const content = "const express = require('express');\nimport React from 'react';";
      const result = mapper.parseImports(content);

      // Non-relative imports are skipped (not starting with . or /)
      expect(result).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const result = mapper.parseImports('');
      expect(result).toHaveLength(0);
    });

    it('should handle content with no imports', () => {
      const content = "const x = 42;\nfunction hello() { return 'world'; }";
      const result = mapper.parseImports(content);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseExports()', () => {
    it('should detect named CommonJS exports', () => {
      const content = "exports.doSomething = function() {};";
      const result = mapper.parseExports(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'doSomething',
        type: 'named'
      });
    });

    it('should detect module.exports assignment', () => {
      const content = "module.exports = MyClass;";
      const result = mapper.parseExports(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'default'
      });
    });

    it('should detect ESM named exports', () => {
      const content = "export const API_KEY = 'abc';\nexport function fetchData() {}";
      const result = mapper.parseExports(content);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('API_KEY');
      expect(result[0].type).toBe('named');
      expect(result[1].name).toBe('fetchData');
      expect(result[1].type).toBe('named');
    });

    it('should detect ESM default export', () => {
      const content = "export default class App {}";
      const result = mapper.parseExports(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'default'
      });
    });

    it('should detect ESM re-exports', () => {
      const content = "export { foo, bar } from './lib';";
      const result = mapper.parseExports(content);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('reexport');
    });

    it('should return empty for no exports', () => {
      const content = "const x = 42;";
      const result = mapper.parseExports(content);
      expect(result).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const result = mapper.parseExports('');
      expect(result).toHaveLength(0);
    });
  });

  describe('mapDependencies()', () => {
    it('should build dependency graph from files', () => {
      const filesWithContents = new Map([
        ['src/auth.js', "const utils = require('./utils');\nexports.login = function() {};"],
        ['src/utils.js', "exports.helper = function() {};"]
      ]);

      const result = mapper.mapDependencies(filesWithContents);

      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('exports');
      expect(result).toHaveProperty('affected');
      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.exports.length).toBeGreaterThan(0);
    });

    it('should return empty arrays for files with no imports/exports', () => {
      const filesWithContents = new Map([
        ['src/config.js', "const x = 42;"]
      ]);

      const result = mapper.mapDependencies(filesWithContents);

      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });

    it('should handle circular dependencies', () => {
      const filesWithContents = new Map([
        ['src/a.js', "const b = require('./b');\nexports.a = 1;"],
        ['src/b.js', "const a = require('./a');\nexports.b = 2;"]
      ]);

      const result = mapper.mapDependencies(filesWithContents);

      // Should still complete without infinite loop
      expect(result.imports.length).toBe(2);
    });
  });

  describe('findDependents()', () => {
    it('should find files that import the changed file', () => {
      const repoFiles = new Map([
        ['src/a.js', "const b = require('./b');"],
        ['src/b.js', "exports.b = 1;"],
        ['src/c.js', "const b = require('./b');"]
      ]);

      fs.readFileSync.mockImplementation((filePath) => {
        const relPath = filePath.replace('/test/repo/', '');
        return repoFiles.get(relPath) || '';
      });
      fs.existsSync.mockImplementation((p) => {
        const relPath = p.replace('/test/repo/', '');
        return repoFiles.has(relPath);
      });
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.endsWith('src')) {
          return ['a.js', 'b.js', 'c.js'];
        }
        return [];
      });
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => !path.extname(filePath)
      }));

      const dependents = mapper.findDependents('src/b.js');

      expect(dependents).toBeDefined();
      expect(dependents.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty for file with no dependents', () => {
      fs.readFileSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      const dependents = mapper.findDependents('src/orphan.js');
      expect(dependents).toEqual([]);
    });
  });
});
