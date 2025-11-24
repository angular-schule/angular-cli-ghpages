/**
 * Intensive tests for prepareOptions helper functions
 *
 * These tests provide 100% coverage of all option transformation logic
 * by testing each helper function independently.
 */

import * as path from 'path';
import { logging } from '@angular-devkit/core';

import * as helpers from './engine.prepare-options-helpers';
import { Schema } from '../deploy/schema';

describe('prepareOptions helpers - intensive tests', () => {
  let testLogger: logging.Logger;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    testLogger = new logging.Logger('test');
    infoSpy = jest.spyOn(testLogger, 'info');
    warnSpy = jest.spyOn(testLogger, 'warn');
    // Reset environment for each test
    process.env = {};
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('setupMonkeypatch', () => {
    let originalDebuglog: typeof import('util').debuglog;

    beforeEach(() => {
      const util = require('util');
      originalDebuglog = util.debuglog;
    });

    afterEach(() => {
      const util = require('util');
      util.debuglog = originalDebuglog;
    });

    it('should replace util.debuglog with custom implementation', () => {
      const util = require('util');
      const debuglogBefore = util.debuglog;

      helpers.setupMonkeypatch(testLogger);

      expect(util.debuglog).not.toBe(debuglogBefore);
    });

    it('should forward gh-pages debuglog calls to logger', () => {
      helpers.setupMonkeypatch(testLogger);

      const util = require('util');
      const ghPagesLogger = util.debuglog('gh-pages');
      const testMessage = 'Test gh-pages message';

      ghPagesLogger(testMessage);

      expect(infoSpy).toHaveBeenCalledWith(testMessage);
    });

    it('should format messages with placeholders before forwarding', () => {
      helpers.setupMonkeypatch(testLogger);

      const util = require('util');
      const ghPagesLogger = util.debuglog('gh-pages');

      ghPagesLogger('Publishing %d files to %s branch', 42, 'gh-pages');

      expect(infoSpy).toHaveBeenCalledWith('Publishing 42 files to gh-pages branch');
    });

    it('should call original debuglog for non-gh-pages modules', () => {
      const util = require('util');
      const originalDebuglogSpy = jest.fn(originalDebuglog);
      util.debuglog = originalDebuglogSpy;

      helpers.setupMonkeypatch(testLogger);

      const otherLogger = util.debuglog('some-other-module');

      expect(originalDebuglogSpy).toHaveBeenCalledWith('some-other-module');
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('mapNegatedBooleans', () => {
    it('should set dotfiles to false when noDotfiles is true', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = { noDotfiles: true };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.dotfiles).toBe(false);
    });

    it('should set dotfiles to true when noDotfiles is false', () => {
      const options: helpers.PreparedOptions = { dotfiles: false, notfound: true, nojekyll: true };
      const origOptions: Schema = { noDotfiles: false };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.dotfiles).toBe(true);
    });

    it('should NOT modify dotfiles when noDotfiles is undefined', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = {};

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.dotfiles).toBe(true);
    });

    it('should set notfound to false when noNotfound is true', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = { noNotfound: true };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.notfound).toBe(false);
    });

    it('should set notfound to true when noNotfound is false', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: false, nojekyll: true };
      const origOptions: Schema = { noNotfound: false };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.notfound).toBe(true);
    });

    it('should NOT modify notfound when noNotfound is undefined', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = {};

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.notfound).toBe(true);
    });

    it('should set nojekyll to false when noNojekyll is true', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = { noNojekyll: true };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.nojekyll).toBe(false);
    });

    it('should set nojekyll to true when noNojekyll is false', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: false };
      const origOptions: Schema = { noNojekyll: false };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.nojekyll).toBe(true);
    });

    it('should NOT modify nojekyll when noNojekyll is undefined', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = {};

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.nojekyll).toBe(true);
    });

    it('should handle all three negated booleans simultaneously', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = {
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true
      };

      helpers.mapNegatedBooleans(options, origOptions);

      expect(options.dotfiles).toBe(false);
      expect(options.notfound).toBe(false);
      expect(options.nojekyll).toBe(false);
    });
  });

  describe('handleUserCredentials', () => {
    it('should create user object when both name and email are provided', () => {
      const options: helpers.PreparedOptions = {
        dotfiles: true,
        notfound: true,
        nojekyll: true,
        name: 'John Doe',
        email: 'john@example.com'
      };
      const origOptions: Schema = {};

      helpers.handleUserCredentials(options, origOptions, testLogger);

      expect(options['user']).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should warn when only name is provided', () => {
      const options: helpers.PreparedOptions = {
        dotfiles: true,
        notfound: true,
        nojekyll: true,
        name: 'John Doe'
      };
      const origOptions: Schema = {};
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --name is set. Git will use the local or global git config instead.';

      helpers.handleUserCredentials(options, origOptions, testLogger);

      expect(options['user']).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should warn when only email is provided', () => {
      const options: helpers.PreparedOptions = {
        dotfiles: true,
        notfound: true,
        nojekyll: true,
        email: 'john@example.com'
      };
      const origOptions: Schema = {};
      const expectedWarning = 'WARNING: Both --name and --email must be set together to configure git user. Only --email is set. Git will use the local or global git config instead.';

      helpers.handleUserCredentials(options, origOptions, testLogger);

      expect(options['user']).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn or create user object when neither name nor email is provided', () => {
      const options: helpers.PreparedOptions = { dotfiles: true, notfound: true, nojekyll: true };
      const origOptions: Schema = {};

      helpers.handleUserCredentials(options, origOptions, testLogger);

      expect(options['user']).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('warnDeprecatedParameters', () => {
    it('should warn when noSilent is true', () => {
      const origOptions: Schema = { noSilent: true };
      const expectedWarning = 'The --no-silent parameter is deprecated and no longer needed. Verbose logging is now always enabled. This parameter will be ignored.';

      helpers.warnDeprecatedParameters(origOptions, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should warn when noSilent is false', () => {
      const origOptions: Schema = { noSilent: false };
      const expectedWarning = 'The --no-silent parameter is deprecated and no longer needed. Verbose logging is now always enabled. This parameter will be ignored.';

      helpers.warnDeprecatedParameters(origOptions, testLogger);

      expect(warnSpy).toHaveBeenCalledWith(expectedWarning);
    });

    it('should NOT warn when noSilent is undefined', () => {
      const origOptions: Schema = {};

      helpers.warnDeprecatedParameters(origOptions, testLogger);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('appendCIMetadata', () => {
    const baseMessage = 'Deploy to gh-pages';

    it('should append Travis CI metadata when TRAVIS env is set', () => {
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_COMMIT_MESSAGE = 'Fix bug in component';
      process.env.TRAVIS_REPO_SLUG = 'user/repo';
      process.env.TRAVIS_COMMIT = 'abc123def456';
      process.env.TRAVIS_BUILD_ID = '987654321';

      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      expect(options.message).toContain(' -- Fix bug in component');
      expect(options.message).toContain('Triggered by commit: https://github.com/user/repo/commit/abc123def456');
      expect(options.message).toContain('Travis CI build: https://travis-ci.org/user/repo/builds/987654321');
    });

    it('should append CircleCI metadata when CIRCLECI env is set', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_PROJECT_USERNAME = 'johndoe';
      process.env.CIRCLE_PROJECT_REPONAME = 'myproject';
      process.env.CIRCLE_SHA1 = 'fedcba987654';
      process.env.CIRCLE_BUILD_URL = 'https://circleci.com/gh/johndoe/myproject/123';

      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      expect(options.message).toContain('Triggered by commit: https://github.com/johndoe/myproject/commit/fedcba987654');
      expect(options.message).toContain('CircleCI build: https://circleci.com/gh/johndoe/myproject/123');
    });

    it('should append GitHub Actions metadata when GITHUB_ACTIONS env is set', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REPOSITORY = 'angular-schule/angular-cli-ghpages';
      process.env.GITHUB_SHA = '1234567890abcdef';

      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      expect(options.message).toContain('Triggered by commit: https://github.com/angular-schule/angular-cli-ghpages/commit/1234567890abcdef');
    });

    it('should NOT modify message when no CI env is set', () => {
      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      expect(options.message).toBe(baseMessage);
    });

    it('should append metadata from multiple CI environments if present', () => {
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_COMMIT_MESSAGE = 'Update docs';
      process.env.TRAVIS_REPO_SLUG = 'org/repo';
      process.env.TRAVIS_COMMIT = 'abc123';
      process.env.TRAVIS_BUILD_ID = '111';

      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REPOSITORY = 'org/repo';
      process.env.GITHUB_SHA = 'def456';

      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      expect(options.message).toContain('Travis CI build');
      expect(options.message).toContain('Triggered by commit: https://github.com/org/repo/commit/def456');
    });
  });

  describe('injectTokenIntoRepoUrl', () => {
    it('should inject GH_TOKEN into plain HTTPS URL', async () => {
      const inputUrl = 'https://github.com/user/repo.git';
      const token = 'secret_gh_token_123';
      const expectedUrl = 'https://x-access-token:secret_gh_token_123@github.com/user/repo.git';

      process.env.GH_TOKEN = token;

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(expectedUrl);
    });

    it('should inject PERSONAL_TOKEN into plain HTTPS URL', async () => {
      const inputUrl = 'https://github.com/user/repo.git';
      const token = 'personal_token_456';
      const expectedUrl = 'https://x-access-token:personal_token_456@github.com/user/repo.git';

      process.env.PERSONAL_TOKEN = token;

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(expectedUrl);
    });

    it('should inject GITHUB_TOKEN into plain HTTPS URL', async () => {
      const inputUrl = 'https://github.com/user/repo.git';
      const token = 'github_token_789';
      const expectedUrl = 'https://x-access-token:github_token_789@github.com/user/repo.git';

      process.env.GITHUB_TOKEN = token;

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(expectedUrl);
    });

    it('should replace legacy GH_TOKEN placeholder', async () => {
      const inputUrl = 'https://GH_TOKEN@github.com/user/repo.git';
      const token = 'my_token';
      const expectedUrl = 'https://my_token@github.com/user/repo.git';

      process.env.GH_TOKEN = token;

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(expectedUrl);
    });

    it('should NOT inject token if URL already contains x-access-token', async () => {
      const inputUrl = 'https://x-access-token:existing_token@github.com/user/repo.git';

      process.env.GH_TOKEN = 'new_token';

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(inputUrl);
    });

    it('should NOT inject token if URL is not HTTPS github.com', async () => {
      const sshUrl = 'git@github.com:user/repo.git';

      process.env.GH_TOKEN = 'token';

      const options: helpers.PreparedOptions = {
        repo: sshUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(sshUrl);
    });

    it('should handle token with special characters', async () => {
      const inputUrl = 'https://github.com/user/repo.git';
      const token = 'token_with_$pecial_ch@rs!';
      const expectedUrl = 'https://x-access-token:token_with_$pecial_ch@rs!@github.com/user/repo.git';

      process.env.GH_TOKEN = token;

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(expectedUrl);
    });

    it('should NOT inject token when no token env variable is set', async () => {
      const inputUrl = 'https://github.com/user/repo.git';

      const options: helpers.PreparedOptions = {
        repo: inputUrl,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await helpers.injectTokenIntoRepoUrl(options);

      expect(options.repo).toBe(inputUrl);
    });

  });

  describe('getRemoteUrl - gh-pages/lib/git internal API', () => {
    /**
     * CRITICAL: This tests our dependency on gh-pages internal API
     *
     * These tests will BREAK if gh-pages v6+ changes:
     * - gh-pages/lib/git module structure
     * - Git class constructor signature
     * - getRemoteUrl() method signature or behavior
     *
     * Testing approach:
     * - We're IN a git repository, so getRemoteUrl() succeeds and returns a URL
     * - We verify the function is callable and returns string URLs
     * - We test error cases by using invalid parameters
     *
     * If these tests fail after upgrading gh-pages, see the WARNING
     * comment in engine.prepare-options-helpers.ts for fallback options.
     */

    it('should successfully call gh-pages/lib/git Git class and return URL', async () => {
      // This test verifies the internal API still exists and is callable
      const options = { remote: 'origin' };

      // Should successfully return the git remote URL
      const result = await helpers.getRemoteUrl(options);

      // Verify it returns a string URL
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify it looks like a git URL (either SSH or HTTPS)
      const isGitUrl = result.includes('github.com') || result.startsWith('git@') || result.startsWith('https://');
      expect(isGitUrl).toBe(true);
    });

    it('should pass remote option to getRemoteUrl method', async () => {
      const options = {
        remote: 'nonexistent-remote-12345' // Remote that definitely doesn't exist
      };

      // Should throw because this remote doesn't exist in our test repo
      // This verifies the remote option is passed to getRemoteUrl method
      await expect(helpers.getRemoteUrl(options)).rejects.toThrow();
    });

    it('should throw helpful error when not in a git repository', async () => {
      // Change to a non-git directory
      const originalCwd = process.cwd();
      const tempDir = path.join(require('os').tmpdir(), 'not-a-git-repo-test-' + Date.now());
      await require('fs-extra').ensureDir(tempDir);

      try {
        process.chdir(tempDir);
        const options = {};

        await expect(helpers.getRemoteUrl(options))
          .rejects
          .toThrow(); // Will throw error about not being in a git repository
      } finally {
        process.chdir(originalCwd);
        await require('fs-extra').remove(tempDir);
      }
    });

    it('should work with minimal options (defaults to origin remote)', async () => {
      const options = {};

      // Should successfully use defaults and return URL
      const result = await helpers.getRemoteUrl(options);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Should be same as explicitly passing 'origin'
      const explicitOptions = { remote: 'origin' };
      const explicitResult = await helpers.getRemoteUrl(explicitOptions);
      expect(result).toBe(explicitResult);
    });

    it('should return consistent URL for same remote', async () => {
      const options1 = { remote: 'origin' };
      const options2 = { remote: 'origin' };

      const result1 = await helpers.getRemoteUrl(options1);
      const result2 = await helpers.getRemoteUrl(options2);

      // Same remote should return same URL
      expect(result1).toBe(result2);
    });
  });
});
