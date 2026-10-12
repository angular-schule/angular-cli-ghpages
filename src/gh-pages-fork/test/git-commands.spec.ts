/**
 * Exact sequence of git commands that publish() runs.
 * child_process is mocked; every command succeeds unless configured otherwise.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));

vi.mock('child_process', () => ({ spawn: mockSpawn }));

import { FakeResult, fakeSpawn, gitSubcommand, SpawnCall, withoutConfigArgs } from '../../test-helpers/git';
import { publish, PublishOptions } from '../lib';

describe('gh-pages-fork git commands', () => {
  const repo = 'https://github.com/user/repo.git';
  const user = { name: 'Bot', email: 'bot@example.org' };
  let calls: SpawnCall[];
  // Responses by command (without leading `-c` pairs), matched by prefix
  let results: Record<string, FakeResult>;
  let tempDir: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  function respond(call: SpawnCall): FakeResult | undefined {
    const command = withoutConfigArgs(call.args).join(' ');
    return Object.entries(results).find(([key]) => command.startsWith(key))?.[1];
  }

  // Commands as `git <subcommand> ...`, without the `-c` pairs
  function commands(): string[] {
    return calls.map((call) => [call.cmd, ...withoutConfigArgs(call.args)].join(' '));
  }

  function deploy(options: PublishOptions = {}) {
    return publish(dist, { repo, user, message: 'Deploy', nojekyll: false, ...options });
  }

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-cmd-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');
    dist = path.join(tempDir, 'dist');
    await fs.mkdir(dist);
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>test</h1>');

    calls = [];
    results = {
      // exit code 1: there are changes to commit
      'diff-index --quiet HEAD': { code: 1 }
    };
    mockSpawn.mockImplementation(fakeSpawn(calls, respond));
  });

  afterEach(async () => {
    process.env = originalEnv;
    mockSpawn.mockReset();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function cloneDir(): string {
    return withoutConfigArgs(calls.find((call) => gitSubcommand(call.args) === 'clone')!.args)[2];
  }

  it('deploys to an existing branch', async () => {
    await deploy();

    const dir = cloneDir();
    expect(commands()).toEqual([
      `git ls-remote --exit-code --heads ${repo} refs/heads/gh-pages`,
      `git clone ${repo} ${dir} --origin origin --branch gh-pages --single-branch --no-checkout --depth 1`,
      'git add --force --all -- .',
      `git config user.email ${user.email}`,
      `git config user.name ${user.name}`,
      'git diff-index --quiet HEAD',
      'git commit --no-verify -m Deploy',
      'git push --tags origin gh-pages'
    ]);
  });

  it('creates an empty repository for a branch that does not exist on the remote', async () => {
    results['ls-remote'] = { code: 2 };

    await deploy();

    const dir = calls.find((call) => gitSubcommand(call.args) === 'init')!.args.at(-1);
    expect(commands()).toEqual([
      `git ls-remote --exit-code --heads ${repo} refs/heads/gh-pages`,
      `git init ${dir}`,
      `git remote add origin ${repo}`,
      'git symbolic-ref HEAD refs/heads/gh-pages',
      'git add --force --all -- .',
      `git config user.email ${user.email}`,
      `git config user.name ${user.name}`,
      'git diff-index --quiet HEAD',
      'git commit --no-verify -m Deploy',
      'git push --tags origin gh-pages'
    ]);
  });

  it('keeps the existing files with add', async () => {
    await deploy({ add: true });

    expect(commands().slice(2, 4)).toEqual([
      'git read-tree HEAD',
      'git add --force --ignore-removal -- .'
    ]);
  });

  it('adds nothing to keep for a new branch with add', async () => {
    results['ls-remote'] = { code: 2 };

    await deploy({ add: true });

    expect(commands()).not.toContain('git read-tree HEAD');
    expect(commands()).toContain('git add --force --ignore-removal -- .');
  });

  it('falls back to a full clone of the branch when the server rejects a shallow clone', async () => {
    mockSpawn.mockImplementation(fakeSpawn(calls, (call) => {
      const command = withoutConfigArgs(call.args);
      if (command[0] === 'clone' && command.includes('--depth')) {
        return { code: 128, stderr: 'fatal: dumb http transport does not support shallow capabilities' };
      }
      return respond(call);
    }));

    await deploy();

    const dir = cloneDir();
    expect(commands().slice(1, 3)).toEqual([
      `git clone ${repo} ${dir} --origin origin --branch gh-pages --single-branch --no-checkout --depth 1`,
      `git clone ${repo} ${dir} --origin origin --branch gh-pages --single-branch --no-checkout`
    ]);
  });

  it('rejects with the error of ls-remote for failures other than a missing branch', async () => {
    const error = "fatal: Authentication failed for 'https://github.com/user/repo.git/'";
    results['ls-remote'] = { code: 128, stderr: error };

    await expect(deploy()).rejects.toThrow(error);
    expect(commands()).toHaveLength(1);
  });

  it('skips the commit when nothing changed', async () => {
    results['diff-index --quiet HEAD'] = { code: 0 };

    await deploy();

    expect(commands().some((command) => command.startsWith('git commit'))).toBe(false);
    expect(commands().at(-1)).toBe('git push --tags origin gh-pages');
  });

  it('reads the git user when no user is given', async () => {
    const name = 'Local User';
    const email = 'local@example.org';
    results['config user.name'] = { output: name + '\n' };
    results['config user.email'] = { output: email + '\n' };

    await publish(dist, { repo, message: 'Deploy', nojekyll: false });

    expect(commands().slice(0, 2).sort()).toEqual(['git config user.email', 'git config user.name']);
    expect(commands()).toContain(`git config user.email ${email}`);
    expect(commands()).toContain(`git config user.name ${name}`);
  });

  it('uses the configured git executable and remote', async () => {
    const git = '/usr/bin/git';
    const remote = 'upstream';

    await deploy({ git, remote });

    expect(calls.every((call) => call.cmd === git)).toBe(true);
    expect(commands()[1]).toContain(` --origin ${remote} `);
    expect(commands().at(-1)).toBe(`${git} push --tags ${remote} gh-pages`);
  });

  it('pins every command for the clone to the clone, without inherited repository variables', async () => {
    process.env.GIT_DIR = '/project/.git';
    process.env.GIT_INDEX_FILE = '/project/.git/index.lock';

    await deploy();

    const dir = cloneDir();
    for (const call of calls) {
      expect(call.options.env?.GIT_INDEX_FILE).toBeUndefined();
    }
    expect(calls[0].options.env?.GIT_DIR).toBeUndefined();
    expect(calls[1].options.env?.GIT_DIR).toBeUndefined();
    for (const call of calls.slice(2)) {
      expect(call.options.env?.GIT_DIR).toBe(path.join(dir, '.git'));
      expect(call.options.env?.GIT_WORK_TREE).toBe(dir);
      expect(call.args.slice(0, 2)).toEqual(['-c', `safe.directory=${dir}`]);
    }
  });

  it('disables credential helpers and keeps the token out of the clone config for a URL with a password', async () => {
    const repoWithToken = 'https://x-access-token:secret@github.com/user/repo.git';

    await deploy({ repo: repoWithToken });

    expect(calls.every((call) => call.args[0] === '-c' && call.args[1] === 'credential.helper=')).toBe(true);
    expect(commands()).toContain('git remote set-url origin https://github.com/user/repo.git');
    expect(commands()).toContain('git commit --no-verify -m Deploy');
    expect(commands().at(-1)).toBe(`git push --tags ${repoWithToken} gh-pages`);
  });

  it('keeps credential helpers for a URL with only a username', async () => {
    const repoWithUser = 'https://org@dev.azure.com/org/project/_git/repo';

    await deploy({ repo: repoWithUser });

    expect(calls.some((call) => call.args.includes('credential.helper='))).toBe(false);
    expect(commands().at(-1)).toBe('git push --tags origin gh-pages');
  });
});
