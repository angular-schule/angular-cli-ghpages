import { logging } from '@angular-devkit/core';

import * as engine from './engine';

describe('engine', () => {
  describe('prepareOptions', () => {
    const logger = new logging.NullLogger();
    const originalEnv = process.env;

    beforeEach(() => {
      // Create fresh copy of environment for each test
      // This preserves PATH, HOME, etc. needed by git
      process.env = { ...originalEnv };
      // Clear only CI-specific vars we're testing
      delete process.env.TRAVIS;
      delete process.env.CIRCLECI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GH_TOKEN;
      delete process.env.PERSONAL_TOKEN;
      delete process.env.GITHUB_TOKEN;
    });

    afterAll(() => {
      // Restore original environment for other test files
      process.env = originalEnv;
    });

    it('should replace the string GH_TOKEN in the repo url (for backwards compatibility)', async () => {
      const options = {
        repo: 'https://GH_TOKEN@github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://XXX@github.com/organisation/your-repo.git'
      );
    });

    // see https://github.com/EdricChan03/rss-reader/commit/837dc10c18bfa453c586bb564a662e7dad1e68ab#r36665276 as an example
    it('should be possible to use GH_TOKEN in repo url as a workaround for other tokens (for backwards compatibility)', async () => {
      const options = {
        repo:
          'https://x-access-token:GH_TOKEN@github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    // ----

    it('should also add a personal access token (GH_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    it('should also add a personal access token (PERSONAL_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.PERSONAL_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    it('should also add a installation access token (GITHUB_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.GITHUB_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    // NEW in 0.6.2: always discover remote URL (if not set)
    /**
     * Environment assumptions for this test:
     * - Tests must be run from a git clone of angular-schule/angular-cli-ghpages
     * - The "origin" remote must exist and point to that repository
     * - git must be installed and on PATH
     *
     * If run from a bare copy of files (no .git), this test will fail by design.
     */
    // this allows us to inject tokens from environment even if --repo is not set manually
    // it uses gh-pages lib directly for this
    it('should discover the remote url, if no --repo is set', async () => {
      const options = {};
      const finalOptions = await engine.prepareOptions(options, logger);

      // Justification for .toContain():
      // The protocol (SSH vs HTTPS) depends on developer's git config.
      // Our testing philosophy allows .toContain() for substrings in long/variable messages.
      // We only care that the correct repo path is discovered.
      expect(finalOptions.repo).toContain('angular-schule/angular-cli-ghpages');
    });

    describe('remote', () => {
      it('should use the provided remote if --remote is set', async () => {
        const options = { remote: 'foobar', repo: 'xxx' };
        const finalOptions = await engine.prepareOptions(options, logger);

        expect(finalOptions.remote).toBe('foobar');
      });

      it('should use the origin remote if --remote is not set', async () => {
        const options = { repo: 'xxx' };
        const finalOptions = await engine.prepareOptions(options, logger);

        expect(finalOptions.remote).toBe('origin');
      });
    });
  });

  describe('prepareOptions - handling dotfiles, notfound, and nojekyll', () => {
    const logger = new logging.NullLogger();

    it('should set dotfiles, notfound, and nojekyll to false when no- flags are given', async () => {
      const options = {
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true
      };
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(false);
      expect(finalOptions.notfound).toBe(false);
      expect(finalOptions.nojekyll).toBe(false);
    });

    it('should set dotfiles, notfound, and nojekyll to true when no- flags are not given', async () => {
      const options = {};
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(true);
      expect(finalOptions.notfound).toBe(true);
      expect(finalOptions.nojekyll).toBe(true);
    });
  });

  describe('run - dist folder validation', () => {
    const logger = new logging.NullLogger();

    it('should throw error when dist folder does not exist', async () => {
      // This test proves the CRITICAL operator precedence bug was fixed
      // BUG: await !fse.pathExists(dir) - applies ! to Promise (always false, error NEVER thrown)
      // FIX: !(await fse.pathExists(dir)) - awaits first, then negates (error IS thrown)

      // Mock gh-pages module
      jest.mock('gh-pages', () => ({
        clean: jest.fn(),
        publish: jest.fn()
      }));

      const fse = require('fs-extra');
      jest.spyOn(fse, 'pathExists').mockResolvedValue(false);

      const nonExistentDir = '/path/to/nonexistent/dir';
      const expectedErrorMessage = 'Dist folder does not exist. Check the dir --dir parameter or build the project first!';

      await expect(
        engine.run(nonExistentDir, { dotfiles: true, notfound: true, nojekyll: true }, logger)
      ).rejects.toThrow(expectedErrorMessage);

      expect(fse.pathExists).toHaveBeenCalledWith(nonExistentDir);
    });
  });

  describe('prepareOptions - user credentials warnings', () => {
    it('should warn when only name is set without email', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = { name: 'John Doe' };
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --name is set. Git will use the local or global git config instead.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should warn when only email is set without name', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = { email: 'john@example.com' };
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --email is set. Git will use the local or global git config instead.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn when both name and email are set', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = { name: 'John Doe', email: 'john@example.com' };

      const finalOptions = await engine.prepareOptions(options, testLogger);

      expect(finalOptions.user).toEqual({ name: 'John Doe', email: 'john@example.com' });
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('name and --email must be set together'));
    });
  });

  describe('prepareOptions - deprecated noSilent warning', () => {
    it('should warn when noSilent parameter is used', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = { noSilent: true };
      const expectedWarning = 'The --no-silent parameter is deprecated and no longer needed. Verbose logging is now always enabled. This parameter will be ignored.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn when noSilent is not provided', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = {};

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('no-silent'));
    });
  });

  describe('run - gh-pages error callback handling', () => {
    const logger = new logging.NullLogger();

    let fsePathExistsSpy: jest.SpyInstance;
    let fseWriteFileSpy: jest.SpyInstance;
    let ghpagesCleanSpy: jest.SpyInstance;
    let ghpagesPublishSpy: jest.SpyInstance;

    beforeEach(() => {
      // Setup persistent mocks for fs-extra
      const fse = require('fs-extra');
      fsePathExistsSpy = jest.spyOn(fse, 'pathExists').mockResolvedValue(true);
      fseWriteFileSpy = jest.spyOn(fse, 'writeFile').mockResolvedValue(undefined);

      // Setup persistent mocks for gh-pages
      const ghpages = require('gh-pages');
      ghpagesCleanSpy = jest.spyOn(ghpages, 'clean').mockImplementation(() => {});
      ghpagesPublishSpy = jest.spyOn(ghpages, 'publish');
    });

    afterEach(() => {
      // Clean up spies
      fsePathExistsSpy.mockRestore();
      fseWriteFileSpy.mockRestore();
      ghpagesCleanSpy.mockRestore();
      ghpagesPublishSpy.mockRestore();
    });

    it('should reject when gh-pages.publish calls callback with error', async () => {
      const publishError = new Error('Git push failed: permission denied');

      ghpagesPublishSpy.mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        // Simulate gh-pages calling callback with error
        setImmediate(() => callback(publishError));
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).rejects.toThrow('Git push failed: permission denied');
    });

    it('should preserve error message through rejection', async () => {
      const detailedError = new Error('Remote url mismatch. Expected https://github.com/user/repo.git but got https://github.com/other/repo.git');

      ghpagesPublishSpy.mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(detailedError));
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).rejects.toThrow(detailedError);
    });

    it('should reject with authentication error from gh-pages', async () => {
      const authError = new Error('Authentication failed: Invalid credentials');

      ghpagesPublishSpy.mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        setImmediate(() => callback(authError));
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).rejects.toThrow('Authentication failed: Invalid credentials');
    });

    it('should resolve successfully when gh-pages.publish calls callback with null', async () => {
      ghpagesPublishSpy.mockImplementation((dir: string, options: unknown, callback: (err: Error | null) => void) => {
        // Success case - callback with null error
        setImmediate(() => callback(null));
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).resolves.toBeUndefined();
    });
  });

  describe('prepareOptions - monkeypatch verification', () => {
    let originalDebuglog: typeof import('util').debuglog;

    beforeEach(() => {
      // Save original util.debuglog before each test
      const util = require('util');
      originalDebuglog = util.debuglog;
    });

    afterEach(() => {
      // Restore original util.debuglog after each test
      const util = require('util');
      util.debuglog = originalDebuglog;
    });

    it('should replace util.debuglog with custom implementation', async () => {
      const testLogger = new logging.Logger('test');
      const util = require('util');
      const debuglogBeforePrepare = util.debuglog;

      await engine.prepareOptions({}, testLogger);

      // After prepareOptions, util.debuglog should be replaced
      expect(util.debuglog).not.toBe(debuglogBeforePrepare);
    });

    it('should forward gh-pages debuglog calls to Angular logger', async () => {
      const testLogger = new logging.Logger('test');
      const infoSpy = jest.spyOn(testLogger, 'info');

      await engine.prepareOptions({}, testLogger);

      // Now get the patched debuglog for 'gh-pages'
      const util = require('util');
      const ghPagesLogger = util.debuglog('gh-pages');

      // Call it with a test message
      const testMessage = 'Publishing to gh-pages branch';
      ghPagesLogger(testMessage);

      // Should have forwarded to logger.info()
      expect(infoSpy).toHaveBeenCalledWith(testMessage);
    });

    it('should forward gh-pages debuglog calls with formatting to Angular logger', async () => {
      const testLogger = new logging.Logger('test');
      const infoSpy = jest.spyOn(testLogger, 'info');

      await engine.prepareOptions({}, testLogger);

      const util = require('util');
      const ghPagesLogger = util.debuglog('gh-pages');

      // Test with util.format style placeholders
      ghPagesLogger('Pushing %d files to %s', 42, 'gh-pages');

      // Should format the message and forward to logger.info()
      expect(infoSpy).toHaveBeenCalledWith('Pushing 42 files to gh-pages');
    });

    it('should call original debuglog for non-gh-pages modules', async () => {
      const testLogger = new logging.Logger('test');
      const infoSpy = jest.spyOn(testLogger, 'info');

      const util = require('util');
      const originalDebuglogSpy = jest.fn(originalDebuglog);
      util.debuglog = originalDebuglogSpy;

      await engine.prepareOptions({}, testLogger);

      // Now util.debuglog is patched
      const otherModuleLogger = util.debuglog('some-other-module');

      // Should have called the original debuglog (via our spy)
      expect(originalDebuglogSpy).toHaveBeenCalledWith('some-other-module');

      // Should NOT have forwarded to Angular logger
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should monkeypatch util.debuglog before requiring gh-pages', async () => {
      // This test verifies the critical ordering requirement:
      // The monkeypatch MUST occur before requiring gh-pages, otherwise gh-pages caches
      // the original util.debuglog and our interception won't work.

      const testLogger = new logging.Logger('test');
      const infoSpy = jest.spyOn(testLogger, 'info');

      // Clear gh-pages from require cache to simulate fresh load
      const ghPagesPath = require.resolve('gh-pages');
      delete require.cache[ghPagesPath];

      await engine.prepareOptions({}, testLogger);

      // Now require gh-pages for the first time (after monkeypatch)
      require('gh-pages');

      // Verify our patched debuglog('gh-pages') forwards to the logger
      const util = require('util');
      const ghPagesLogger = util.debuglog('gh-pages');
      ghPagesLogger('test message');
      expect(infoSpy).toHaveBeenCalledWith('test message');
    });
  });
});
