import { logging } from '@angular-devkit/core';
import * as engine from '../engine/engine';
import { cleanupMonkeypatch } from '../engine/engine.prepare-options-helpers';

/**
 * CRITICAL TEST SUITE: Parameter Passthrough Validation
 *
 * This suite ensures that ALL parameters are correctly passed from our API
 * to gh-pages.publish(). This is essential for upgrading gh-pages and commander
 * without introducing regressions.
 *
 * Testing Philosophy:
 * - Use EXPLICIT expected values, never .toContain() for value testing
 * - Reuse variables when input === output (passthrough)
 * - Use separate input/expected variables when transformation occurs
 * - Every assertion documents exact expected behavior
 */

describe('Parameter Passthrough Tests', () => {
  let logger: logging.LoggerApi;
  const originalEnv = process.env;

  beforeEach(() => {
    // Clean up any previous monkeypatch so each test starts fresh
    cleanupMonkeypatch();

    logger = new logging.NullLogger();
    // Create fresh copy of environment for each test
    // This preserves PATH, HOME, etc. needed by git
    process.env = { ...originalEnv };
    // Clear only CI-specific vars we're testing
    delete process.env.TRAVIS;
    delete process.env.TRAVIS_COMMIT_MESSAGE;
    delete process.env.TRAVIS_REPO_SLUG;
    delete process.env.TRAVIS_COMMIT;
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

  afterAll(() => {
    // Clean up monkeypatch after all tests
    cleanupMonkeypatch();
    // Restore original environment for other test files
    process.env = originalEnv;
  });

  describe('Parameter: repo', () => {
    it('should pass repo URL unchanged when no token in environment', async () => {
      const repo = 'https://github.com/test/repo.git';
      const options = { repo };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough - same variable proves no transformation
      expect(finalOptions.repo).toBe(repo);
    });

    it('should inject GH_TOKEN into HTTPS repo URL', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'secret_token_123';
      const expectedUrl = 'https://x-access-token:secret_token_123@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.GH_TOKEN = token;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should inject PERSONAL_TOKEN into HTTPS repo URL', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'personal_token_456';
      const expectedUrl = 'https://x-access-token:personal_token_456@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.PERSONAL_TOKEN = token;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should inject GITHUB_TOKEN into HTTPS repo URL', async () => {
      const inputUrl = 'https://github.com/test/repo.git';
      const token = 'github_token_789';
      const expectedUrl = 'https://x-access-token:github_token_789@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.GITHUB_TOKEN = token;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should NOT inject token into SSH repo URL', async () => {
      const repo = 'git@github.com:test/repo.git';
      const options = { repo };
      process.env.GH_TOKEN = 'secret_token_123';

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough - tokens don't work with SSH
      expect(finalOptions.repo).toBe(repo);
    });

    it('should handle backwards compatible GH_TOKEN placeholder replacement', async () => {
      const inputUrl = 'https://GH_TOKEN@github.com/test/repo.git';
      const token = 'actual_token';
      const expectedUrl = 'https://actual_token@github.com/test/repo.git';

      const options = { repo: inputUrl };
      process.env.GH_TOKEN = token;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(expectedUrl);
    });

    it('should discover remote URL when repo not specified', async () => {
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      // Should discover repo from current git repository
      expect(finalOptions.repo).toBeDefined();
      expect(typeof finalOptions.repo).toBe('string');
      if (finalOptions.repo) {
        expect(finalOptions.repo.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Parameter: remote', () => {
    it('should default to origin when not specified', async () => {
      const expectedRemote = 'origin';
      const options = { repo: 'https://github.com/test/repo.git' };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.remote).toBe(expectedRemote);
    });

    it('should pass custom remote value unchanged', async () => {
      const remote = 'upstream';
      const options = {
        repo: 'https://github.com/test/repo.git',
        remote
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.remote).toBe(remote);
    });
  });

  describe('Parameter: message', () => {
    it('should pass custom commit message unchanged', async () => {
      const message = 'Custom deployment message';
      const options = { message };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.message).toBe(message);
    });

    it('should append Travis CI metadata to message', async () => {
      const baseMessage = 'Deploy';
      const commitMsg = 'Test commit';
      const repoSlug = 'test/repo';
      const commitSha = 'abc123';
      const buildId = '456';
      const expectedMessage =
        'Deploy -- Test commit \n\n' +
        'Triggered by commit: https://github.com/test/repo/commit/abc123\n' +
        'Travis CI build: https://travis-ci.org/test/repo/builds/456';

      const options = { message: baseMessage };
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_COMMIT_MESSAGE = commitMsg;
      process.env.TRAVIS_REPO_SLUG = repoSlug;
      process.env.TRAVIS_COMMIT = commitSha;
      process.env.TRAVIS_BUILD_ID = buildId;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe(expectedMessage);
    });

    it('should append CircleCI metadata to message', async () => {
      const baseMessage = 'Deploy';
      const username = 'testuser';
      const reponame = 'testrepo';
      const sha = 'def456';
      const buildUrl = 'https://circleci.com/build/123';
      const expectedMessage =
        'Deploy\n\n' +
        'Triggered by commit: https://github.com/testuser/testrepo/commit/def456\n' +
        'CircleCI build: https://circleci.com/build/123';

      const options = { message: baseMessage };
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_PROJECT_USERNAME = username;
      process.env.CIRCLE_PROJECT_REPONAME = reponame;
      process.env.CIRCLE_SHA1 = sha;
      process.env.CIRCLE_BUILD_URL = buildUrl;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe(expectedMessage);
    });

    it('should append GitHub Actions metadata to message', async () => {
      const baseMessage = 'Deploy';
      const repository = 'owner/repo';
      const sha = 'ghi789';
      const expectedMessage =
        'Deploy\n\n' +
        'Triggered by commit: https://github.com/owner/repo/commit/ghi789';

      const options = { message: baseMessage };
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REPOSITORY = repository;
      process.env.GITHUB_SHA = sha;

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.message).toBe(expectedMessage);
    });
  });

  describe('Parameter: branch', () => {
    it('should default to gh-pages', async () => {
      const expectedBranch = 'gh-pages';
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.branch).toBe(expectedBranch);
    });

    it('should pass custom branch name unchanged', async () => {
      const branch = 'main';
      const options = { branch };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.branch).toBe(branch);
    });

    it('should pass branch name docs unchanged', async () => {
      const branch = 'docs';
      const options = { branch };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.branch).toBe(branch);
    });
  });

  describe('Parameter: name and email (user object)', () => {
    it('should create user object when both name and email provided', async () => {
      const name = 'John Doe';
      const email = 'john@example.com';
      const expectedUser = { name, email };

      const options = { name, email };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.user).toEqual(expectedUser);
    });

    it('should NOT create user object when only name provided', async () => {
      const name = 'John Doe';
      const options = { name };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.user).toBeUndefined();
      expect(finalOptions.name).toBe(name);
    });

    it('should NOT create user object when only email provided', async () => {
      const email = 'john@example.com';
      const options = { email };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.user).toBeUndefined();
      expect(finalOptions.email).toBe(email);
    });

    it('should handle name and email with special characters', async () => {
      const name = 'José García-Müller';
      const email = 'josé+test@example.com';
      const expectedUser = { name, email };

      const options = { name, email };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.user).toEqual(expectedUser);
    });
  });

  describe('Parameter: dotfiles (boolean with negation)', () => {
    it('should default dotfiles to true', async () => {
      const expectedDotfiles = true;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(expectedDotfiles);
    });

    it('should set dotfiles to false when noDotfiles is true', async () => {
      const expectedDotfiles = false;
      const options = { noDotfiles: true };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(expectedDotfiles);
    });

    it('should keep dotfiles true when noDotfiles is false', async () => {
      const expectedDotfiles = true;
      const options = { noDotfiles: false };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(expectedDotfiles);
    });
  });

  describe('Parameter: notfound (boolean with negation)', () => {
    it('should default notfound to true', async () => {
      const expectedNotfound = true;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.notfound).toBe(expectedNotfound);
    });

    it('should set notfound to false when noNotfound is true', async () => {
      const expectedNotfound = false;
      const options = { noNotfound: true };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.notfound).toBe(expectedNotfound);
    });

    it('should keep notfound true when noNotfound is false', async () => {
      const expectedNotfound = true;
      const options = { noNotfound: false };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.notfound).toBe(expectedNotfound);
    });
  });

  describe('Parameter: nojekyll (boolean with negation)', () => {
    it('should default nojekyll to true', async () => {
      const expectedNojekyll = true;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.nojekyll).toBe(expectedNojekyll);
    });

    it('should set nojekyll to false when noNojekyll is true', async () => {
      const expectedNojekyll = false;
      const options = { noNojekyll: true };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.nojekyll).toBe(expectedNojekyll);
    });

    it('should keep nojekyll true when noNojekyll is false', async () => {
      const expectedNojekyll = true;
      const options = { noNojekyll: false };

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.nojekyll).toBe(expectedNojekyll);
    });
  });

  describe('Parameter: cname', () => {
    it('should default cname to undefined', async () => {
      const expectedCname = undefined;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.cname).toBe(expectedCname);
    });

    it('should pass custom cname domain unchanged', async () => {
      const cname = 'example.com';
      const options = { cname };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.cname).toBe(cname);
    });

    it('should pass subdomain cname unchanged', async () => {
      const cname = 'app.example.com';
      const options = { cname };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.cname).toBe(cname);
    });
  });

  describe('Parameter: add', () => {
    it('should default add to false', async () => {
      const expectedAdd = false;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.add).toBe(expectedAdd);
    });

    it('should pass add as true when specified', async () => {
      const add = true;
      const options = { add };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.add).toBe(add);
    });
  });

  describe('Parameter: dryRun', () => {
    it('should default dryRun to false', async () => {
      const expectedDryRun = false;
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dryRun).toBe(expectedDryRun);
    });

    it('should pass dryRun as true when specified', async () => {
      const dryRun = true;
      const options = { dryRun };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.dryRun).toBe(dryRun);
    });
  });

  describe('Parameter: git', () => {
    it('should default git to git string', async () => {
      const expectedGit = 'git';
      const options = {};

      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.git).toBe(expectedGit);
    });

    it('should pass custom git executable path unchanged', async () => {
      const git = '/usr/local/bin/git';
      const options = { git, repo: 'https://github.com/test/repo.git' };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Passthrough
      expect(finalOptions.git).toBe(git);
    }, 10000);
  });

  describe('All parameters together', () => {
    it('should handle all parameters specified simultaneously', async () => {
      const dir = 'dist/app';
      const repo = 'https://github.com/test/repo.git';
      const remote = 'upstream';
      const message = 'Deploy all the things';
      const branch = 'production';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      const cname = 'www.example.com';
      const add = true;
      const dryRun = true;
      const git = '/custom/git';

      const options = {
        dir,
        repo,
        remote,
        message,
        branch,
        name,
        email,
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true,
        cname,
        add,
        dryRun,
        git
      };

      const finalOptions = await engine.prepareOptions(options, logger);

      // Verify all passthroughs use same variables
      expect(finalOptions.dir).toBe(dir);
      expect(finalOptions.repo).toBe(repo);
      expect(finalOptions.remote).toBe(remote);
      expect(finalOptions.message).toBe(message);
      expect(finalOptions.branch).toBe(branch);
      expect(finalOptions.user).toEqual({ name, email });
      expect(finalOptions.dotfiles).toBe(false);
      expect(finalOptions.notfound).toBe(false);
      expect(finalOptions.nojekyll).toBe(false);
      expect(finalOptions.cname).toBe(cname);
      expect(finalOptions.add).toBe(add);
      expect(finalOptions.dryRun).toBe(dryRun);
      expect(finalOptions.git).toBe(git);
    });
  });
});
