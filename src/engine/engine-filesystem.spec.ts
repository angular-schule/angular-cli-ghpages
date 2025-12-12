/**
 * Real filesystem integration tests for file creation
 *
 * These tests use actual temporary directories to verify that:
 * - .nojekyll files are created correctly
 * - CNAME files are created with correct content
 * - 404.html is copied from index.html
 * - Dry-run mode prevents file creation
 * - Error handling works as expected
 */

import { logging } from '@angular-devkit/core';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import * as engine from './engine';
import { cleanupMonkeypatch } from './engine.prepare-options-helpers';

describe('engine - real filesystem tests', () => {
  const logger = new logging.Logger('test');
  let testDir: string;
  let loggerInfoSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Clean up any previous monkeypatch so each test starts fresh
    cleanupMonkeypatch();

    // Create a unique temp directory for each test
    const tmpBase = os.tmpdir();
    const uniqueDir = `angular-cli-ghpages-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testDir = path.join(tmpBase, uniqueDir);
    await fse.ensureDir(testDir);

    // Spy on logger to capture warnings
    loggerInfoSpy = jest.spyOn(logger, 'info');
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    if (await fse.pathExists(testDir)) {
      await fse.remove(testDir);
    }
    loggerInfoSpy.mockRestore();
  });

  afterAll(() => {
    // Clean up monkeypatch after all tests
    cleanupMonkeypatch();
  });

  describe('.nojekyll file creation', () => {
    it('should create .nojekyll file with empty content when nojekyll is true', async () => {
      // Mock gh-pages to prevent actual git operations
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        nojekyll: true,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const nojekyllPath = path.join(testDir, '.nojekyll');
      const exists = await fse.pathExists(nojekyllPath);
      expect(exists).toBe(true);

      const content = await fse.readFile(nojekyllPath, 'utf-8');
      expect(content).toBe('');
    });

    it('should NOT create .nojekyll file when nojekyll is false', async () => {
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const nojekyllPath = path.join(testDir, '.nojekyll');
      const exists = await fse.pathExists(nojekyllPath);
      expect(exists).toBe(false);
    });

    it('should NOT create .nojekyll file when dry-run is true', async () => {
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      const options = {
        nojekyll: true,
        notfound: false,
        dotfiles: true,
        dryRun: true
      };

      await engine.run(testDir, options, logger);

      const nojekyllPath = path.join(testDir, '.nojekyll');
      const exists = await fse.pathExists(nojekyllPath);
      expect(exists).toBe(false);
    });
  });

  describe('CNAME file creation', () => {
    it('should create CNAME file with correct domain content', async () => {
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const testDomain = 'example.com';
      const options = {
        cname: testDomain,
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const cnamePath = path.join(testDir, 'CNAME');
      const exists = await fse.pathExists(cnamePath);
      expect(exists).toBe(true);

      const content = await fse.readFile(cnamePath, 'utf-8');
      expect(content).toBe(testDomain);
    });

    it('should NOT create CNAME file when cname option is not provided', async () => {
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const cnamePath = path.join(testDir, 'CNAME');
      const exists = await fse.pathExists(cnamePath);
      expect(exists).toBe(false);
    });

    it('should NOT create CNAME file when dry-run is true', async () => {
      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      const options = {
        cname: 'example.com',
        nojekyll: false,
        notfound: false,
        dotfiles: true,
        dryRun: true
      };

      await engine.run(testDir, options, logger);

      const cnamePath = path.join(testDir, 'CNAME');
      const exists = await fse.pathExists(cnamePath);
      expect(exists).toBe(false);
    });
  });

  describe('404.html file creation', () => {
    it('should create 404.html as exact copy of index.html when notfound is true', async () => {
      // First create an index.html file
      const indexPath = path.join(testDir, 'index.html');
      const indexContent = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test App</h1></body></html>';
      await fse.writeFile(indexPath, indexContent);

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        notfound: true,
        nojekyll: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await fse.pathExists(notFoundPath);
      expect(exists).toBe(true);

      const notFoundContent = await fse.readFile(notFoundPath, 'utf-8');
      expect(notFoundContent).toBe(indexContent);
    });

    it('should NOT create 404.html when notfound is false', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html><body>Test</body></html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        notfound: false,
        nojekyll: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await fse.pathExists(notFoundPath);
      expect(exists).toBe(false);
    });

    it('should gracefully continue when index.html does not exist (not throw error)', async () => {
      // No index.html created - directory is empty

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const options = {
        notfound: true,
        nojekyll: false,
        dotfiles: true
      };

      // Should NOT throw - this is the critical test for graceful handling
      await expect(
        engine.run(testDir, options, logger)
      ).resolves.toBeUndefined();

      // Should log a warning message
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'index.html could not be copied to 404.html. Proceeding without it.'
      );

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await fse.pathExists(notFoundPath);
      expect(exists).toBe(false);
    });

    it('should NOT create 404.html when dry-run is true', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html><body>Test</body></html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      const options = {
        notfound: true,
        nojekyll: false,
        dotfiles: true,
        dryRun: true
      };

      await engine.run(testDir, options, logger);

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await fse.pathExists(notFoundPath);
      expect(exists).toBe(false);
    });
  });

  describe('multiple files creation', () => {
    it('should create all three files (.nojekyll, CNAME, 404.html) when all options are enabled', async () => {
      // Create index.html for 404.html copy
      const indexPath = path.join(testDir, 'index.html');
      const indexContent = '<html><body>App</body></html>';
      await fse.writeFile(indexPath, indexContent);

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(null));
      });

      const testDomain = 'test.example.com';
      const options = {
        nojekyll: true,
        notfound: true,
        cname: testDomain,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      // Verify .nojekyll
      const nojekyllPath = path.join(testDir, '.nojekyll');
      expect(await fse.pathExists(nojekyllPath)).toBe(true);
      expect(await fse.readFile(nojekyllPath, 'utf-8')).toBe('');

      // Verify CNAME
      const cnamePath = path.join(testDir, 'CNAME');
      expect(await fse.pathExists(cnamePath)).toBe(true);
      expect(await fse.readFile(cnamePath, 'utf-8')).toBe(testDomain);

      // Verify 404.html
      const notFoundPath = path.join(testDir, '404.html');
      expect(await fse.pathExists(notFoundPath)).toBe(true);
      expect(await fse.readFile(notFoundPath, 'utf-8')).toBe(indexContent);
    });
  });

  /**
   * PR #186 COMPATIBILITY: gh-pages v6.1.0+ File Creation
   *
   * Context from PR #186 analysis:
   * - gh-pages v6.1.0 added native support for creating CNAME and .nojekyll files
   * - See: https://github.com/tschaub/gh-pages/pull/533
   * - We create these files BEFORE calling gh-pages (in dist/ directory)
   * - gh-pages v6 will create them AFTER in the cache directory
   *
   * What we're testing:
   * - Our file creation in dist/ works correctly (above tests)
   * - Verify we DON'T pass cname/nojekyll options to gh-pages (they're internal to angular-cli-ghpages)
   * - Document that gh-pages v6 will create duplicate files in cache (not a problem, just inefficient)
   *
   * When upgrading to gh-pages v6:
   * - Option 1: Keep our file creation (works, but inefficient - files created twice)
   * - Option 2: Remove our file creation and pass options to gh-pages (cleaner, but need to test backwards compat)
   *
   * Current status: We create files ourselves, DON'T pass options to gh-pages
   */
  describe('PR #186 - gh-pages v6.1.0+ compatibility', () => {
    it('should NOT pass cname option to gh-pages (internal angular-cli-ghpages option)', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: {cname?: string; nojekyll?: boolean}, callback: (err: Error | null) => void) => {
          // CRITICAL: Verify cname is NOT passed to gh-pages
          expect(options.cname).toBeUndefined();
          setImmediate(() => callback(null));
        }
      );

      const options = {
        cname: 'example.com', // We handle this internally
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
    });

    it('should NOT pass nojekyll option to gh-pages (we handle it ourselves)', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: {cname?: string; nojekyll?: boolean}, callback: (err: Error | null) => void) => {
          // CRITICAL: Verify nojekyll is NOT passed to gh-pages
          // We create the file ourselves, gh-pages v6 would duplicate it
          expect(options.nojekyll).toBeUndefined();
          setImmediate(() => callback(null));
        }
      );

      const options = {
        nojekyll: true, // We handle this internally by creating .nojekyll file
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
    });

    it('should create CNAME file in dist/ (not relying on gh-pages v6 to create it)', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        // gh-pages v6 would create CNAME in cache directory
        // But we create it in dist/ BEFORE calling gh-pages
        setImmediate(() => callback(null));
      });

      const testDomain = 'angular-schule.github.io';
      const options = {
        cname: testDomain,
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      // CRITICAL: Verify CNAME exists in dist/ directory (testDir)
      // This is the directory gh-pages will publish
      const cnamePath = path.join(testDir, 'CNAME');
      const exists = await fse.pathExists(cnamePath);
      expect(exists).toBe(true);

      const content = await fse.readFile(cnamePath, 'utf-8');
      expect(content).toBe(testDomain);

      // Note: gh-pages v6 will ALSO create CNAME in cache directory
      // This means the file exists in TWO places (inefficient but not breaking)
    });
  });
});
