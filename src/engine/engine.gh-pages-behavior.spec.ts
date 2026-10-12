/**
 * Behavioral snapshot tests for gh-pages-fork publish()
 *
 * These tests pin the git commands that publish() executes, in order and with
 * their arguments, to the behavior of gh-pages v6.3.0, the base of the fork.
 * Any change to the fork that alters this behavior fails here.
 *
 * Approach: Mock child_process and gh-pages-fork/lib/util (copy, getUser), use real filesystem
 */

import { createMockChildProcess } from '../test-helpers/git';
import * as engine from './engine';
import { logging } from '@angular-devkit/core';

const path = require('path');
const fs = require('fs/promises');
const os = require('os');

// Mock utils.pathExists so engine.run() passes the dist folder check
vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils');
  return {
    ...actual,
    pathExists: vi.fn().mockResolvedValue(true)
  };
});

// Types for better type safety
interface SpawnCall {
  cmd: string;
  args: string[];
  options: unknown;
}

interface TestContext {
  repo?: string;
}

// Mock child_process to capture all git commands
let spawnCalls: SpawnCall[] = [];

// Track current test context for deterministic mock behavior
let currentTestContext: TestContext = {};

/**
 * Whitelist of git subcommands that publish() may run.
 *
 * Strict whitelist: any new git operation must be added here first,
 * so it can't slip in unnoticed.
 */
const EXPECTED_GIT_COMMANDS = [
  'clone', 'clean', 'fetch', 'checkout', 'ls-remote', 'reset',
  'rm', 'add', 'config', 'diff-index', 'commit', 'push'
];

// Git subcommand of an argument list, skipping leading `-c key=value` pairs
function gitSubcommand(args: string[]): string | undefined {
  let i = 0;
  while (args[i] === '-c') {
    i += 2;
  }
  return args[i];
}

const { mockSpawn, mockCopy, mockGetUser } = vi.hoisted(() => {
  const mockCopy = vi.fn(() => Promise.resolve());
  const mockGetUser = vi.fn(() => Promise.resolve(null));
  const mockSpawn = vi.fn();
  return { mockSpawn, mockCopy, mockGetUser };
});

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

vi.mock('../gh-pages-fork/lib/util', async () => ({
  ...(await vi.importActual('../gh-pages-fork/lib/util')),
  copy: mockCopy,
  getUser: mockGetUser
}));

interface SpawnResult {
  code?: number;
  output?: string;
  stderr?: string;
}

// Per-test override: return a result to replace the default response for a git call
let spawnOverride: ((args: string[]) => SpawnResult | undefined) | undefined;

function defaultResult(args: string[]): SpawnResult {
  // git config --get remote.X.url returns the repo URL of the current test
  if (args[0] === 'config' && args[1] === '--get' && args[2]?.startsWith('remote.')) {
    return { output: currentTestContext.repo || '' };
  }
  // the branch exists on the remote
  if (args[0] === 'ls-remote') {
    return { output: 'refs/heads/gh-pages' };
  }
  // exit code 1: there are changes to commit
  if (args[0] === 'diff-index') {
    return { code: 1 };
  }
  return {};
}

function defaultSpawn(cmd: string, args: string[] | undefined, opts: unknown) {
  const capturedArgs = args || [];
  spawnCalls.push({ cmd, args: capturedArgs, options: opts });

  // Validate git commands are expected
  const subcommand = gitSubcommand(capturedArgs);
  if (cmd === 'git' && subcommand && !EXPECTED_GIT_COMMANDS.includes(subcommand)) {
    throw new Error(`Unexpected git command: ${subcommand}. Add to whitelist if intentional.`);
  }

  const result = spawnOverride?.(capturedArgs) ?? defaultResult(capturedArgs);
  const child = createMockChildProcess();
  setImmediate(() => {
    if (result.stderr) {
      child.stderr!.emit('data', Buffer.from(result.stderr));
    }
    if (result.output) {
      child.stdout!.emit('data', Buffer.from(result.output));
    }
    child.emit('close', result.code ?? 0);
  });
  return child;
}

import * as ghPages from '../gh-pages-fork/lib';

async function publishAndHandle(
  basePath: string,
  options: ghPages.PublishOptions,
  assertions: () => void
): Promise<void> {
  await ghPages.publish(basePath, options);
  assertions();
}

describe('gh-pages-fork publish() - behavioral snapshot (gh-pages v6.3.0 behavior)', () => {
  let tempDir: string;
  let basePath: string;
  let originalEnv: NodeJS.ProcessEnv;

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
    // Clean up temp directory
    // force: true matches fse.remove() behavior (no error if path doesn't exist)
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Note: We DON'T call ghPages.clean() here because it interferes with test isolation
    // Each test uses a unique repo URL which naturally isolates cache directories

    // Clear all mock calls and context
    spawnCalls = [];
    currentTestContext = {};
    mockSpawn.mockReset();
    mockSpawn.mockImplementation(defaultSpawn);
    spawnOverride = undefined;

    // An injected token would make the repo URL differ from currentTestContext.repo
    originalEnv = { ...process.env };
    delete process.env.GH_TOKEN;
    delete process.env.PERSONAL_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.TRAVIS;
    delete process.env.CIRCLECI;
    delete process.env.GITHUB_ACTIONS;
    mockCopy.mockClear();
    mockGetUser.mockClear();
  });

  describe('Git command execution order', () => {
    it('should execute critical git commands in sequence', async () => {
      const repo = 'https://github.com/test/order-test.git';
      const branch = 'gh-pages';
      currentTestContext.repo = repo;

      const options = { repo, branch, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        // Extract git commands in order
        const gitCommands = spawnCalls
          .filter(call => call.cmd === 'git')
          .map(call => call.args[0]);

        // Verify critical commands appear
        expect(gitCommands).toContain('clone');
        expect(gitCommands).toContain('add');
        expect(gitCommands).toContain('commit');
        expect(gitCommands).toContain('push');

        // Verify critical ordering constraints (these MUST be in order)
        const cloneIndex = gitCommands.indexOf('clone');
        const addIndex = gitCommands.indexOf('add');
        const commitIndex = gitCommands.indexOf('commit');
        const pushIndex = gitCommands.indexOf('push');

        expect(cloneIndex).toBeGreaterThan(-1);
        expect(addIndex).toBeGreaterThan(cloneIndex); // add after clone
        expect(commitIndex).toBeGreaterThan(addIndex); // commit after add
        expect(pushIndex).toBeGreaterThan(commitIndex); // push after commit
      });
    });

    it('should execute ls-remote before checkout', async () => {
      const repo = 'https://github.com/test/ls-remote-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const gitCommands = spawnCalls
          .filter(call => call.cmd === 'git')
          .map(call => call.args[0]);

        const lsRemoteIndex = gitCommands.indexOf('ls-remote');
        const checkoutIndex = gitCommands.indexOf('checkout');

        // ls-remote checks if branch exists before checkout
        expect(lsRemoteIndex).toBeGreaterThan(-1);
        expect(checkoutIndex).toBeGreaterThan(-1);
        expect(lsRemoteIndex).toBeLessThan(checkoutIndex);
      });
    });
  });

  describe('Git clone command', () => {
    it('should clone with exact repository URL', async () => {
      const repo = 'https://github.com/angular-schule/test-repo.git';
      const branch = 'production';
      currentTestContext.repo = repo;
      const options = { repo, branch, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const cloneCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'clone'
        );

        expect(cloneCall).toBeDefined();
        expect(cloneCall?.args).toContain(repo);
        expect(cloneCall?.args).toContain('--branch');
        expect(cloneCall?.args).toContain(branch);
        expect(cloneCall?.args).toContain('--single-branch');
      });
    });

    /**
     * Git clone depth controls shallow clone behavior.
     *
     * What is depth?
     * - `--depth N` limits git clone history to N commits
     * - publish() defaults to depth=1 (only latest commit, optimal for deployments)
     * - Smaller depth = faster clones, less disk space, faster CI/CD
     *
     * Why angular-cli-ghpages does NOT expose this option:
     * - We're deploying build artifacts (compiled Angular app)
     * - We only care about the latest built version
     * - History is in the gh-pages branch itself
     * - depth=1 is perfect - no benefit to cloning more history
     *
     * What we're testing:
     * - That publish() uses its default depth=1
     * - Exact argument position and value
     * - This ensures optimal performance for all deployments
     */
    it('should use default depth=1 for optimal performance', async () => {
      const repo = 'https://github.com/test/depth-test.git';
      const branch = 'gh-pages';
      currentTestContext.repo = repo;

      // Don't specify depth - rely on the default
      const options = { repo, branch, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const cloneCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'clone'
        );
        expect(cloneCall).toBeDefined();

        // Find --depth flag and verify next argument is exactly 1
        const depthFlagIndex = cloneCall?.args.indexOf('--depth');
        expect(depthFlagIndex).toBeGreaterThan(-1);
        expect(cloneCall?.args[depthFlagIndex! + 1]).toBe('1');
      });
    });
  });

  describe('Git add and commit', () => {
    it('should add all files with dot notation', async () => {
      const repo = 'https://github.com/test/add-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const addCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'add'
        );

        expect(addCall).toBeDefined();
        expect(addCall?.args[1]).toBe('.'); // Exact position check
      });
    });

    it('should commit with exact message provided', async () => {
      const repo = 'https://github.com/test/commit-test.git';
      const message = 'Custom deployment message with special chars: émojis 🚀';
      currentTestContext.repo = repo;
      const options = { repo, message };

      await publishAndHandle(basePath, options, () => {
        const commitCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'commit'
        );

        expect(commitCall).toBeDefined();
        expect(commitCall?.args).toContain('-m');
        const messageIndex = commitCall?.args.indexOf('-m');
        expect(commitCall?.args[messageIndex! + 1]).toBe(message);
      });
    });
  });

  /**
   * Git push command
   *
   * What we're testing:
   * - Push command includes correct remote and branch
   * - Push ALWAYS includes the --tags flag
   * - NO --force flag: every deploy adds a commit to the branch history
   */
  describe('Git push command', () => {
    it('should push to correct remote and branch with --tags flag', async () => {
      const repo = 'https://github.com/test/push-test.git';
      const branch = 'gh-pages';
      const remote = 'upstream';
      currentTestContext.repo = repo;
      const options = { repo, branch, remote, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        expect(pushCall).toBeDefined();
        expect(pushCall?.args).toContain(remote);
        expect(pushCall?.args).toContain(branch);
        expect(pushCall?.args).toContain('--tags');
      });
    });

    it('should NOT use force push', async () => {
      const repo = 'https://github.com/test/no-force-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        expect(pushCall).toBeDefined();
        expect(pushCall?.args).not.toContain('--force');
      });
    });
  });

  describe('File copy operation', () => {
    it('should copy exact test files from basePath to cache destination', async () => {
      const repo = 'https://github.com/test/copy-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        expect(callArgs).toBeDefined();
        expect(callArgs.length).toBe(3);

        const [files, source, destination] = callArgs as unknown as [string[], string, string];

        // Verify files array contains EXACTLY our test files
        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBe(3);
        expect(files).toContain('index.html');
        expect(files).toContain('main.js');
        expect(files).toContain('styles.css');

        // Verify source is our basePath
        expect(source).toBe(basePath);

        // Verify destination is the temporary clone in the cache directory
        expect(destination).toContain('gh-pages');
      });
    });
  });

  /**
   * Git rm behavior with add option
   *
   * What is the add option?
   * - add: false (default) - Removes existing files before deploying new ones (clean slate)
   * - add: true - Adds files without removing existing ones (incremental deployment)
   *
   * Why this matters:
   * - add: false ensures no stale files remain (recommended for most cases)
   * - add: true useful for multi-source deployments or preserving manually added files
   *
   * publish() removes all tracked files after the checkout (`git rm` of
   * `.gitmodules`, then of `.`), unless `add` is set.
   *
   * What we're testing:
   * - With add: false, the removal runs between checkout and add
   * - With add: true, git rm is NEVER called on an existing branch
   */
  describe('Git rm command behavior', () => {
    it('should maintain standard command order with add: false (default)', async () => {
      const repo = 'https://github.com/test/rm-default-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: false };

      await publishAndHandle(basePath, options, () => {
        const gitCommands = spawnCalls
          .filter(call => call.cmd === 'git')
          .map(call => call.args[0]);

        // Verify standard flow: checkout → removal → add → commit
        const checkoutIndex = gitCommands.indexOf('checkout');
        const rmIndex = gitCommands.indexOf('rm');
        const addIndex = gitCommands.indexOf('add');
        const commitIndex = gitCommands.indexOf('commit');

        expect(checkoutIndex).toBeGreaterThan(-1);
        expect(rmIndex).toBeGreaterThan(checkoutIndex);
        expect(addIndex).toBeGreaterThan(rmIndex);
        expect(commitIndex).toBeGreaterThan(addIndex);
      });
    });

    it('should NEVER execute git rm when add: true (skips removal entirely)', async () => {
      const repo = 'https://github.com/test/rm-add-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: true };

      await publishAndHandle(basePath, options, () => {
        const rmCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'rm'
        );

        // CRITICAL: git rm MUST NEVER be called when add: true
        // This verifies the removal logic is completely skipped
        expect(rmCall).toBeUndefined();
      });
    });
  });

  /**
   * Dotfiles option
   *
   * What does angular-cli-ghpages do?
   * - The engine passes the dotfiles option to publish()
   * - Default in angular-cli-ghpages: dotfiles: true (include dotfiles)
   * - User can disable with --no-dotfiles flag
   *
   * How publish() uses it (listFiles):
   * - dotfiles: true → includes files starting with '.' (like .htaccess)
   * - dotfiles: false → ignores files starting with '.'
   *
   * Test fixture has these files:
   * - index.html (normal file)
   * - main.js (normal file)
   * - styles.css (normal file)
   * - .htaccess (dotfile)
   */
  describe('Dotfiles option', () => {
    it('should include dotfiles when dotfiles: true (our default)', async () => {
      const repo = 'https://github.com/test/dotfiles-true.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', dotfiles: true };

      await publishAndHandle(basePath, options, () => {
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        expect(callArgs).toBeDefined();
        expect(callArgs.length).toBe(3);

        const [files, source, destination] = callArgs as unknown as [string[], string, string];

        // CRITICAL: Verify files array INCLUDES the .htaccess dotfile
        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBe(4); // index.html, main.js, styles.css, .htaccess
        expect(files).toContain('index.html');
        expect(files).toContain('main.js');
        expect(files).toContain('styles.css');
        expect(files).toContain('.htaccess'); // This is the dotfile

        expect(source).toBe(basePath);
        expect(destination).toContain('gh-pages');
      });
    });

    it('should exclude dotfiles when dotfiles: false', async () => {
      const repo = 'https://github.com/test/dotfiles-false.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', dotfiles: false };

      await publishAndHandle(basePath, options, () => {
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        expect(callArgs).toBeDefined();
        expect(callArgs.length).toBe(3);

        const [files, source, destination] = callArgs as unknown as [string[], string, string];

        // CRITICAL: Verify files array EXCLUDES the .htaccess dotfile
        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBe(3); // Only index.html, main.js, styles.css
        expect(files).toContain('index.html');
        expect(files).toContain('main.js');
        expect(files).toContain('styles.css');
        expect(files).not.toContain('.htaccess'); // Dotfile must be excluded

        expect(source).toBe(basePath);
        expect(destination).toContain('gh-pages');
      });
    });
  });

  /**
   * Git executable option
   *
   * What does angular-cli-ghpages do?
   * - The engine passes the git option to publish()
   * - Default: 'git' (relies on PATH), see engine/defaults.ts
   *
   * Testing approach:
   * - We pass git: 'git' (our default)
   * - Verify git commands are executed with it
   */
  describe('Git executable option', () => {
    it('should accept git executable option (we pass our default "git")', async () => {
      const repo = 'https://github.com/test/git-exe-test.git';
      const gitExecutable = 'git'; // Our default from engine/defaults.ts
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', git: gitExecutable };

      await publishAndHandle(basePath, options, () => {
        // Find all git commands
        const gitCalls = spawnCalls.filter(call => call.cmd === 'git');

        // CRITICAL: Verify git commands were executed
        expect(gitCalls.length).toBeGreaterThan(0);

        // Verify critical commands were executed with the git executable
        expect(gitCalls.some(call => call.args[0] === 'clone')).toBe(true);
        expect(gitCalls.some(call => call.args[0] === 'add')).toBe(true);
        expect(gitCalls.some(call => call.args[0] === 'commit')).toBe(true);
      });
    });
  });

  describe('User credentials', () => {
    it('should configure git user.email with exact value', async () => {
      const repo = 'https://github.com/test/user-test.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', user: { name, email } };

      await publishAndHandle(basePath, options, () => {
        const configEmailCall = spawnCalls.find(call =>
          call.cmd === 'git' &&
          call.args[0] === 'config' &&
          call.args[1] === 'user.email'
        );

        expect(configEmailCall).toBeDefined();
        expect(configEmailCall?.args[2]).toBe(email); // Exact position
      });
    });

    it('should configure git user.name with exact value', async () => {
      const repo = 'https://github.com/test/username-test.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', user: { name, email } };

      await publishAndHandle(basePath, options, () => {
        const configNameCall = spawnCalls.find(call =>
          call.cmd === 'git' &&
          call.args[0] === 'config' &&
          call.args[1] === 'user.name'
        );

        expect(configNameCall).toBeDefined();
        expect(configNameCall?.args[2]).toBe(name); // Exact position
      });
    });
  });

  /**
   * Git tag command - Verify we DON'T use tagging
   *
   * publish() has no tag option and must never create tags.
   */
  describe('Git tag command', () => {
    it('should NEVER create git tags (we do not use tag option)', async () => {
      const repo = 'https://github.com/test/no-tag-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const tagCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'tag'
        );

        // CRITICAL: We should NEVER create tags
        expect(tagCall).toBeUndefined();
      });
    });
  });

  /**
   * Fixed behavior of publish() (upstream gh-pages has options for these):
   * - always pushes to the remote
   * - deploys to the root of the branch
   * - includes all files of basePath
   * - removes all existing files (unless add: true)
   */
  describe('fixed publish behavior', () => {
    it('should push to remote', async () => {
      const repo = 'https://github.com/test/default-push-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        // CRITICAL: Push MUST be called
        expect(pushCall).toBeDefined();
      });
    });

    it('should copy to the root of the branch', async () => {
      const repo = 'https://github.com/test/default-dest-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        // Copy destination is the root of the clone (not a subdirectory)
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        const [files, source, destination] = callArgs as unknown as [string[], string, string];

        expect(path.basename(destination)).toMatch(/^clone-/);
      });
    });

    it('should include all files', async () => {
      const repo = 'https://github.com/test/default-src-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      await publishAndHandle(basePath, options, () => {
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        const [files] = callArgs as unknown as [string[], string, string];

        // All our test files should be included
        expect(files.length).toBe(3);
        expect(files).toContain('index.html');
        expect(files).toContain('main.js');
        expect(files).toContain('styles.css');
      });
    });

    it('should remove .gitmodules first, then all tracked files', async () => {
      const repo = 'https://github.com/test/default-remove-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: false };

      await publishAndHandle(basePath, options, () => {
        const rmCalls = spawnCalls
          .filter(call => call.cmd === 'git' && call.args[0] === 'rm')
          .map(call => call.args.join(' '));

        // .gitmodules first: git rm fails when it is gone while a gitlink sorting before it remains
        expect(rmCalls).toEqual([
          'rm --ignore-unmatch -r -f -- .gitmodules',
          'rm --ignore-unmatch -r -f -- .'
        ]);
      });
    });
  });

  /**
   * Error scenarios
   *
   * Critical failure paths:
   * 1. Git clone failure and retry (branch doesn't exist)
   * 2. No changes to commit (diff-index returns 0)
   * 3. Git commit when no user configured (uses getUser)
   *
   * Why test error scenarios:
   * - Ensures deployments don't fail silently
   * - Verifies retry/fallback mechanisms work
   * - Documents expected error recovery behavior
   */
  describe('Error scenarios', () => {
    it('should retry git clone without the branch on failure', async () => {
      const repo = 'https://github.com/test/clone-failure-test.git';
      currentTestContext.repo = repo;
      const branch = 'new-branch';
      const options = { repo, branch, message: 'Deploy' };

      // The clone of the branch fails, the fallback clone of the default branch succeeds
      spawnOverride = (args) =>
        args[0] === 'clone' && args.includes('--branch')
          ? { code: 128, stderr: 'fatal: Remote branch new-branch not found' }
          : undefined;

      await ghPages.publish(basePath, options);

      const cloneCalls = spawnCalls.filter(call =>
        call.cmd === 'git' && call.args[0] === 'clone'
      );

      // CRITICAL: Must have exactly 2 clone attempts
      expect(cloneCalls.length).toBe(2);

      // First attempt: with --branch and --depth
      expect(cloneCalls[0].args).toContain('--branch');
      expect(cloneCalls[0].args).toContain(branch);
      expect(cloneCalls[0].args).toContain('--depth');

      // Second attempt: the default branch, without a checkout (the new branch starts empty)
      expect(cloneCalls[1].args).not.toContain('--branch');
      expect(cloneCalls[1].args).toContain('--no-checkout');
      expect(cloneCalls[1].args).toContain(repo);
    });

    it('should NOT commit when no changes exist (diff-index returns 0)', async () => {
      const repo = 'https://github.com/test/no-changes-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      // exit code 0: no changes (opposite of the default)
      spawnOverride = (args) => args[0] === 'diff-index' ? { code: 0 } : undefined;

      await ghPages.publish(basePath, options);

      const commitCall = spawnCalls.find(call =>
        call.cmd === 'git' && call.args[0] === 'commit'
      );

      // CRITICAL: Commit should NOT be called when no changes
      // publish() uses: git diff-index --quiet HEAD || git commit -m "message"
      expect(commitCall).toBeUndefined();

      // But push should still be called (even with no new commits)
      const pushCall = spawnCalls.find(call =>
        call.cmd === 'git' && call.args[0] === 'push'
      );
      expect(pushCall).toBeDefined();
    });

    it('should handle deployment without user credentials (uses getUser)', async () => {
      const repo = 'https://github.com/test/no-user-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };
      // DON'T pass user option - publish() will call getUser()

      await ghPages.publish(basePath, options);

      // Verify getUser was called (our mock returns null)
      expect(mockGetUser).toHaveBeenCalled();

      // Verify NO git config commands for user.name/user.email
      const configUserCalls = spawnCalls.filter(call =>
        call.cmd === 'git' &&
        call.args[0] === 'config' &&
        (call.args[1] === 'user.name' || call.args[1] === 'user.email')
      );

      // When getUser returns null, publish() skips git config
      // (relies on global/local git config)
      expect(configUserCalls.length).toBe(0);
    });
  });

  /**
   * CNAME/.nojekyll file creation and the removal of the temporary clone run
   * against real git in engine.gh-pages-filecreation.spec.ts and
   * engine.gh-pages-clean.spec.ts.
   */

  /**
   * Regression for issue #205: a failing git command must reject engine.run(),
   * never end in a "Successfully published" message.
   */
  describe('auth-failure regression (issue #205)', () => {
    it('engine.run() should reject when git clone fails with fatal: Authentication failed', async () => {
      spawnOverride = () => ({
        code: 128,
        stderr: "fatal: Authentication failed for 'https://github.com/owner/repo.git'"
      });

      const options = {
        repo: 'https://x-access-token:bad-token@github.com/owner/repo.git',
        branch: 'gh-pages',
        dotfiles: true,
        notfound: true,
        nojekyll: true
      };

      await expect(
        engine.run(basePath, options, new logging.NullLogger())
      ).rejects.toThrow('fatal: Authentication failed');

      const cloneCall = spawnCalls.find(c => c.cmd === 'git' && gitSubcommand(c.args) === 'clone');
      expect(cloneCall).toBeDefined();
      // credentials in the URL: no credential helper may store them
      expect(cloneCall!.args.slice(0, 2)).toEqual(['-c', 'credential.helper=']);
    });
  });

  /**
   * Regression for issue #204: leftover files of the gh-pages branch (dotfiles,
   * dot-directories, submodule gitlinks) must not survive a deploy. publish()
   * removes every tracked file before copying dist, unless `add` is set.
   */
  describe('submodule / dotfile cleanup regression (issue #204)', () => {
    it('engine.run() should remove all tracked files after checkout and before adding dist', async () => {
      const repo = 'https://github.com/owner/leftover-test.git';
      currentTestContext.repo = repo;

      const options = {
        repo,
        branch: 'gh-pages',
        dotfiles: true,
        notfound: false,
        nojekyll: false
      };

      await engine.run(basePath, options, new logging.NullLogger());

      const gitCalls = spawnCalls.filter(c => c.cmd === 'git').map(c => c.args.join(' '));
      const resetIndex = gitCalls.indexOf('reset --hard origin/gh-pages');
      const rmIndex = gitCalls.indexOf('rm --ignore-unmatch -r -f -- .');
      const addIndex = gitCalls.indexOf('add .');

      expect(resetIndex).toBeGreaterThan(-1);
      expect(rmIndex).toBeGreaterThan(resetIndex);
      expect(addIndex).toBeGreaterThan(rmIndex);
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('engine.run() should keep existing files with add: true', async () => {
      const repo = 'https://github.com/owner/leftover-add-test.git';
      currentTestContext.repo = repo;

      await engine.run(basePath, { repo, add: true, notfound: false, nojekyll: false }, new logging.NullLogger());

      expect(spawnCalls.some(c => c.cmd === 'git' && c.args[0] === 'rm')).toBe(false);
    });
  });
});
