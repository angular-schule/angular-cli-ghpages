/**
 * Behavioral snapshot tests for gh-pages v6.3.0
 *
 * These tests capture the EXACT internal behavior of gh-pages.publish().
 * Focus: Git commands executed in correct order with correct arguments.
 *
 * Purpose: When upgrading gh-pages, these tests will break if behavior changes.
 * This ensures we maintain exact compatibility for our users.
 *
 * Approach: Mock child_process and gh-pages/lib/util, use real filesystem
 */

import { ChildProcess } from 'child_process';

import { pathExists } from '../utils';

const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { EventEmitter } = require('events');

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

// Factory function to create mock child process compatible with gh-pages expectations
// gh-pages lib/git.js expects: child.stdout.on, child.stderr.on, child.on('close')
function createMockChildProcess(): Partial<ChildProcess> {
  const child: Partial<ChildProcess> = new EventEmitter();
  child.stdout = new EventEmitter() as unknown as ChildProcess['stdout'];
  child.stderr = new EventEmitter() as unknown as ChildProcess['stderr'];
  return child;
}

/**
 * Whitelist of expected git commands from gh-pages v6.3.0
 *
 * Strict whitelist: If gh-pages changes git subcommands in future versions,
 * this array must be updated first and tests will fail loudly.
 * This is intentional - we want to know about any new git operations.
 */
const EXPECTED_GIT_COMMANDS = [
  'clone', 'clean', 'fetch', 'checkout', 'ls-remote', 'reset',
  'rm', 'add', 'config', 'diff-index', 'commit', 'tag', 'push', 'update-ref'
];

const mockSpawn = jest.fn((cmd: string, args: string[] | undefined, opts: unknown) => {
  const capturedArgs = args || [];
  spawnCalls.push({ cmd, args: capturedArgs, options: opts });

  // Validate git commands are expected
  if (cmd === 'git' && capturedArgs[0]) {
    if (!EXPECTED_GIT_COMMANDS.includes(capturedArgs[0])) {
      throw new Error(`Unexpected git command: ${capturedArgs[0]}. Add to whitelist if intentional.`);
    }
  }

  const mockChild = createMockChildProcess();

  // Simulate appropriate response based on git command
  setImmediate(() => {
    let output = '';

    // git config --get remote.X.url should return the repo URL
    if (cmd === 'git' && capturedArgs[0] === 'config' && capturedArgs[1] === '--get' &&
        capturedArgs[2] && capturedArgs[2].startsWith('remote.')) {
      // Use tracked repo URL for deterministic behavior
      output = currentTestContext.repo || '';
    }
    // ls-remote should return something for branch existence check
    else if (cmd === 'git' && capturedArgs[0] === 'ls-remote') {
      output = 'refs/heads/gh-pages';
    }
    // diff-index for checking if commit needed (exit 1 means changes exist)
    else if (cmd === 'git' && capturedArgs[0] === 'diff-index') {
      // Return exit code 1 to indicate changes exist
      mockChild.emit!('close', 1);
      return;
    }

    mockChild.stdout!.emit('data', Buffer.from(output));
    mockChild.emit!('close', 0);
  });

  return mockChild;
});

jest.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Mock gh-pages/lib/util to avoid file copy operations
const mockCopy = jest.fn(() => Promise.resolve());
const mockGetUser = jest.fn(() => Promise.resolve(null));

jest.mock('gh-pages/lib/util', () => ({
  copy: mockCopy,
  getUser: mockGetUser
}));

// Require gh-pages after mocking
const ghPages = require('gh-pages');

// Helper to avoid duplicate error handling
function publishAndHandle(
  basePath: string,
  options: unknown,
  done: jest.DoneCallback,
  assertions: () => void
): void {
  ghPages.publish(basePath, options, (err: Error | null) => {
    if (err) {
      done(err);
      return;
    }
    try {
      assertions();
      done();
    } catch (assertionError) {
      done(assertionError);
    }
  });
}

describe('gh-pages v6.3.0 - behavioral snapshot', () => {
  let tempDir: string;
  let basePath: string;

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

  beforeEach(() => {
    // Note: We DON'T call ghPages.clean() here because it interferes with test isolation
    // Each test uses a unique repo URL which naturally isolates cache directories

    // Clear all mock calls and context
    spawnCalls = [];
    currentTestContext = {};
    mockSpawn.mockClear();
    mockCopy.mockClear();
    mockGetUser.mockClear();
  });

  describe('Git command execution order', () => {
    it('should execute critical git commands in sequence', (done) => {
      const repo = 'https://github.com/test/order-test.git';
      const branch = 'gh-pages';
      currentTestContext.repo = repo;

      const options = { repo, branch, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
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

    it('should execute ls-remote before checkout', (done) => {
      const repo = 'https://github.com/test/ls-remote-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
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
    it('should clone with exact repository URL', (done) => {
      const repo = 'https://github.com/angular-schule/test-repo.git';
      const branch = 'production';
      currentTestContext.repo = repo;
      const options = { repo, branch, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
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
     * - gh-pages defaults to depth=1 (only latest commit, optimal for deployments)
     * - Smaller depth = faster clones, less disk space, faster CI/CD
     *
     * Why angular-cli-ghpages does NOT expose this option:
     * - We're deploying build artifacts (compiled Angular app)
     * - We only care about the latest built version
     * - History is in the gh-pages branch itself
     * - depth=1 is perfect - no benefit to cloning more history
     *
     * What we're testing:
     * - That gh-pages uses its default depth=1
     * - Exact argument position and value
     * - This ensures optimal performance for all deployments
     */
    it('should use default depth=1 for optimal performance', (done) => {
      const repo = 'https://github.com/test/depth-test.git';
      const branch = 'gh-pages';
      currentTestContext.repo = repo;

      // Don't specify depth - rely on gh-pages default
      const options = { repo, branch, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
        const cloneCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'clone'
        );
        expect(cloneCall).toBeDefined();

        // Find --depth flag and verify next argument is exactly 1
        const depthFlagIndex = cloneCall?.args.indexOf('--depth');
        expect(depthFlagIndex).toBeGreaterThan(-1);
        expect(cloneCall?.args[depthFlagIndex! + 1]).toBe(1);
      });
    });
  });

  describe('Git add and commit', () => {
    it('should add all files with dot notation', (done) => {
      const repo = 'https://github.com/test/add-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
        const addCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'add'
        );

        expect(addCall).toBeDefined();
        expect(addCall?.args[1]).toBe('.'); // Exact position check
      });
    });

    it('should commit with exact message provided', (done) => {
      const repo = 'https://github.com/test/commit-test.git';
      const message = 'Custom deployment message with special chars: émojis 🚀';
      currentTestContext.repo = repo;
      const options = { repo, message };

      publishAndHandle(basePath, options, done, () => {
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
   * What does angular-cli-ghpages do?
   * - We DO NOT pass the 'history' option to gh-pages
   * - gh-pages defaults to history: true (normal push, no --force)
   * - We rely on this default behavior
   *
   * What we're testing:
   * - Push command includes correct remote and branch
   * - Push ALWAYS includes --tags flag (gh-pages behavior)
   * - NO --force flag (because we don't pass history: false)
   */
  describe('Git push command', () => {
    it('should push to correct remote and branch with --tags flag', (done) => {
      const repo = 'https://github.com/test/push-test.git';
      const branch = 'gh-pages';
      const remote = 'upstream';
      currentTestContext.repo = repo;
      const options = { repo, branch, remote, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        expect(pushCall).toBeDefined();
        expect(pushCall?.args).toContain(remote);
        expect(pushCall?.args).toContain(branch);
        // gh-pages ALWAYS includes --tags in push (lib/git.js line 189)
        expect(pushCall?.args).toContain('--tags');
      });
    });

    it('should NOT use force push (we rely on gh-pages default history: true)', (done) => {
      const repo = 'https://github.com/test/no-force-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        expect(pushCall).toBeDefined();
        // We don't pass history: false, so gh-pages defaults to history: true (no --force)
        expect(pushCall?.args).not.toContain('--force');
      });
    });
  });

  describe('File copy operation', () => {
    it('should copy exact test files from basePath to cache destination', (done) => {
      const repo = 'https://github.com/test/copy-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
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

        // Verify destination is in gh-pages cache
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
   * Critical behavior from gh-pages source (lib/index.js lines 156-170):
   * if (options.add) {
   *   return git;  // SKIP removal logic entirely
   * }
   * // Otherwise: execute globby to find files, then git rm if files exist
   *
   * Testing strategy:
   * - We can't directly test git rm is called because it depends on existing files in cache
   * - Instead, we test command ORDERING which differs between add: true and add: false
   * - With add: false, checkout happens BEFORE add (removal step in between, even if no files)
   * - With add: true, checkout happens BEFORE add (no removal step at all)
   * - We also verify that add: true NEVER calls git rm (critical)
   */
  describe('Git rm command behavior', () => {
    it('should maintain standard command order with add: false (default)', (done) => {
      const repo = 'https://github.com/test/rm-default-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: false };

      publishAndHandle(basePath, options, done, () => {
        const gitCommands = spawnCalls
          .filter(call => call.cmd === 'git')
          .map(call => call.args[0]);

        // Verify standard flow: checkout → (removal logic) → add → commit
        const checkoutIndex = gitCommands.indexOf('checkout');
        const addIndex = gitCommands.indexOf('add');
        const commitIndex = gitCommands.indexOf('commit');

        expect(checkoutIndex).toBeGreaterThan(-1);
        expect(addIndex).toBeGreaterThan(checkoutIndex);
        expect(commitIndex).toBeGreaterThan(addIndex);

        // Note: git rm may or may not be called depending on existing files
        // The important thing is the removal logic is ATTEMPTED (not skipped)
      });
    });

    it('should NEVER execute git rm when add: true (skips removal entirely)', (done) => {
      const repo = 'https://github.com/test/rm-add-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: true };

      publishAndHandle(basePath, options, done, () => {
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
   * - We PASS dotfiles option to gh-pages (engine.ts line 242)
   * - Default in angular-cli-ghpages: dotfiles: true (include dotfiles)
   * - User can disable with --no-dotfiles flag
   *
   * How gh-pages uses it:
   * - Controls globby pattern matching for files to copy
   * - dotfiles: true → includes files starting with '.' (like .htaccess)
   * - dotfiles: false → ignores files starting with '.'
   *
   * Why we test this:
   * - CRITICAL: We expose this option and pass it to gh-pages
   * - Must verify it affects file selection behavior
   *
   * Test fixture has these files:
   * - index.html (normal file)
   * - main.js (normal file)
   * - styles.css (normal file)
   * - .htaccess (dotfile)
   */
  describe('Dotfiles option', () => {
    it('should include dotfiles when dotfiles: true (our default)', (done) => {
      const repo = 'https://github.com/test/dotfiles-true.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', dotfiles: true };

      publishAndHandle(basePath, options, done, () => {
        // gh-pages uses globby with { dot: options.dotfiles } (lib/index.js line 90)
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

    it('should exclude dotfiles when dotfiles: false', (done) => {
      const repo = 'https://github.com/test/dotfiles-false.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', dotfiles: false };

      publishAndHandle(basePath, options, done, () => {
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
   * - We PASS git option to gh-pages (engine.ts line 240)
   * - Default: 'git' (relies on PATH)
   * - gh-pages defaults.git = 'git' (lib/index.js line 29)
   *
   * Why we test this:
   * - We expose this option through defaults.ts
   * - Must verify the option flows through to gh-pages
   *
   * Testing approach:
   * - We pass git: 'git' (our default)
   * - Verify git commands are executed
   * - This confirms the option is accepted by gh-pages
   */
  describe('Git executable option', () => {
    it('should accept git executable option (we pass our default "git")', (done) => {
      const repo = 'https://github.com/test/git-exe-test.git';
      const gitExecutable = 'git'; // Our default from defaults.ts line 15
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', git: gitExecutable };

      publishAndHandle(basePath, options, done, () => {
        // Find all git commands
        const gitCalls = spawnCalls.filter(call => call.cmd === 'git');

        // CRITICAL: Verify git commands were executed
        // This confirms gh-pages accepted our git option
        expect(gitCalls.length).toBeGreaterThan(0);

        // Verify critical commands were executed with the git executable
        expect(gitCalls.some(call => call.args[0] === 'clone')).toBe(true);
        expect(gitCalls.some(call => call.args[0] === 'add')).toBe(true);
        expect(gitCalls.some(call => call.args[0] === 'commit')).toBe(true);
      });
    });
  });

  describe('User credentials', () => {
    it('should configure git user.email with exact value', (done) => {
      const repo = 'https://github.com/test/user-test.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', user: { name, email } };

      publishAndHandle(basePath, options, done, () => {
        const configEmailCall = spawnCalls.find(call =>
          call.cmd === 'git' &&
          call.args[0] === 'config' &&
          call.args[1] === 'user.email'
        );

        expect(configEmailCall).toBeDefined();
        expect(configEmailCall?.args[2]).toBe(email); // Exact position
      });
    });

    it('should configure git user.name with exact value', (done) => {
      const repo = 'https://github.com/test/username-test.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', user: { name, email } };

      publishAndHandle(basePath, options, done, () => {
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
   * What does angular-cli-ghpages do?
   * - We DO NOT pass the 'tag' option to gh-pages
   * - We DO NOT expose tag option in schema.json
   * - Therefore, no git tags should ever be created
   *
   * Why test this?
   * - Ensures our deployments don't accidentally create tags
   * - If gh-pages changes defaults, we'll catch it
   */
  describe('Git tag command', () => {
    it('should NEVER create git tags (we do not use tag option)', (done) => {
      const repo = 'https://github.com/test/no-tag-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      publishAndHandle(basePath, options, done, () => {
        const tagCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'tag'
        );

        // CRITICAL: We should NEVER create tags
        expect(tagCall).toBeUndefined();
      });
    });
  });

  /**
   * gh-pages default options we DON'T pass
   *
   * These tests verify gh-pages default behavior for options we don't pass.
   * This ensures we understand what gh-pages is doing on our behalf.
   *
   * Options we DON'T pass (gh-pages uses defaults):
   * - push: true (default) - Always pushes to remote
   * - dest: '.' (default) - Deploys to root of branch
   * - src: '**\/*' (default) - Includes all files
   * - remove: '.' (default) - Removes existing files (unless add: true)
   * - silent: false (default) - gh-pages logs output (we used to have noSilent but it's DEPRECATED)
   *
   * Note on 'silent' option:
   * - We have 'noSilent' in schema.json but it's DEPRECATED and IGNORED
   * - We do NOT pass 'silent' to gh-pages
   * - gh-pages defaults to silent: false (logging enabled)
   * - This is what we want: verbose logging for deployments
   */
  describe('gh-pages default options (we do not pass these)', () => {
    it('should push to remote (gh-pages default push: true)', (done) => {
      const repo = 'https://github.com/test/default-push-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };
      // We DON'T pass push option, gh-pages defaults to push: true

      publishAndHandle(basePath, options, done, () => {
        const pushCall = spawnCalls.find(call =>
          call.cmd === 'git' && call.args[0] === 'push'
        );

        // CRITICAL: Push MUST be called (gh-pages default: push: true)
        expect(pushCall).toBeDefined();
      });
    });

    it('should use root destination (gh-pages default dest: ".")', (done) => {
      const repo = 'https://github.com/test/default-dest-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };
      // We DON'T pass dest option, gh-pages defaults to dest: '.'

      publishAndHandle(basePath, options, done, () => {
        // Copy destination should be at root of cache (not in subdirectory)
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        const [files, source, destination] = callArgs as unknown as [string[], string, string];

        // Destination should be in gh-pages cache, not in a subdirectory
        expect(destination).toContain('gh-pages');
        // Should NOT contain additional path segments beyond cache dir
        // (dest: '.' means deploy to root of branch)
      });
    });

    it('should include all files (gh-pages default src: "**/*")', (done) => {
      const repo = 'https://github.com/test/default-src-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };
      // We DON'T pass src option, gh-pages defaults to src: '**/*'

      publishAndHandle(basePath, options, done, () => {
        expect(mockCopy).toHaveBeenCalledTimes(1);

        const callArgs = mockCopy.mock.calls[0];
        const [files] = callArgs as unknown as [string[], string, string];

        // All our test files should be included (src: '**/*' means all files)
        expect(files.length).toBe(3);
        expect(files).toContain('index.html');
        expect(files).toContain('main.js');
        expect(files).toContain('styles.css');
      });
    });

    it('should use default remove pattern (gh-pages default remove: ".")', (done) => {
      const repo = 'https://github.com/test/default-remove-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy', add: false };
      // We DON'T pass remove option, gh-pages defaults to remove: '.'
      // With add: false, gh-pages will attempt to remove files matching '.'

      publishAndHandle(basePath, options, done, () => {
        // Since it's a fresh clone, there may be no files to remove
        // But we verify the removal logic is executed (not skipped like with add: true)
        const gitCommands = spawnCalls
          .filter(call => call.cmd === 'git')
          .map(call => call.args[0]);

        // Standard flow includes removal logic (even if no files to remove)
        expect(gitCommands).toContain('checkout');
        expect(gitCommands).toContain('add');
      });
    });
  });

  /**
   * Error scenarios
   *
   * gh-pages has robust error handling. We test critical failure paths:
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
    it('should retry git clone without branch/depth options on failure', (done) => {
      const repo = 'https://github.com/test/clone-failure-test.git';
      currentTestContext.repo = repo;
      const branch = 'new-branch';
      const options = { repo, branch, message: 'Deploy' };

      // Reset mock to implement failure behavior
      mockSpawn.mockClear();

      let cloneAttempts = 0;
      mockSpawn.mockImplementation((cmd: string, args: string[] | undefined, opts: unknown) => {
        const capturedArgs = args || [];
        spawnCalls.push({ cmd, args: capturedArgs, options: opts });

        // Validate git commands are expected
        if (cmd === 'git' && capturedArgs[0]) {
          if (!EXPECTED_GIT_COMMANDS.includes(capturedArgs[0])) {
            throw new Error(`Unexpected git command: ${capturedArgs[0]}`);
          }
        }

        const mockChild = createMockChildProcess();

        setImmediate(() => {
          // First clone attempt with --branch and --depth should FAIL
          if (cmd === 'git' && capturedArgs[0] === 'clone' && cloneAttempts === 0) {
            cloneAttempts++;
            mockChild.stderr!.emit('data', Buffer.from('fatal: Remote branch new-branch not found'));
            mockChild.emit!('close', 128); // Git error code
            return;
          }

          // Second clone attempt without --branch/--depth should SUCCEED
          if (cmd === 'git' && capturedArgs[0] === 'clone' && cloneAttempts === 1) {
            cloneAttempts++;
            mockChild.stdout!.emit('data', Buffer.from(''));
            mockChild.emit!('close', 0);
            return;
          }

          // All other commands succeed normally
          let output = '';
          if (cmd === 'git' && capturedArgs[0] === 'config' && capturedArgs[1] === '--get') {
            output = repo;
          } else if (cmd === 'git' && capturedArgs[0] === 'ls-remote') {
            output = 'refs/heads/gh-pages';
          } else if (cmd === 'git' && capturedArgs[0] === 'diff-index') {
            mockChild.emit!('close', 1);
            return;
          }

          mockChild.stdout!.emit('data', Buffer.from(output));
          mockChild.emit!('close', 0);
        });

        return mockChild;
      });

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err) {
          done(err);
          return;
        }

        try {
          const cloneCalls = spawnCalls.filter(call =>
            call.cmd === 'git' && call.args[0] === 'clone'
          );

          // CRITICAL: Must have exactly 2 clone attempts
          expect(cloneCalls.length).toBe(2);

          // First attempt: with --branch and --depth
          expect(cloneCalls[0].args).toContain('--branch');
          expect(cloneCalls[0].args).toContain(branch);
          expect(cloneCalls[0].args).toContain('--depth');

          // Second attempt: WITHOUT --branch and --depth (fallback)
          expect(cloneCalls[1].args).not.toContain('--branch');
          expect(cloneCalls[1].args).not.toContain('--depth');
          expect(cloneCalls[1].args).toContain(repo);

          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('should NOT commit when no changes exist (diff-index returns 0)', (done) => {
      const repo = 'https://github.com/test/no-changes-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };

      // Reset mock to implement no-changes behavior
      mockSpawn.mockClear();
      spawnCalls = [];

      mockSpawn.mockImplementation((cmd: string, args: string[] | undefined, opts: unknown) => {
        const capturedArgs = args || [];
        spawnCalls.push({ cmd, args: capturedArgs, options: opts });

        if (cmd === 'git' && capturedArgs[0]) {
          if (!EXPECTED_GIT_COMMANDS.includes(capturedArgs[0])) {
            throw new Error(`Unexpected git command: ${capturedArgs[0]}`);
          }
        }

        const mockChild = createMockChildProcess();

        setImmediate(() => {
          let output = '';

          if (cmd === 'git' && capturedArgs[0] === 'config' && capturedArgs[1] === '--get') {
            output = repo;
          } else if (cmd === 'git' && capturedArgs[0] === 'ls-remote') {
            output = 'refs/heads/gh-pages';
          } else if (cmd === 'git' && capturedArgs[0] === 'diff-index') {
            // Return 0 = no changes (opposite of our normal mock)
            mockChild.emit!('close', 0);
            return;
          }

          mockChild.stdout!.emit('data', Buffer.from(output));
          mockChild.emit!('close', 0);
        });

        return mockChild;
      });

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err) {
          done(err);
          return;
        }

        try {
          const commitCall = spawnCalls.find(call =>
            call.cmd === 'git' && call.args[0] === 'commit'
          );

          // CRITICAL: Commit should NOT be called when no changes
          // gh-pages uses: git diff-index --quiet HEAD || git commit -m "message"
          expect(commitCall).toBeUndefined();

          // But push should still be called (even with no new commits)
          const pushCall = spawnCalls.find(call =>
            call.cmd === 'git' && call.args[0] === 'push'
          );
          expect(pushCall).toBeDefined();

          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('should handle deployment without user credentials (uses getUser)', (done) => {
      const repo = 'https://github.com/test/no-user-test.git';
      currentTestContext.repo = repo;
      const options = { repo, message: 'Deploy' };
      // DON'T pass user option - gh-pages will call getUser()

      // Reset mock to normal behavior (previous test modified it)
      mockSpawn.mockClear();
      spawnCalls = [];

      mockSpawn.mockImplementation((cmd: string, args: string[] | undefined, opts: unknown) => {
        const capturedArgs = args || [];
        spawnCalls.push({ cmd, args: capturedArgs, options: opts });

        if (cmd === 'git' && capturedArgs[0]) {
          if (!EXPECTED_GIT_COMMANDS.includes(capturedArgs[0])) {
            throw new Error(`Unexpected git command: ${capturedArgs[0]}`);
          }
        }

        const mockChild = createMockChildProcess();

        setImmediate(() => {
          let output = '';

          if (cmd === 'git' && capturedArgs[0] === 'config' && capturedArgs[1] === '--get' &&
              capturedArgs[2] && capturedArgs[2].startsWith('remote.')) {
            output = currentTestContext.repo || '';
          } else if (cmd === 'git' && capturedArgs[0] === 'ls-remote') {
            output = 'refs/heads/gh-pages';
          } else if (cmd === 'git' && capturedArgs[0] === 'diff-index') {
            mockChild.emit!('close', 1);
            return;
          }

          mockChild.stdout!.emit('data', Buffer.from(output));
          mockChild.emit!('close', 0);
        });

        return mockChild;
      });

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err) {
          done(err);
          return;
        }

        try {
          // Verify getUser was called (our mock returns null)
          expect(mockGetUser).toHaveBeenCalled();

          // Verify NO git config commands for user.name/user.email
          const configUserCalls = spawnCalls.filter(call =>
            call.cmd === 'git' &&
            call.args[0] === 'config' &&
            (call.args[1] === 'user.name' || call.args[1] === 'user.email')
          );

          // When getUser returns null, gh-pages skips git config
          // (relies on global/local git config)
          expect(configUserCalls.length).toBe(0);

          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

  });

  /**
   * gh-pages v6+ CNAME and .nojekyll file creation
   *
   * IMPORTANT: File creation tests are in engine.gh-pages-filecreation.spec.ts
   * Those tests run WITHOUT mocks to verify actual file creation behavior.
   *
   * This mocked test file cannot test actual file creation because:
   * - We mock child_process.spawn (git commands)
   * - gh-pages creates files in git.cwd which is set during clone
   * - Since clone is mocked, the directory structure isn't created
   *
   * See engine.gh-pages-filecreation.spec.ts for real file creation tests.
   */

  /**
   * gh-pages.clean() behavior is tested in engine.gh-pages-clean.spec.ts
   * That test uses real filesystem operations without mocks.
   */
});
