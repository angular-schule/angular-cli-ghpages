import { logging } from '@angular-devkit/core';
import * as engine from '../engine/engine';
import { DeployUser } from '../interfaces';

/**
 * EDGE CASE TEST SUITE
 *
 * Tests unusual, boundary, and potentially problematic inputs
 * to ensure robustness across all scenarios.
 *
 * Categories:
 * - Empty/null/undefined values
 * - Special characters
 * - Path edge cases
 * - Token injection edge cases
 * - Multiple environment variable scenarios
 */

describe('Edge Case Tests', () => {
  let logger: logging.LoggerApi;

  beforeEach(() => {
    logger = new logging.NullLogger();
    process.env = {};
  });

  describe('Empty/null/undefined handling', () => {
    it('should handle empty string for repo', async () => {
      const options = { repo: '' };

      // Empty repo should likely discover from git
      await expect(engine.prepareOptions(options, logger)).resolves.toBeDefined();
    });

    it('should handle empty string for message', async () => {
      const options = { message: '' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe('');
    });

    it('should handle empty string for branch', async () => {
      const options = { branch: '' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.branch).toBe('');
    });

    it('should handle empty string for cname', async () => {
      const options = { cname: '' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.cname).toBe('');
    });

    it('should handle undefined values for optional parameters', async () => {
      const options = {
        repo: undefined,
        message: undefined,
        branch: undefined,
        cname: undefined
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Should apply defaults where appropriate
      expect(finalOptions).toBeDefined();
    });
  });

  describe('Special characters in parameters', () => {
    it('should handle commit message with quotes', async () => {
      const options = { message: 'Deploy "version 2.0"' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe('Deploy "version 2.0"');
    });

    it('should handle commit message with single quotes', async () => {
      const options = { message: "Deploy 'version 2.0'" };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe("Deploy 'version 2.0'");
    });

    it('should handle commit message with newlines', async () => {
      const options = { message: 'Line 1\nLine 2\nLine 3' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle commit message with unicode characters', async () => {
      const options = { message: 'Deploy 🚀 with emojis ✨' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe('Deploy 🚀 with emojis ✨');
    });

    it('should handle name with unicode', async () => {
      const options = {
        name: '山田太郎',
        email: 'yamada@example.jp'
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      const user = finalOptions.user as DeployUser | undefined;
      expect(user).toBeDefined();
      expect(user?.name).toBe('山田太郎');
    });

    it('should handle email with plus addressing', async () => {
      const options = {
        name: 'Test User',
        email: 'user+deploy@example.com'
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      const user = finalOptions.user as DeployUser | undefined;
      expect(user).toBeDefined();
      expect(user?.email).toBe('user+deploy@example.com');
    });

    it('should handle branch name with slashes', async () => {
      const options = { branch: 'feature/new-feature' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.branch).toBe('feature/new-feature');
    });

    it('should handle cname with international domain', async () => {
      const options = { cname: 'münchen.de' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.cname).toBe('münchen.de');
    });
  });

  describe('Path edge cases', () => {
    it('should handle paths with spaces', async () => {
      const options = { dir: 'dist/my app/folder' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dir).toBe('dist/my app/folder');
    });

    it('should handle absolute paths', async () => {
      const options = { dir: '/absolute/path/to/dist' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dir).toBe('/absolute/path/to/dist');
    });

    it('should handle paths with dots', async () => {
      const options = { dir: '../dist' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dir).toBe('../dist');
    });

    it('should handle Windows-style paths', async () => {
      const options = { dir: 'C:\\Users\\test\\dist' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dir).toBe('C:\\Users\\test\\dist');
    });

    it('should handle git executable path with spaces', async () => {
      const options = { git: '/Program Files/Git/bin/git', repo: 'https://github.com/test/repo.git' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.git).toBe('/Program Files/Git/bin/git');
    }, 10000);
  });

  describe('Token injection edge cases', () => {
    it('should handle token with special characters', async () => {
      const options = { repo: 'https://github.com/test/repo.git' };
      process.env.GH_TOKEN = 'token_with_$pecial_ch@rs!';

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe('https://x-access-token:token_with_$pecial_ch@rs!@github.com/test/repo.git');
    });

    it('should handle multiple tokens set - GH_TOKEN takes precedence', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'gh_token';
      const expectedUrl = 'https://x-access-token:gh_token@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.GH_TOKEN = token;
      process.env.PERSONAL_TOKEN = 'personal_token';
      process.env.GITHUB_TOKEN = 'github_token';

      const finalOptions = await engine.prepareOptions(options, logger);

      // GH_TOKEN should be used first (based on engine.ts logic)
      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should use PERSONAL_TOKEN when GH_TOKEN not set', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'personal_token';
      const expectedUrl = 'https://x-access-token:personal_token@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.PERSONAL_TOKEN = token;
      process.env.GITHUB_TOKEN = 'github_token';

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should use GITHUB_TOKEN when others not set', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'github_token';
      const expectedUrl = 'https://x-access-token:github_token@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.GITHUB_TOKEN = token;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should not inject token if repo already has x-access-token', async () => {
      const options = { repo: 'https://x-access-token:existing_token@github.com/test/repo.git' };
      process.env.GH_TOKEN = 'new_token';

      const finalOptions = await engine.prepareOptions(options, logger);

      // Should not inject new token if x-access-token already present
      expect(finalOptions.repo).toBe('https://x-access-token:existing_token@github.com/test/repo.git');
    });

    it('should not inject token into non-GitHub URLs', async () => {
      const options = { repo: 'https://gitlab.com/test/repo.git' };
      process.env.GH_TOKEN = 'token';

      const finalOptions = await engine.prepareOptions(options, logger);

      // Token injection only works for github.com
      expect(finalOptions.repo).toBe('https://gitlab.com/test/repo.git');
    });

    it('should handle repo URL without .git suffix', async () => {
      const options = { repo: 'https://github.com/test/repo' };
      process.env.GH_TOKEN = 'token';

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe('https://x-access-token:token@github.com/test/repo');
    });

    it('should handle empty token environment variable', async () => {
      const options = { repo: 'https://github.com/test/repo.git' };
      process.env.GH_TOKEN = '';

      const finalOptions = await engine.prepareOptions(options, logger);

      // Empty token should NOT be injected (actual behavior - empty string is falsy)
      expect(finalOptions.repo).toBe('https://github.com/test/repo.git');
    });
  });

  describe('CI environment combinations', () => {
    it('should handle Travis CI with missing environment variables', async () => {
      const message = 'Deploy';
      const expectedMessage =
        'Deploy -- undefined \n\n' +
        'Triggered by commit: https://github.com/undefined/commit/undefined\n' +
        'Travis CI build: https://travis-ci.org/undefined/builds/undefined';

      const options = { message };
      process.env.TRAVIS = 'true';
      // Missing other Travis env vars

      const finalOptions = await engine.prepareOptions(options, logger);

      // When env vars are undefined, they get stringified as "undefined"
      expect(finalOptions.message).toBe(expectedMessage);
    });

    it('should handle CircleCI with missing environment variables', async () => {
      const message = 'Deploy';
      const expectedMessage =
        'Deploy\n\n' +
        'Triggered by commit: https://github.com/undefined/undefined/commit/undefined\n' +
        'CircleCI build: undefined';

      const options = { message };
      process.env.CIRCLECI = 'true';
      // Missing other CircleCI env vars

      const finalOptions = await engine.prepareOptions(options, logger);

      // When env vars are undefined, they get stringified as "undefined"
      expect(finalOptions.message).toBe(expectedMessage);
    });

    it('should handle GitHub Actions with missing environment variables', async () => {
      const message = 'Deploy';
      const expectedMessage =
        'Deploy\n\n' +
        'Triggered by commit: https://github.com/undefined/commit/undefined';

      const options = { message };
      process.env.GITHUB_ACTIONS = 'true';
      // Missing other GitHub Actions env vars

      const finalOptions = await engine.prepareOptions(options, logger);

      // When env vars are undefined, they get stringified as "undefined"
      expect(finalOptions.message).toBe(expectedMessage);
    });

    it('should handle multiple CI environments set simultaneously', async () => {
      const message = 'Deploy';
      const options = { message };
      process.env.TRAVIS = 'true';
      process.env.CIRCLECI = 'true';
      process.env.GITHUB_ACTIONS = 'true';
      process.env.TRAVIS_COMMIT_MESSAGE = 'Travis commit';
      process.env.CIRCLE_SHA1 = 'circle123';
      process.env.GITHUB_SHA = 'github456';

      const finalOptions = await engine.prepareOptions(options, logger);

      // With multiple CIs, message gets appended multiple times
      // Just verify it doesn't crash and message is modified
      expect(finalOptions.message).toBeDefined();
      expect(typeof finalOptions.message).toBe('string');
      if (finalOptions.message) {
        expect(finalOptions.message.length).toBeGreaterThan(message.length);
      }
    });
  });

  describe('Boolean flag inversions', () => {
    it('should handle conflicting dotfiles values (no- flag dominates)', async () => {
      const options = {
        dotfiles: true, // This shouldn't exist in real usage
        noDotfiles: true
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      // noDotfiles should take precedence and set dotfiles to false
      expect(finalOptions.dotfiles).toBe(false);
    });

    it('should handle all three boolean flags set to no-', async () => {
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
  });

  describe('Extreme values', () => {
    it('should handle very long commit message', async () => {
      const longMessage = 'A'.repeat(10000);
      const options = { message: longMessage };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe(longMessage);
    });

    it('should handle very long repository URL', async () => {
      const longUrl = 'https://github.com/' + 'a'.repeat(1000) + '/repo.git';
      const options = { repo: longUrl };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(longUrl);
    });

    it('should handle very long name', async () => {
      const longName = 'Name '.repeat(100);
      const options = {
        name: longName,
        email: 'test@example.com'
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      const user = finalOptions.user as DeployUser | undefined;
      expect(user).toBeDefined();
      expect(user?.name).toBe(longName);
    });
  });

  describe('Deprecated parameters', () => {
    it('should handle deprecated noSilent parameter gracefully and log warning', async () => {
      const testLogger = new logging.Logger('test');
      const warnSpy = jest.spyOn(testLogger, 'warn');

      const options = { noSilent: true };
      const expectedWarning = 'The --no-silent parameter is deprecated and no longer needed. Verbose logging is now always enabled. This parameter will be ignored.';

      const finalOptions = await engine.prepareOptions(options, testLogger);

      // Verify it doesn't crash and warning is logged
      expect(finalOptions).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });
  });
});
