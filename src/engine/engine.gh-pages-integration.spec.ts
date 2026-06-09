/**
 * Integration tests for gh-pages library interaction
 *
 * These tests verify how engine.ts interacts with the gh-pages library:
 * - When gh-pages.clean() is called
 * - What arguments are passed to gh-pages.publish()
 * - Which options are passed through vs. filtered out
 * - Dry-run behavior isolation
 * - Options transformation before passing to gh-pages
 */

import { logging } from '@angular-devkit/core';
import { Mock, MockInstance } from 'vitest';

import * as engine from './engine';
import { cleanupMonkeypatch } from './engine.prepare-options-helpers';

// Mock utils.pathExists at module level
vi.mock('../utils', async () => ({
  ...(await vi.importActual('../utils')),
  pathExists: vi.fn().mockResolvedValue(true)
}));

// Mock Git class from gh-pages to avoid spawning actual git processes
vi.mock('gh-pages/lib/git', () => ({
  default: vi.fn().mockImplementation(() => ({
    getRemoteUrl: vi.fn().mockResolvedValue('https://github.com/test/repo.git')
  }))
}));

describe('engine - gh-pages integration', () => {
  const logger = new logging.NullLogger();
  const originalEnv = process.env;

  // Only spy on gh-pages methods
  let ghpagesCleanSpy: MockInstance;
  let ghpagesPublishSpy: MockInstance;

  beforeEach(() => {
    // Clean up any previous monkeypatch so each test starts fresh
    cleanupMonkeypatch();

    const ghpages = require('gh-pages');

    // Clear any existing mocks from previous tests
    if (ghpagesCleanSpy) {
      ghpagesCleanSpy.mockClear();
    } else {
      ghpagesCleanSpy = vi.spyOn(ghpages, 'clean');
    }

    if (ghpagesPublishSpy) {
      ghpagesPublishSpy.mockClear();
    } else {
      ghpagesPublishSpy = vi.spyOn(ghpages, 'publish');
    }

    // engine uses the callback form of gh-pages.publish() — see #205
    ghpagesCleanSpy.mockImplementation(() => {});
    ghpagesPublishSpy.mockImplementation((_dir: string, _opts: unknown, callback?: (error: Error | null) => void) => {
      if (callback) {
        callback(null);
      }
      return Promise.resolve(undefined);
    });

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
    // Clean up monkeypatch after all tests
    cleanupMonkeypatch();
    // Restore original environment for other test files
    process.env = originalEnv;
  });

  describe('gh-pages.clean() behavior', () => {
    it('should call clean() before publishing in normal mode', async () => {
      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await engine.run(testDir, options, logger);

      expect(ghpagesCleanSpy).toHaveBeenCalledTimes(1);
      expect(ghpagesCleanSpy).toHaveBeenCalledWith();
    });

    it('should NOT call clean() during dry-run', async () => {
      const testDir = '/test/dist';
      const options = {
        dotfiles: true,
        notfound: true,
        nojekyll: true,
        dryRun: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpagesCleanSpy).not.toHaveBeenCalled();
    });

    it('should call clean() before publish() to avoid remote url mismatch', async () => {
      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await engine.run(testDir, options, logger);

      // Verify clean() was called before publish()
      const cleanCallOrder = ghpagesCleanSpy.mock.invocationCallOrder[0];
      const publishCallOrder = ghpagesPublishSpy.mock.invocationCallOrder[0];

      expect(cleanCallOrder).toBeLessThan(publishCallOrder);
    });
  });

  describe('gh-pages.publish() - directory parameter', () => {
    it('should pass the correct directory path to publish()', async () => {
      const testDir = '/test/dist/my-app';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await engine.run(testDir, options, logger);

      expect(ghpagesPublishSpy).toHaveBeenCalledTimes(1);
      // engine uses the callback form of gh-pages.publish() — see #205
      expect(ghpagesPublishSpy).toHaveBeenCalledWith(
        testDir,
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should pass different directory paths correctly', async () => {
      const firstDir = '/first/path';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await engine.run(firstDir, options, logger);

      const actualDir = ghpagesPublishSpy.mock.calls[0][0];
      expect(actualDir).toBe(firstDir);
    });
  });

  describe('gh-pages.publish() - options parameter', () => {
    it('should pass core options to gh-pages', async () => {
      const testDir = '/test/dist';
      const repo = 'https://github.com/test/repo.git';
      const branch = 'main';
      const message = 'Deploy to GitHub Pages';
      const remote = 'upstream';

      const options = {
        repo,
        branch,
        message,
        remote,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.repo).toBe(repo);
      expect(actualOptions.branch).toBe(branch);
      expect(actualOptions.message).toBe(message);
      expect(actualOptions.remote).toBe(remote);
    });

    it('should pass transformed dotfiles boolean to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dotfiles).toBe(true);
    });

    it('should pass dotfiles: false when transformed from noDotfiles: true', async () => {
      const testDir = '/test/dist';
      const options = {
        noDotfiles: true,
        dotfiles: true, // will be overwritten by noDotfiles transformation
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dotfiles).toBe(false);
    });

    it('should pass user credentials object when both name and email provided', async () => {
      const testDir = '/test/dist';
      const userName = 'CI Bot';
      const userEmail = 'ci@example.com';

      const options = {
        name: userName,
        email: userEmail,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.user).toEqual({
        name: userName,
        email: userEmail
      });
    });

    it('should NOT have user object when only name is provided', async () => {
      const testDir = '/test/dist';
      const options = {
        name: 'CI Bot',
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.user).toBeUndefined();
    });

    it('should pass add option for incremental deployment', async () => {
      const testDir = '/test/dist';
      const options = {
        add: true,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.add).toBe(true);
    });

    it('should pass git option to gh-pages', async () => {
      const testDir = '/test/dist';
      const gitPath = '/custom/path/to/git';

      const options = {
        git: gitPath,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.git).toBe(gitPath);
    });

    it('should NOT pass internal dryRun option to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        dryRun: false, // Internal option, should be filtered out
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dryRun).toBeUndefined();
    });

    it('should NOT pass internal noDotfiles option to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noDotfiles: false,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.noDotfiles).toBeUndefined();
    });

    it('should NOT pass internal noNotfound option to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noNotfound: false,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.noNotfound).toBeUndefined();
    });

    it('should NOT pass internal noNojekyll option to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noNojekyll: false,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.noNojekyll).toBeUndefined();
    });

    it('should NOT pass internal notfound option to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        dotfiles: true,
        notfound: true, // Internal only, used for 404.html creation
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      // notfound remains internal - 404.html is still created by angular-cli-ghpages
      expect(actualOptions.notfound).toBeUndefined();
    });

    it('should pass nojekyll option to gh-pages v6+', async () => {
      const testDir = '/test/dist';
      const options = {
        dotfiles: true,
        notfound: true,
        nojekyll: true // gh-pages v6+ handles .nojekyll file creation
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      // nojekyll IS now passed to gh-pages v6+ (delegated file creation)
      expect(actualOptions.nojekyll).toBe(true);
    });

    it('should pass cname option to gh-pages v6+', async () => {
      const testDir = '/test/dist';
      const options = {
        cname: 'example.com', // gh-pages v6+ handles CNAME file creation
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      // cname IS now passed to gh-pages v6+ (delegated file creation)
      expect(actualOptions.cname).toBe('example.com');
    });
  });

  describe('gh-pages.publish() - dry-run mode isolation', () => {
    it('should NOT call publish() during dry-run', async () => {
      const testDir = '/test/dist';
      const options = {
        dryRun: true,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpagesPublishSpy).not.toHaveBeenCalled();
    });

    it('should NOT call clean() during dry-run', async () => {
      const testDir = '/test/dist';
      const options = {
        dryRun: true,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      expect(ghpagesCleanSpy).not.toHaveBeenCalled();
    });

    it('should log what WOULD be published during dry-run', async () => {
      const testLogger = new logging.Logger('test');
      const infoSpy = vi.spyOn(testLogger, 'info');

      const testDir = '/test/dist';
      const repo = 'https://github.com/test/repo.git';
      const branch = 'gh-pages';

      const options = {
        dryRun: true,
        repo,
        branch,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, testLogger);

      // Should log the dry-run preview
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Dry-run / SKIPPED: publishing folder")
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(testDir)
      );
    });
  });

  describe('options transformation verification', () => {
    it('should transform noDotfiles: true to dotfiles: false before passing to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noDotfiles: true,
        dotfiles: true, // will be overwritten
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dotfiles).toBe(false);
      expect(actualOptions.noDotfiles).toBeUndefined();
    });

    it('should transform noDotfiles: false to dotfiles: true before passing to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noDotfiles: false,
        dotfiles: false, // will be overwritten
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dotfiles).toBe(true);
      expect(actualOptions.noDotfiles).toBeUndefined();
    });

    it('should use default dotfiles: true when no noDotfiles is provided', async () => {
      const testDir = '/test/dist';
      const options = {
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(actualOptions.dotfiles).toBe(true);
    });

    it('should NOT pass transformed noNotfound/notfound to gh-pages', async () => {
      const testDir = '/test/dist';
      const options = {
        noNotfound: true,
        dotfiles: true,
        notfound: true, // will be overwritten to false
        nojekyll: true
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      // notfound remains internal - 404.html is still created by angular-cli-ghpages
      expect(actualOptions.notfound).toBeUndefined();
      expect(actualOptions.noNotfound).toBeUndefined();
    });

    it('should pass transformed noNojekyll to nojekyll: false to gh-pages v6+', async () => {
      const testDir = '/test/dist';
      const options = {
        noNojekyll: true,
        dotfiles: true,
        notfound: true,
        nojekyll: true // will be overwritten to false
      };

      await engine.run(testDir, options, logger);

      const actualOptions = ghpagesPublishSpy.mock.calls[0][1] as Record<string, unknown>;
      // nojekyll IS now passed to gh-pages v6+ (delegated file creation)
      expect(actualOptions.nojekyll).toBe(false);
      expect(actualOptions.noNojekyll).toBeUndefined();
    });
  });

  describe('Promise handling integration', () => {
    // engine uses the callback form of gh-pages.publish() — see #205

    it('should invoke gh-pages.publish() with a callback', async () => {
      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await engine.run(testDir, options, logger);

      expect(ghpagesPublishSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should resolve when gh-pages.publish() invokes the callback with no error', async () => {
      ghpagesPublishSpy.mockImplementation((_dir: string, _opts: unknown, callback?: (error: Error | null) => void) => {
        if (callback) {
          callback(null);
        }
        return Promise.resolve(undefined);
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).resolves.toBeUndefined();
    });

    it('should reject when gh-pages.publish() invokes the callback with an error', async () => {
      const publishError = new Error('Git push failed');
      ghpagesPublishSpy.mockImplementation((_dir: string, _opts: unknown, callback?: (error: Error | null) => void) => {
        if (callback) {
          callback(publishError);
        }
        return Promise.resolve(undefined);
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).rejects.toThrow('Git push failed');
    });
  });

  describe('silent-swallow regression (issue #205)', () => {
    // gh-pages@6 absorbs errors into its returned Promise via an internal
    // .then(_, onRejected) handler that doesn't rethrow. The callback, however,
    // still fires with the error. Engine must use the callback form so git
    // failures (e.g. auth errors during clone) surface as rejections.

    it('should reject when gh-pages resolves its promise but delivers an error via callback', async () => {
      const authError = new Error(
        "fatal: Authentication failed for 'https://github.com/owner/repo.git'"
      );

      ghpagesPublishSpy.mockImplementation((_dir: string, _opts: unknown, callback?: (error: Error | null) => void) => {
        if (callback) {
          callback(authError);
        }
        return Promise.resolve(undefined);
      });

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, logger)
      ).rejects.toThrow(/Authentication failed/);
    });

    it('should NOT log the success banner when publish fails via callback', async () => {
      const authError = new Error('fatal: Authentication failed');

      ghpagesPublishSpy.mockImplementation((_dir: string, _opts: unknown, callback?: (error: Error | null) => void) => {
        if (callback) {
          callback(authError);
        }
        return Promise.resolve(undefined);
      });

      const testLogger = new logging.Logger('test');
      const infoSpy = vi.spyOn(testLogger, 'info');

      const testDir = '/test/dist';
      const options = { dotfiles: true, notfound: true, nojekyll: true };

      await expect(
        engine.run(testDir, options, testLogger)
      ).rejects.toThrow();

      const bannerCall = infoSpy.mock.calls.find(
        ([msg]) => typeof msg === 'string' && msg.includes('Successfully published')
      );
      expect(bannerCall).toBeUndefined();
    });
  });
});
