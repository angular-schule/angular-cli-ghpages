import { logging } from '@angular-devkit/core';

import * as engine from './engine';

// Mock utils.pathExists at module level
vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils');
  return {
    ...actual,
    pathExists: vi.fn(actual.pathExists)
  };
});

import { pathExists } from '../utils';

vi.mock('../gh-pages-fork/lib', async () => {
  const actual = await vi.importActual<typeof import('../gh-pages-fork/lib')>('../gh-pages-fork/lib');
  return {
    ...actual,
    clean: vi.fn(),
    publish: vi.fn()
  };
});

import * as ghpages from '../gh-pages-fork/lib';

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

      // Mock pathExists from utils to return false
      vi.mocked(pathExists).mockResolvedValue(false);

      const nonExistentDir = '/path/to/nonexistent/dir';
      const expectedErrorMessage = 'Dist folder does not exist. Check the dir --dir parameter or build the project first!';

      await expect(
        engine.run(nonExistentDir, { dotfiles: true, notfound: true, nojekyll: true }, logger)
      ).rejects.toThrow(expectedErrorMessage);

      expect(pathExists).toHaveBeenCalledWith(nonExistentDir);

      // Reset mock state
      vi.mocked(pathExists).mockReset();
    });
  });

  describe('prepareOptions - user credentials warnings', () => {
    it('should warn when only name is set without email', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = vi.spyOn(testLogger, 'warn');

      const options = { name: 'John Doe' };
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --name is set. Git will use the local or global git config instead.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should warn when only email is set without name', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = vi.spyOn(testLogger, 'warn');

      const options = { email: 'john@example.com' };
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --email is set. Git will use the local or global git config instead.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn when both name and email are set', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = vi.spyOn(testLogger, 'warn');

      const options = { name: 'John Doe', email: 'john@example.com' };

      const finalOptions = await engine.prepareOptions(options, testLogger);

      expect(finalOptions.user).toEqual({ name: 'John Doe', email: 'john@example.com' });
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('name and --email must be set together'));
    });
  });

  describe('prepareOptions - deprecated noSilent warning', () => {
    it('should warn when noSilent parameter is used', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = vi.spyOn(testLogger, 'warn');

      const options = { noSilent: true };
      const expectedWarning = 'The --no-silent parameter is deprecated and no longer needed. Verbose logging is now always enabled. This parameter will be ignored.';

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn when noSilent is not provided', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = vi.spyOn(testLogger, 'warn');

      const options = {};

      await engine.prepareOptions(options, testLogger);

      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('no-silent'));
    });
  });

  describe('run - publish error handling', () => {
    const logger = new logging.NullLogger();
    const testDir = '/test/dist';
    const options = { dotfiles: true, notfound: true, nojekyll: true };

    beforeEach(() => {
      vi.mocked(pathExists).mockResolvedValue(true);
      vi.mocked(ghpages.clean).mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.mocked(pathExists).mockReset();
      vi.mocked(ghpages.clean).mockReset();
      vi.mocked(ghpages.publish).mockReset();
    });

    it('should reject with the error of publish()', async () => {
      const publishError = new Error('Git push failed: permission denied');
      vi.mocked(ghpages.publish).mockRejectedValue(publishError);

      await expect(engine.run(testDir, options, logger)).rejects.toBe(publishError);
    });

    it('should resolve when publish() resolves', async () => {
      vi.mocked(ghpages.publish).mockResolvedValue(undefined);

      await expect(engine.run(testDir, options, logger)).resolves.toBeUndefined();
    });

    it('should clean the cache before publishing', async () => {
      const calls: string[] = [];
      vi.mocked(ghpages.clean).mockImplementation(async () => { calls.push('clean'); });
      vi.mocked(ghpages.publish).mockImplementation(async () => { calls.push('publish'); });

      await engine.run(testDir, options, logger);

      expect(calls).toEqual(['clean', 'publish']);
    });

    it('should neither clean nor publish during dry-run', async () => {
      await engine.run(testDir, { ...options, dryRun: true }, logger);

      expect(ghpages.clean).not.toHaveBeenCalled();
      expect(ghpages.publish).not.toHaveBeenCalled();
    });

    it('should forward publish() log messages to the logger', async () => {
      const testLogger = new logging.Logger('test');
      const infoSpy = vi.spyOn(testLogger, 'info');
      const message = 'Cloning https://github.com/test/repo.git into /cache';
      vi.mocked(ghpages.publish).mockImplementation(async (_dir, _options, log) => {
        log?.(message);
      });

      await engine.run(testDir, options, testLogger);

      expect(infoSpy).toHaveBeenCalledWith(message);
    });
  });
});
