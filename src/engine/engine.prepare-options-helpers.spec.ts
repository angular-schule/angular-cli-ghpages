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
  const originalEnv = process.env;

  beforeEach(() => {
    testLogger = new logging.Logger('test');
    infoSpy = jest.spyOn(testLogger, 'info');
    warnSpy = jest.spyOn(testLogger, 'warn');
    // Create fresh copy of environment for each test
    // This preserves PATH, HOME, etc. needed by git
    process.env = { ...originalEnv };
    // Clear only CI-specific vars we're testing
    delete process.env.TRAVIS;
    delete process.env.TRAVIS_COMMIT;
    delete process.env.TRAVIS_COMMIT_MESSAGE;
    delete process.env.TRAVIS_REPO_SLUG;
    delete process.env.TRAVIS_BUILD_ID;
    delete process.env.CIRCLECI;
    delete process.env.CIRCLE_PROJECT_USERNAME;
    delete process.env.CIRCLE_PROJECT_REPONAME;
    delete process.env.CIRCLE_SHA1;
    delete process.env.CIRCLE_BUILD_URL;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SHA;
    delete process.env.GH_TOKEN;
    delete process.env.PERSONAL_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  afterAll(() => {
    // Restore original environment for other test files
    process.env = originalEnv;
  });

  describe('setupMonkeypatch', () => {
    let originalDebuglog: typeof import('util').debuglog;

    beforeEach(() => {
      // First, clean up any previous monkeypatch state
      helpers.cleanupMonkeypatch();
      const util = require('util');
      originalDebuglog = util.debuglog;
    });

    afterEach(() => {
      // Use our cleanup function to properly restore state
      helpers.cleanupMonkeypatch();
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

    it('should append Travis CI metadata with exact format', () => {
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

      const expectedMessage =
        'Deploy to gh-pages -- Fix bug in component \n\n' +
        'Triggered by commit: https://github.com/user/repo/commit/abc123def456\n' +
        'Travis CI build: https://travis-ci.org/user/repo/builds/987654321';

      expect(options.message).toBe(expectedMessage);
    });

    it('should append CircleCI metadata with exact format', () => {
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

      const expectedMessage =
        'Deploy to gh-pages\n\n' +
        'Triggered by commit: https://github.com/johndoe/myproject/commit/fedcba987654\n' +
        'CircleCI build: https://circleci.com/gh/johndoe/myproject/123';

      expect(options.message).toBe(expectedMessage);
    });

    it('should append GitHub Actions metadata with exact format', () => {
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

      const expectedMessage =
        'Deploy to gh-pages\n\n' +
        'Triggered by commit: https://github.com/angular-schule/angular-cli-ghpages/commit/1234567890abcdef';

      expect(options.message).toBe(expectedMessage);
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

    it('should append metadata from multiple CI environments in correct order', () => {
      // Set up multiple CI environments (Travis, CircleCI, GitHub Actions)
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_COMMIT_MESSAGE = 'Update docs';
      process.env.TRAVIS_REPO_SLUG = 'org/repo';
      process.env.TRAVIS_COMMIT = 'abc123';
      process.env.TRAVIS_BUILD_ID = '111';

      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_PROJECT_USERNAME = 'org';
      process.env.CIRCLE_PROJECT_REPONAME = 'repo';
      process.env.CIRCLE_SHA1 = 'def456';
      process.env.CIRCLE_BUILD_URL = 'https://circleci.com/gh/org/repo/222';

      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REPOSITORY = 'org/repo';
      process.env.GITHUB_SHA = 'ghi789';

      const options: helpers.PreparedOptions = {
        message: baseMessage,
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      helpers.appendCIMetadata(options);

      // Verify Travis appears first, then CircleCI, then GitHub Actions
      expect(options.message).toBeDefined();
      const travisIndex = options.message!.indexOf('Travis CI build');
      const circleIndex = options.message!.indexOf('CircleCI build');
      const ghActionsIndex = options.message!.indexOf('Triggered by commit: https://github.com/org/repo/commit/ghi789');

      expect(travisIndex).toBeGreaterThan(-1);
      expect(circleIndex).toBeGreaterThan(travisIndex);
      expect(ghActionsIndex).toBeGreaterThan(circleIndex);
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

    /**
     * Environment assumptions for this test:
     * - Tests must be run from a git clone of angular-schule/angular-cli-ghpages
     * - The "origin" remote must exist and point to that repository
     * - git must be installed and on PATH
     *
     * If run from a bare copy of files (no .git), this test will fail by design.
     */
    it('should return correct URL from git config and be consistent', async () => {
      // This test verifies the internal API returns ACTUAL git config values
      const options = { remote: 'origin' };

      // Get what git actually says
      const { execSync } = require('child_process');
      const expectedUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();

      // Verify getRemoteUrl returns the same value
      const result = await helpers.getRemoteUrl(options);
      expect(result).toBe(expectedUrl);

      // Verify consistency across multiple calls
      const result2 = await helpers.getRemoteUrl(options);
      expect(result2).toBe(expectedUrl);
      expect(result).toBe(result2);
    });

    it('should throw helpful error for non-existent remote', async () => {
      const options = {
        remote: 'nonexistent-remote-12345' // Remote that definitely doesn't exist
      };

      // Expected message from gh-pages v3.2.3 (lib/git.js lines 213-223)
      // If this fails after upgrading gh-pages, the internal API changed
      await expect(helpers.getRemoteUrl(options))
        .rejects
        .toThrow('Failed to get remote.nonexistent-remote-12345.url (task must either be run in a git repository with a configured nonexistent-remote-12345 remote or must be configured with the "repo" option).');
    });

    it('should throw helpful error when not in a git repository', async () => {
      // Change to a non-git directory
      const originalCwd = process.cwd();
      const tempDir = path.join(require('os').tmpdir(), 'not-a-git-repo-test-' + Date.now());
      await require('fs-extra').ensureDir(tempDir);

      try {
        process.chdir(tempDir);
        const options = { remote: 'origin' };

        // Expected message from gh-pages v3.2.3 (lib/git.js lines 213-223)
        // Note: gh-pages returns same error for both "not in git repo" and "remote doesn't exist"
        await expect(helpers.getRemoteUrl(options))
          .rejects
          .toThrow('Failed to get remote.origin.url (task must either be run in a git repository with a configured origin remote or must be configured with the "repo" option).');
      } finally {
        process.chdir(originalCwd);
        await require('fs-extra').remove(tempDir);
      }
    });
  });
});
