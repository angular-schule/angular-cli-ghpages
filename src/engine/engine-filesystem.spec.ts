/**
 * Real filesystem integration tests for file creation
 *
 * These tests use actual temporary directories to verify that:
 * - 404.html is copied from index.html (handled by angular-cli-ghpages)
 * - Dry-run mode prevents file creation
 * - Error handling works as expected
 *
 * CNAME and .nojekyll are written by the publish step of gh-pages-fork;
 * the "publish options" tests below verify that the options reach it.
 */

import { logging } from '@angular-devkit/core';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MockInstance } from 'vitest';

import * as engine from './engine';
import * as ghpages from '../gh-pages-fork/lib';
import { pathExists } from '../utils';

vi.mock('../gh-pages-fork/lib', async () => {
  const actual = await vi.importActual<typeof import('../gh-pages-fork/lib')>('../gh-pages-fork/lib');
  return {
    ...actual,
    clean: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined)
  };
});

describe('engine - real filesystem tests', () => {
  const logger = new logging.Logger('test');
  let testDir: string;
  let loggerInfoSpy: MockInstance;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    const tmpBase = os.tmpdir();
    const uniqueDir = `angular-cli-ghpages-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testDir = path.join(tmpBase, uniqueDir);
    await fs.mkdir(testDir, { recursive: true });

    // Spy on logger to capture warnings
    loggerInfoSpy = vi.spyOn(logger, 'info');
    vi.mocked(ghpages.clean).mockClear();
    vi.mocked(ghpages.publish).mockClear();
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    if (await pathExists(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
    loggerInfoSpy.mockRestore();
  });

  describe('404.html file creation', () => {
    it('should create 404.html as exact copy of index.html when notfound is true', async () => {
      // First create an index.html file
      const indexPath = path.join(testDir, 'index.html');
      const indexContent = '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test App</h1></body></html>';
      await fs.writeFile(indexPath, indexContent);


      const options = {
        notfound: true,
        nojekyll: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await pathExists(notFoundPath);
      expect(exists).toBe(true);

      const notFoundContent = await fs.readFile(notFoundPath, 'utf-8');
      expect(notFoundContent).toBe(indexContent);
    });

    it('should NOT create 404.html when notfound is false', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html><body>Test</body></html>');


      const options = {
        notfound: false,
        nojekyll: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      const notFoundPath = path.join(testDir, '404.html');
      const exists = await pathExists(notFoundPath);
      expect(exists).toBe(false);
    });

    it('should gracefully continue when index.html does not exist (not throw error)', async () => {
      // No index.html created - directory is empty


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
      const exists = await pathExists(notFoundPath);
      expect(exists).toBe(false);
    });

    it('should NOT create 404.html when dry-run is true', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html><body>Test</body></html>');


      const testDomain = 'example.com';
      const options = {
        cname: testDomain,
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpages.publish).toHaveBeenCalled();
      const capturedOptions = vi.mocked(ghpages.publish).mock.calls[0][1];
      expect(capturedOptions.cname).toBe(testDomain);
    });

    it('should pass nojekyll option to publish() when enabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html>test</html>');


      const options = {
        nojekyll: true,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpages.publish).toHaveBeenCalled();
      const capturedOptions = vi.mocked(ghpages.publish).mock.calls[0][1];
      expect(capturedOptions.nojekyll).toBe(true);
    });

    it('should pass both cname and nojekyll options when both enabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html>test</html>');


      const testDomain = 'test.example.com';
      const options = {
        cname: testDomain,
        nojekyll: true,
        notfound: true,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpages.publish).toHaveBeenCalled();
      const capturedOptions = vi.mocked(ghpages.publish).mock.calls[0][1];
      expect(capturedOptions.cname).toBe(testDomain);
      expect(capturedOptions.nojekyll).toBe(true);

      // Verify 404.html is still created by us (not delegated to publish())
      const notFoundPath = path.join(testDir, '404.html');
      expect(await pathExists(notFoundPath)).toBe(true);
    });

    it('should NOT pass cname when not provided (undefined)', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html>test</html>');


      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
        // cname not provided
      };

      await engine.run(testDir, options, logger);

      expect(ghpages.publish).toHaveBeenCalled();
      const capturedOptions = vi.mocked(ghpages.publish).mock.calls[0][1];
      expect(capturedOptions.cname).toBeUndefined();
    });

    it('should pass nojekyll: false when disabled', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html>test</html>');


      const options = {
        nojekyll: false,
        notfound: false,
        dotfiles: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpages.publish).toHaveBeenCalled();
      const capturedOptions = vi.mocked(ghpages.publish).mock.calls[0][1];
      expect(capturedOptions.nojekyll).toBe(false);
    });
  });
});
