/**
 * Real filesystem integration tests for file creation
 *
 * These tests use actual temporary directories to verify that:
 * - 404.html is copied from index.html (handled by angular-cli-ghpages)
 * - Dry-run mode prevents file creation
 * - Error handling works as expected
 *
 * Note: CNAME and .nojekyll files are now handled by gh-pages v6+ via options.
 * See "gh-pages v6 delegation" tests below for verification.
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

  describe('404.html file creation', () => {
    it('should create 404.html as exact copy of index.html when notfound is true', async () => {
      // First create an index.html file
      const indexPath = path.join(testDir, 'index.html');
      const indexContent = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test App</h1></body></html>';
      await fse.writeFile(indexPath, indexContent);

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      jest.spyOn(ghpages, 'publish').mockResolvedValue(undefined);

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
      jest.spyOn(ghpages, 'publish').mockResolvedValue(undefined);

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
      jest.spyOn(ghpages, 'publish').mockResolvedValue(undefined);

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

  /**
   * gh-pages v6+ Delegation Tests
   *
   * gh-pages v6.1.0 added native support for creating CNAME and .nojekyll files:
   * - See: https://github.com/tschaub/gh-pages/pull/533
   *
   * We now delegate file creation to gh-pages via the cname/nojekyll options
   * instead of creating them ourselves. This is cleaner and avoids duplication.
   *
   * What we're testing:
   * - Verify we DO pass cname option to gh-pages when provided
   * - Verify we DO pass nojekyll option to gh-pages when enabled
   * - Verify 404.html is still created by us (gh-pages doesn't handle this)
   */
  describe('gh-pages v6 delegation - cname and nojekyll', () => {
    it('should pass cname option to gh-pages when provided', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      let capturedOptions: { cname?: string; nojekyll?: boolean } = {};
      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: { cname?: string; nojekyll?: boolean }) => {
          capturedOptions = options;
          return Promise.resolve();
        }
      );

      const testDomain = 'example.com';
      const options = {
        cname: testDomain,
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
      expect(capturedOptions.cname).toBe(testDomain);
    });

    it('should pass nojekyll option to gh-pages when enabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      let capturedOptions: { cname?: string; nojekyll?: boolean } = {};
      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: { cname?: string; nojekyll?: boolean }) => {
          capturedOptions = options;
          return Promise.resolve();
        }
      );

      const options = {
        nojekyll: true,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
      expect(capturedOptions.nojekyll).toBe(true);
    });

    it('should pass both cname and nojekyll options when both enabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      let capturedOptions: { cname?: string; nojekyll?: boolean } = {};
      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: { cname?: string; nojekyll?: boolean }) => {
          capturedOptions = options;
          return Promise.resolve();
        }
      );

      const testDomain = 'test.example.com';
      const options = {
        cname: testDomain,
        nojekyll: true,
        notfound: true,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
      expect(capturedOptions.cname).toBe(testDomain);
      expect(capturedOptions.nojekyll).toBe(true);

      // Verify 404.html is still created by us (not delegated to gh-pages)
      const notFoundPath = path.join(testDir, '404.html');
      expect(await fse.pathExists(notFoundPath)).toBe(true);
    });

    it('should NOT pass cname when not provided (undefined)', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      let capturedOptions: { cname?: string; nojekyll?: boolean } = {};
      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: { cname?: string; nojekyll?: boolean }) => {
          capturedOptions = options;
          return Promise.resolve();
        }
      );

      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
        // cname not provided
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
      expect(capturedOptions.cname).toBeUndefined();
    });

    it('should pass nojekyll: false when disabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fse.writeFile(indexPath, '<html>test</html>');

      const ghpages = require('gh-pages');
      jest.spyOn(ghpages, 'clean').mockImplementation(() => {});

      let capturedOptions: { cname?: string; nojekyll?: boolean } = {};
      const publishSpy = jest.spyOn(ghpages, 'publish').mockImplementation(
        (dir: string, options: { cname?: string; nojekyll?: boolean }) => {
          capturedOptions = options;
          return Promise.resolve();
        }
      );

      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(publishSpy).toHaveBeenCalled();
      expect(capturedOptions.nojekyll).toBe(false);
    });
  });
});
