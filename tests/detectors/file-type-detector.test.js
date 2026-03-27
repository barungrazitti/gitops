/**
 * FileTypeDetector Unit Tests
 */

// Mock fs-extra to avoid filesystem dependency
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

const FileTypeDetector = require('../../src/detectors/file-type-detector');

describe('FileTypeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FileTypeDetector('/test/repo');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('detect()', () => {
    describe('source files', () => {
      it('should detect JavaScript source file', () => {
        const result = detector.detect('src/utils/helper.js');
        expect(result).toEqual({ type: 'source', language: 'javascript', framework: null });
      });

      it('should detect TypeScript source file', () => {
        const result = detector.detect('src/types/index.ts');
        expect(result).toEqual({ type: 'source', language: 'typescript', framework: null });
      });

      it('should detect Python source file', () => {
        const result = detector.detect('src/main.py');
        expect(result).toEqual({ type: 'source', language: 'python', framework: null });
      });

      it('should detect Java source file', () => {
        const result = detector.detect('src/App.java');
        expect(result).toEqual({ type: 'source', language: 'java', framework: null });
      });

      it('should detect Go source file', () => {
        const result = detector.detect('main.go');
        expect(result).toEqual({ type: 'source', language: 'go', framework: null });
      });

      it('should detect Rust source file', () => {
        const result = detector.detect('src/lib.rs');
        expect(result).toEqual({ type: 'source', language: 'rust', framework: null });
      });

      it('should detect PHP source file', () => {
        const result = detector.detect('public/index.php');
        expect(result).toEqual({ type: 'source', language: 'php', framework: null });
      });

      it('should detect Ruby source file', () => {
        const result = detector.detect('lib/server.rb');
        expect(result).toEqual({ type: 'source', language: 'ruby', framework: null });
      });

      it('should detect Swift source file', () => {
        const result = detector.detect('Sources/App/main.swift');
        expect(result).toEqual({ type: 'source', language: 'swift', framework: null });
      });

      it('should detect Kotlin source file', () => {
        const result = detector.detect('src/App.kt');
        expect(result).toEqual({ type: 'source', language: 'kotlin', framework: null });
      });

      it('should detect Vue source file', () => {
        const result = detector.detect('src/components/Button.vue');
        expect(result).toEqual({ type: 'source', language: 'vue', framework: 'vue' });
      });
    });

    describe('test files', () => {
      it('should detect JS test file', () => {
        const result = detector.detect('tests/utils.test.js');
        expect(result).toEqual({ type: 'test', language: 'javascript', framework: null });
      });

      it('should detect spec file', () => {
        const result = detector.detect('src/auth.spec.ts');
        expect(result).toEqual({ type: 'test', language: 'typescript', framework: null });
      });

      it('should prioritize test over source for test files', () => {
        const result = detector.detect('src/auth.test.js');
        expect(result.type).toBe('test');
      });
    });

    describe('config files', () => {
      it('should detect package.json', () => {
        const result = detector.detect('package.json');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect YAML config', () => {
        const result = detector.detect('docker-compose.yml');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect TOML config', () => {
        const result = detector.detect('Cargo.toml');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect Dockerfile', () => {
        const result = detector.detect('Dockerfile');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect Makefile', () => {
        const result = detector.detect('Makefile');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect .env file', () => {
        const result = detector.detect('.env');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });

      it('should detect requirements.txt', () => {
        const result = detector.detect('requirements.txt');
        expect(result).toEqual({ type: 'config', language: null, framework: null });
      });
    });

    describe('docs files', () => {
      it('should detect README', () => {
        const result = detector.detect('README.md');
        expect(result).toEqual({ type: 'docs', language: null, framework: null });
      });

      it('should detect CHANGELOG', () => {
        const result = detector.detect('CHANGELOG.md');
        expect(result).toEqual({ type: 'docs', language: null, framework: null });
      });

      it('should detect LICENSE', () => {
        const result = detector.detect('LICENSE');
        expect(result).toEqual({ type: 'docs', language: null, framework: null });
      });

      it('should detect RST documentation', () => {
        const result = detector.detect('docs/guide.rst');
        expect(result).toEqual({ type: 'docs', language: null, framework: null });
      });
    });

    describe('asset files', () => {
      it('should detect CSS file', () => {
        const result = detector.detect('styles/main.css');
        expect(result).toEqual({ type: 'asset', language: 'css', framework: null });
      });

      it('should detect SCSS file', () => {
        const result = detector.detect('styles/main.scss');
        expect(result).toEqual({ type: 'asset', language: 'css', framework: null });
      });

      it('should detect SVG file', () => {
        const result = detector.detect('assets/logo.svg');
        expect(result).toEqual({ type: 'asset', language: null, framework: null });
      });

      it('should detect PNG file', () => {
        const result = detector.detect('images/icon.png');
        expect(result).toEqual({ type: 'asset', language: null, framework: null });
      });

      it('should detect font file', () => {
        const result = detector.detect('fonts/inter.woff2');
        expect(result).toEqual({ type: 'asset', language: null, framework: null });
      });
    });

    describe('unknown files', () => {
      it('should detect unknown extension', () => {
        const result = detector.detect('data/file.xyz');
        expect(result).toEqual({ type: 'other', language: null, framework: null });
      });
    });

    describe('framework detection', () => {
      it('should detect React framework from content', () => {
        const content = "import React from 'react';\nexport default function App() { return <div />; }";
        const result = detector.detect('src/App.js', content);
        expect(result).toEqual({ type: 'source', language: 'javascript', framework: 'react' });
      });

      it('should detect React with require', () => {
        const content = "const React = require('react');";
        const result = detector.detect('src/App.jsx', content);
        expect(result).toEqual({ type: 'source', language: 'javascript', framework: 'react' });
      });

      it('should detect Angular framework from content', () => {
        const content = "import { Component } from '@angular/core';";
        const result = detector.detect('src/app/app.component.ts', content);
        expect(result).toEqual({ type: 'source', language: 'typescript', framework: 'angular' });
      });

      it('should detect Next.js from content', () => {
        const content = "import { NextResponse } from 'next/server';";
        const result = detector.detect('src/app/page.ts', content);
        expect(result).toEqual({ type: 'source', language: 'typescript', framework: 'nextjs' });
      });

      it('should detect Express from content', () => {
        const content = "const app = express();";
        const result = detector.detect('src/server.js', content);
        expect(result).toEqual({ type: 'source', language: 'javascript', framework: 'express' });
      });

      it('should return null framework without content', () => {
        const result = detector.detect('src/App.tsx');
        expect(result.framework).toBeNull();
      });

      it('should detect Svelte framework from extension', () => {
        const result = detector.detect('src/App.svelte');
        expect(result).toEqual({ type: 'source', language: 'svelte', framework: 'svelte' });
      });
    });
  });

  describe('detectBatch()', () => {
    it('should return per-file results and aggregate summary', () => {
      const files = [
        'src/App.js',
        'src/utils/helper.js',
        'tests/app.test.js',
        'package.json',
        'README.md',
        'styles/main.css',
        'data/file.xyz'
      ];
      const contents = new Map([
        ['src/App.js', "import React from 'react';"]
      ]);

      const result = detector.detectBatch(files, contents);

      expect(result.files).toHaveLength(7);
      expect(result.files[0]).toHaveProperty('path');
      expect(result.files[0]).toHaveProperty('type');
      expect(result.files[0]).toHaveProperty('language');
      expect(result.files[0]).toHaveProperty('framework');
      expect(result.summary).toHaveProperty('totalFiles');
      expect(result.summary.totalFiles).toBe(7);
      expect(result.summary.countByType).toHaveProperty('source');
      expect(result.summary.countByType).toHaveProperty('test');
      expect(result.summary.countByType).toHaveProperty('config');
      expect(result.summary.countByType).toHaveProperty('docs');
      expect(result.summary.countByType.asset).toBe(1);
      expect(result.summary.countByType.other).toBe(1);
      expect(result.summary.countByLanguage).toHaveProperty('javascript');
      expect(result.summary.frameworksDetected).toContain('react');
    });

    it('should handle empty file list', () => {
      const result = detector.detectBatch([]);
      expect(result.files).toHaveLength(0);
      expect(result.summary.totalFiles).toBe(0);
    });
  });
});
