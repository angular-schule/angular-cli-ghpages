/**
 * Behavioral snapshot tests for gh-pages-fork publish()
 *
 * These tests pin the git commands that publish() executes, in order and with
 * their arguments, plus the files it copies. Any change to the fork that
 * alters this behavior fails here.
 *
 * Approach: Mock child_process and gh-pages-fork/lib/util (copy, getUser), use real filesystem
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { logging } from '@angular-devkit/core';

import { FakeResult, fakeSpawn, gitSubcommand, SpawnCall, withoutConfigArgs } from '../test-helpers/git';
import * as engine from './engine';

/**
 * Whitelist of git subcommands that publish() may run.
 *
 * Strict whitelist: any new git operation must be added here first,
 * so it can't slip in unnoticed.
 */
const EXPECTED_GIT_COMMANDS = [
  'ls-remote', 'clone', 'init', 'remote', 'symbolic-ref', 'read-tree',
  'add', 'config', 'diff-index', 'commit', 'push'
];

const { mockSpawn, mockCopy, mockGetUser } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockCopy: vi.fn(() => Promise.resolve()),
  mockGetUser: vi.fn(() => Promise.resolve(null))
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

vi.mock('../gh-pages-fork/lib/util', async () => ({
  ...(await vi.importActual('../gh-pages-fork/lib/util')),
  copy: mockCopy,
  getUser: mockGetUser
}));

import * as ghPages from '../gh-pages-fork/lib';

describe('gh-pages-fork publish() - behavioral snapshot', () => {
  let tempDir: string;
  let basePath: string;
  let spawnCalls: SpawnCall[];
  let originalEnv: NodeJS.ProcessEnv;
  // Per-test override: return a result to replace the default response for a git call
  let spawnOverride: ((args: string[]) => FakeResult | undefined) | undefined;

  function respond(call: SpawnCall): FakeResult | undefined {
    const subcommand = gitSubcommand(call.args);
    if (call.cmd === 'git' && subcommand && !EXPECTED_GIT_COMMANDS.includes(subcommand)) {
      throw new Error(`Unexpected git command: ${subcommand}. Add to whitelist if intentional.`);
    }
    const args = withoutConfigArgs(call.args);
    const override = spawnOverride?.(args);
    if (override) {
      return override;
    }
    // exit code 1: there are changes to commit
    return args[0] === 'diff-index' ? { code: 1 } : undefined;
  }

  // Git calls by subcommand, without the leading `-c` pairs
  function gitCalls(subcommand?: string): string[][] {
    return spawnCalls
      .filter((call) => call.cmd === 'git')
      .map((call) => withoutConfigArgs(call.args))
      .filter((args) => !subcommand || args[0] === subcommand);
  }

  function gitCommands(): string[] {
    return gitCalls().map((args) => args[0]);
  }

  beforeAll(async () => {
    // Create a real temp directory with test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-test-'));
    basePath = path.join(tempDir, 'dist');
    await fs.mkdir(basePath, { recursive: true });

    // Create test files (including dotfiles for testing dotfiles option)
    await fs.writeFile(path.join(basePath, 'index.html'), '<html>test</html>');
    await fs.writeFile(path.join(basePath, 'main.js'), 'console.log("test");');
    await fs.writeFile(path.join(basePath, 'styles.css'), 'body { }');
    await fs.writeFile(path.join(basePath, '.htaccess'), 'RewriteEngine On');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    spawnCalls = [];
    spawnOverride = undefined;
    mockSpawn.mockReset();
    mockSpawn.mockImplementation(fakeSpawn(spawnCalls, respond));
    mockCopy.mockClear();
    mockGetUser.mockClear();

    // Isolated clone directory; no injected token, no CI metadata
    originalEnv = { ...process.env };
    process.env.CACHE_DIR = path.join(tempDir, 'cache');
    delete process.env.GH_TOKEN;
    delete process.env.PERSONAL_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.TRAVIS;
    delete process.env.CIRCLECI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Git command execution order', () => {
    it('should execute critical git commands in sequence', async () => {
      const repo = 'https://github.com/test/order-test.git';

      await ghPages.publish(basePath, { repo, branch: 'gh-pages', message: 'Deploy' });

      const commands = gitCommands();
      const cloneIndex = commands.indexOf('clone');
      const addIndex = commands.indexOf('add');
      const commitIndex = commands.indexOf('commit');
      const pushIndex = commands.indexOf('push');

      expect(cloneIndex).toBeGreaterThan(-1);
      expect(addIndex).toBeGreaterThan(cloneIndex); // add after clone
      expect(commitIndex).toBeGreaterThan(addIndex); // commit after add
      expect(pushIndex).toBeGreaterThan(commitIndex); // push after commit
    });

    it('should check the branch with ls-remote before cloning', async () => {
      const repo = 'https://github.com/test/ls-remote-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      expect(gitCalls()[0]).toEqual(['ls-remote', '--exit-code', '--heads', repo, 'refs/heads/gh-pages']);
      expect(gitCommands()[1]).toBe('clone');
    });
  });

  describe('Git clone command', () => {
    it('should clone with exact repository URL', async () => {
      const repo = 'https://github.com/angular-schule/test-repo.git';
      const branch = 'production';

      await ghPages.publish(basePath, { repo, branch, message: 'Deploy' });

      const cloneArgs = gitCalls('clone')[0];
      expect(cloneArgs[1]).toBe(repo);
      expect(cloneArgs[cloneArgs.indexOf('--branch') + 1]).toBe(branch);
      expect(cloneArgs).toContain('--single-branch');
      // the files of the branch are never checked out, the new content replaces them
      expect(cloneArgs).toContain('--no-checkout');
    });

    /**
     * Git clone depth controls shallow clone behavior.
     *
     * - `--depth 1` clones only the latest commit of the branch
     * - We're deploying build artifacts, the history is in the branch itself
     * - angular-cli-ghpages doesn't expose this option
     */
    it('should use default depth=1 for optimal performance', async () => {
      const repo = 'https://github.com/test/depth-test.git';

      await ghPages.publish(basePath, { repo, branch: 'gh-pages', message: 'Deploy' });

      const cloneArgs = gitCalls('clone')[0];
      const depthFlagIndex = cloneArgs.indexOf('--depth');
      expect(depthFlagIndex).toBeGreaterThan(-1);
      expect(cloneArgs[depthFlagIndex + 1]).toBe('1');
    });
  });

  describe('Git add and commit', () => {
    it('should add all files with dot notation', async () => {
      const repo = 'https://github.com/test/add-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      // --force: ignore rules (global gitignore, .gitignore in dist) must not drop files
      expect(gitCalls('add')).toEqual([['add', '--force', '--all', '--', '.']]);
    });

    it('should commit with exact message provided', async () => {
      const repo = 'https://github.com/test/commit-test.git';
      const message = 'Custom deployment message with special chars: émojis 🚀';

      await ghPages.publish(basePath, { repo, message });

      const commitArgs = gitCalls('commit')[0];
      expect(commitArgs[commitArgs.indexOf('-m') + 1]).toBe(message);
      // hooks of the user don't apply to deploy commits
      expect(commitArgs).toContain('--no-verify');
    });
  });

  /**
   * Git push command
   * - Push command includes correct remote and branch
   * - Push ALWAYS includes the --tags flag
   * - NO --force flag: every deploy adds a commit to the branch history
   */
  describe('Git push command', () => {
    it('should push to correct remote and branch with --tags flag', async () => {
      const repo = 'https://github.com/test/push-test.git';
      const branch = 'gh-pages';
      const remote = 'upstream';

      await ghPages.publish(basePath, { repo, branch, remote, message: 'Deploy' });

      expect(gitCalls('push')).toEqual([['push', '--tags', remote, branch]]);
    });

    it('should NOT use force push', async () => {
      const repo = 'https://github.com/test/no-force-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      expect(gitCalls('push')[0]).not.toContain('--force');
    });
  });

  describe('File copy operation', () => {
    it('should copy exact test files from basePath to the temporary clone', async () => {
      const repo = 'https://github.com/test/copy-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', dotfiles: false });

      expect(mockCopy).toHaveBeenCalledTimes(1);
      const [files, source, destination] = mockCopy.mock.calls[0] as unknown as [string[], string, string];
      expect([...files].sort()).toEqual(['index.html', 'main.js', 'styles.css']);
      expect(source).toBe(basePath);
      expect(path.dirname(destination)).toBe(ghPages.getCacheDir());
      expect(path.basename(destination)).toMatch(/^clone-/);
    });
  });

  /**
   * Staging with the add option
   *
   * - add: false (default) - the staged files become the complete content of
   *   the branch (`add --all` into an empty index), so no stale files remain
   * - add: true - the index starts with the tree of the branch (`read-tree HEAD`)
   *   and files missing from dist stay (`--ignore-removal`)
   * - git rm is never needed: nothing of the branch is checked out
   */
  describe('Staging behavior', () => {
    it('should stage the complete new content with add: false (default)', async () => {
      const repo = 'https://github.com/test/rm-default-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', add: false });

      expect(gitCommands()).not.toContain('read-tree');
      expect(gitCalls('add')).toEqual([['add', '--force', '--all', '--', '.']]);
    });

    it('should keep the existing files with add: true', async () => {
      const repo = 'https://github.com/test/rm-add-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', add: true });

      const commands = gitCommands();
      expect(commands.indexOf('read-tree')).toBeGreaterThan(commands.indexOf('clone'));
      expect(gitCalls('add')).toEqual([['add', '--force', '--ignore-removal', '--', '.']]);
    });

    it('should NEVER execute git rm', async () => {
      const repo = 'https://github.com/test/no-rm-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy' });
      await ghPages.publish(basePath, { repo, message: 'Deploy', add: true });

      expect(gitCommands()).not.toContain('rm');
    });
  });

  /**
   * Dotfiles option
   *
   * - The engine passes the dotfiles option to publish()
   * - Default in angular-cli-ghpages: dotfiles: true (include dotfiles)
   * - dotfiles: true → includes files starting with '.' (like .htaccess)
   * - dotfiles: false → ignores files starting with '.'
   */
  describe('Dotfiles option', () => {
    it('should include dotfiles when dotfiles: true (our default)', async () => {
      const repo = 'https://github.com/test/dotfiles-true.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', dotfiles: true });

      const [files] = mockCopy.mock.calls[0] as unknown as [string[]];
      expect([...files].sort()).toEqual(['.htaccess', 'index.html', 'main.js', 'styles.css']);
    });

    it('should exclude dotfiles when dotfiles: false', async () => {
      const repo = 'https://github.com/test/dotfiles-false.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', dotfiles: false });

      const [files] = mockCopy.mock.calls[0] as unknown as [string[]];
      expect([...files].sort()).toEqual(['index.html', 'main.js', 'styles.css']);
    });
  });

  describe('Git executable option', () => {
    it('should run every git command with the git executable', async () => {
      const repo = 'https://github.com/test/git-exe-test.git';
      const gitExecutable = '/opt/git/bin/git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', git: gitExecutable });

      expect(spawnCalls.length).toBeGreaterThan(0);
      expect(spawnCalls.every((call) => call.cmd === gitExecutable)).toBe(true);
    });
  });

  describe('User credentials', () => {
    const name = 'Deploy Bot';
    const email = 'bot@example.com';

    it('should configure git user.email with exact value', async () => {
      const repo = 'https://github.com/test/user-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', user: { name, email } });

      expect(gitCalls('config')).toContainEqual(['config', 'user.email', email]);
    });

    it('should configure git user.name with exact value', async () => {
      const repo = 'https://github.com/test/username-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', user: { name, email } });

      expect(gitCalls('config')).toContainEqual(['config', 'user.name', name]);
    });

    it('should configure only the email when the user has no name', async () => {
      const repo = 'https://github.com/test/email-only-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy', user: { name: '', email } });

      expect(gitCalls('config')).toEqual([['config', 'user.email', email]]);
    });
  });

  describe('Git tag command', () => {
    it('should NEVER create git tags', async () => {
      const repo = 'https://github.com/test/no-tag-test.git';

      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      expect(gitCommands()).not.toContain('tag');
    });
  });

  describe('New branch', () => {
    it('should create an empty repository instead of cloning when the branch does not exist', async () => {
      const repo = 'https://github.com/test/new-branch-test.git';
      const branch = 'pages';
      spawnOverride = (args) => args[0] === 'ls-remote' ? { code: 2 } : undefined;

      await ghPages.publish(basePath, { repo, branch, message: 'Deploy' });

      expect(gitCommands()).not.toContain('clone');
      expect(gitCalls('init')).toHaveLength(1);
      expect(gitCalls('remote')).toEqual([['remote', 'add', 'origin', repo]]);
      expect(gitCalls('symbolic-ref')).toEqual([['symbolic-ref', 'HEAD', 'refs/heads/' + branch]]);
    });
  });

  /**
   * Error scenarios
   * 1. Shallow clone failure and retry
   * 2. No changes to commit (diff-index returns 0)
   * 3. Git commit when no user configured (uses getUser)
   */
  describe('Error scenarios', () => {
    it('should retry the clone of the branch without --depth on failure', async () => {
      const repo = 'https://github.com/test/clone-failure-test.git';
      const branch = 'existing-branch';
      spawnOverride = (args) =>
        args[0] === 'clone' && args.includes('--depth')
          ? { code: 128, stderr: 'fatal: dumb http transport does not support shallow capabilities' }
          : undefined;

      await ghPages.publish(basePath, { repo, branch, message: 'Deploy' });

      const cloneCalls = gitCalls('clone');
      expect(cloneCalls.length).toBe(2);
      expect(cloneCalls[0]).toContain('--depth');
      // Second attempt: the same branch, in full
      expect(cloneCalls[1]).not.toContain('--depth');
      expect(cloneCalls[1][cloneCalls[1].indexOf('--branch') + 1]).toBe(branch);
    });

    it('should NOT commit when no changes exist (diff-index returns 0)', async () => {
      const repo = 'https://github.com/test/no-changes-test.git';
      // exit code 0: no changes (opposite of the default)
      spawnOverride = (args) => args[0] === 'diff-index' ? { code: 0 } : undefined;

      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      // publish() uses: git diff-index --quiet HEAD || git commit -m "message"
      expect(gitCommands()).not.toContain('commit');
      // But push should still be called (even with no new commits)
      expect(gitCommands()).toContain('push');
    });

    it('should handle deployment without user credentials (uses getUser)', async () => {
      const repo = 'https://github.com/test/no-user-test.git';

      // DON'T pass user option - publish() will call getUser() (our mock returns null)
      await ghPages.publish(basePath, { repo, message: 'Deploy' });

      expect(mockGetUser).toHaveBeenCalled();
      // When getUser returns null, publish() skips git config (relies on global/local git config)
      expect(gitCalls('config')).toEqual([]);
    });
  });

  /**
   * Regression for issue #205: a failing git command must reject engine.run(),
   * never end in a "Successfully published" message.
   */
  describe('auth-failure regression (issue #205)', () => {
    it('engine.run() should reject when git fails with fatal: Authentication failed', async () => {
      const authError = "fatal: Authentication failed for 'https://github.com/owner/repo.git'";
      spawnOverride = () => ({ code: 128, stderr: authError });
      const repo = 'https://x-access-token:bad-token@github.com/owner/repo.git';

      await expect(
        engine.run(basePath, { repo, branch: 'gh-pages', dotfiles: true, notfound: false, nojekyll: false }, new logging.NullLogger())
      ).rejects.toThrow(authError);

      // credentials in the URL: no credential helper may store them
      expect(spawnCalls[0].args.slice(0, 2)).toEqual(['-c', 'credential.helper=']);
    });
  });

  /**
   * Regression for issue #204: leftover files of the gh-pages branch (dotfiles,
   * dot-directories, submodule gitlinks) must not survive a deploy. The branch is
   * cloned without a checkout and `add --all` into the empty index makes the
   * copied files the complete new content.
   */
  describe('submodule / dotfile cleanup regression (issue #204)', () => {
    it('engine.run() should stage the dist files as the complete content of the branch', async () => {
      const repo = 'https://github.com/owner/leftover-test.git';

      await engine.run(basePath, { repo, branch: 'gh-pages', dotfiles: true, notfound: false, nojekyll: false }, new logging.NullLogger());

      expect(gitCalls('clone')[0]).toContain('--no-checkout');
      expect(gitCommands()).not.toContain('read-tree');
      expect(gitCalls('add')).toEqual([['add', '--force', '--all', '--', '.']]);
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('engine.run() should keep existing files with add: true', async () => {
      const repo = 'https://github.com/owner/leftover-add-test.git';

      await engine.run(basePath, { repo, add: true, notfound: false, nojekyll: false }, new logging.NullLogger());

      expect(gitCommands()).toContain('read-tree');
      expect(gitCalls('add')).toEqual([['add', '--force', '--ignore-removal', '--', '.']]);
    });
  });
});
