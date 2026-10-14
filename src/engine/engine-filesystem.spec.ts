/**
 * Real filesystem integration tests for file creation
 *
 * These tests use actual temporary directories to verify that:
 * - the engine never modifies the dist folder
 * - dry-run mode prevents file creation
 *
 * 404.html, CNAME and .nojekyll are written by the publish step of
 * gh-pages-fork; the tests below verify that the options reach it.
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
    vi.mocked(ghpages.publish).mockClear();
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    if (await pathExists(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
    loggerInfoSpy.mockRestore();
  });

  /**
   * publish() writes 404.html (a copy of index.html) into its clone; the
   * engine only passes the notfound option and never modifies dist.
   */
  describe('404.html', () => {
    it('should pass notfound to publish() and leave dist untouched', async () => {
      await fs.writeFile(path.join(testDir, 'index.html'), '<html><body>Test</body></html>');

      await engine.run(testDir, { notfound: true, nojekyll: false, dotfiles: true }, logger);

      expect(vi.mocked(ghpages.publish).mock.calls[0][1].notfound).toBe(true);
      expect(await fs.readdir(testDir)).toEqual(['index.html']);
    });

    it('should pass notfound: false to publish()', async () => {
      await fs.writeFile(path.join(testDir, 'index.html'), '<html><body>Test</body></html>');

      await engine.run(testDir, { notfound: false, nojekyll: false, dotfiles: true }, logger);

      expect(vi.mocked(ghpages.publish).mock.calls[0][1].notfound).toBe(false);
    });

    it('should NOT create 404.html when dry-run is true', async () => {
      await fs.writeFile(path.join(testDir, 'index.html'), '<html><body>Test</body></html>');

      await engine.run(testDir, { notfound: true, nojekyll: false, dotfiles: true, dryRun: true }, logger);

      expect(await pathExists(path.join(testDir, '404.html'))).toBe(false);
      expect(ghpages.publish).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('Dry-run / SKIPPED: copying of index.html to 404.html');
    });
  });

  /**
   * publish() writes CNAME and .nojekyll into its clone; the engine only
   * creates 404.html in dist.
   *
   * What we're testing:
   * - Verify we DO pass cname option to publish() when provided
   * - Verify we DO pass nojekyll option to publish() when enabled
   */
  describe('publish options - cname and nojekyll', () => {
    it('should pass cname option to publish() when provided', async () => {
      const indexPath = path.join(testDir, 'index.html');
      await fs.writeFile(indexPath, '<html>test</html>');

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
      expect(capturedOptions.notfound).toBe(true);
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
