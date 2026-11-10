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
import { envFileWarning, publish, PublishOptions } from '../lib';

const SHA1 = 'a'.repeat(40);
const SHA256 = 'b'.repeat(64);

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
    return publish(dist, { repo, user, message: 'Deploy', nojekyll: false, notfound: false, ...options });
  }

  // The private clone directory: the first command (init of the probe) runs in it
  function cloneDir(): string {
    return calls[0].options.cwd!;
  }

  function workTree(): string {
    return path.join(cloneDir(), 'work');
  }

  function gitDir(): string {
    return path.join(cloneDir(), '.git');
  }

  // ls-remote runs inside a throwaway repository with the remote, so includeIf sections apply
  function probe(git = 'git', remote = 'origin', url = repo): string[] {
    return [`${git} init --quiet --bare ${gitDir()}`, `${git} remote add ${remote} ${url}`, `${git} ls-remote ${url}`];
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
      'ls-remote': { output: `${SHA1}\tHEAD\n${SHA1}\trefs/heads/main\n${SHA1}\trefs/heads/gh-pages\n` },
      // exit code 1: there are changes to commit
      'diff-index --cached --quiet HEAD': { code: 1 }
    };
    mockSpawn.mockImplementation(fakeSpawn(calls, respond));
  });

  afterEach(async () => {
    process.env = originalEnv;
    mockSpawn.mockReset();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function cloneCommand(...extraArgs: string[]): string {
    return `git clone ${repo} ${workTree()} --separate-git-dir ${gitDir()} --origin origin --no-checkout ${extraArgs.join(' ')}`.trim();
  }

  const listIgnored = 'git ls-files --others --ignored --exclude-standard -z';
  const staging = [listIgnored, 'git add --force --all -- .', 'git ls-files -z'];
  const listRemoved = 'git diff-index --cached --name-only --diff-filter=D -z HEAD --';
  const commitAndPush = [
    `git config user.email ${user.email}`,
    `git config user.name ${user.name}`,
    'git diff-index --cached --quiet HEAD --',
    'git commit -m Deploy',
    'git push --tags origin gh-pages'
  ];

  it('deploys to an existing branch', async () => {
    await deploy();

    expect(commands()).toEqual([
      ...probe(),
      cloneCommand('--branch gh-pages --single-branch --depth 1'),
      ...staging,
      listRemoved,
      ...commitAndPush
    ]);
  });

  it('creates an empty repository for a branch that does not exist on the remote', async () => {
    results['ls-remote'] = { output: `${SHA1}\tHEAD\n${SHA1}\trefs/heads/main\n` };

    await deploy();

    expect(commands()).toEqual([
      ...probe(),
      `git init --separate-git-dir ${gitDir()} ${workTree()}`,
      `git remote add origin ${repo}`,
      'git symbolic-ref HEAD refs/heads/gh-pages',
      ...staging,
      ...commitAndPush
    ]);
  });

  it('does not mistake a branch with the same suffix for the target branch', async () => {
    results['ls-remote'] = { output: `${SHA1}\trefs/heads/old/gh-pages\n` };

    await deploy();

    expect(commands()[3]).toBe(`git init --separate-git-dir ${gitDir()} ${workTree()}`);
  });

  it('clones an empty remote, which takes over its object format', async () => {
    results['ls-remote'] = {};

    await deploy();

    expect(commands().slice(0, 5)).toEqual([
      ...probe(),
      cloneCommand(),
      'git symbolic-ref HEAD refs/heads/gh-pages'
    ]);
  });

  it('creates a new branch in the object format of the remote', async () => {
    for (const [sha, objectFormat] of [[SHA1, 'sha1'], [SHA256, 'sha256']]) {
      calls.length = 0;
      results['ls-remote'] = { output: `${sha}\trefs/heads/main\n` };

      await deploy();

      const init = calls.find((call) => gitSubcommand(call.args) === 'init' && call.args.includes('--separate-git-dir'))!;
      expect(init.options.env?.GIT_DEFAULT_HASH).toBe(objectFormat);
    }
  });

  it('keeps the existing files with add', async () => {
    await deploy({ add: true });

    expect(commands().slice(4, 7)).toEqual([
      'git read-tree HEAD',
      listIgnored,
      'git add --force --ignore-removal -- .'
    ]);
  });

  it('adds nothing to keep for a new branch with add', async () => {
    results['ls-remote'] = { output: `${SHA1}\trefs/heads/main\n` };

    await deploy({ add: true });

    expect(commands()).not.toContain('git read-tree HEAD');
    expect(commands()).toContain('git add --force --ignore-removal -- .');
  });

  it('falls back to a full clone right away when the server rejects a shallow clone', async () => {
    mockSpawn.mockImplementation(fakeSpawn(calls, (call) => {
      const command = withoutConfigArgs(call.args);
      if (command[0] === 'clone' && command.includes('--depth')) {
        return { code: 128, stderr: 'fatal: dumb http transport does not support shallow capabilities' };
      }
      return respond(call);
    }));

    await deploy();

    expect(commands().slice(3, 5)).toEqual([
      cloneCommand('--branch gh-pages --single-branch --depth 1'),
      cloneCommand('--branch gh-pages --single-branch')
    ]);
  });

  it('retries a shallow clone after a transient failure before cloning in full', async () => {
    mockSpawn.mockImplementation(fakeSpawn(calls, (call) => {
      const command = withoutConfigArgs(call.args);
      if (command[0] === 'clone' && command.includes('--depth')) {
        return { code: 128, stderr: 'error: RPC failed; HTTP 503' };
      }
      return respond(call);
    }));
    const messages: string[] = [];

    await publish(dist, { repo, user, message: 'Deploy', nojekyll: false, notfound: false }, (message) => messages.push(message));

    expect(commands().slice(3, 6)).toEqual([
      cloneCommand('--branch gh-pages --single-branch --depth 1'),
      cloneCommand('--branch gh-pages --single-branch --depth 1'),
      cloneCommand('--branch gh-pages --single-branch')
    ]);
    expect(messages).toContain('Shallow clone failed: error: RPC failed; HTTP 503');
  });

  it('rejects with the error of ls-remote', async () => {
    const error = "fatal: Authentication failed for 'https://github.com/user/repo.git/'";
    results['ls-remote'] = { code: 128, stderr: error };

    await expect(deploy()).rejects.toThrow(error);
    expect(commands()).toEqual(probe());
  });

  it('skips the commit when nothing changed', async () => {
    results['diff-index --cached --quiet HEAD'] = { code: 0 };

    await deploy();

    expect(commands().some((command) => command.startsWith('git commit'))).toBe(false);
    expect(commands().at(-1)).toBe('git push --tags origin gh-pages');
  });

  it('reads the git user when no user is given', async () => {
    const name = 'Local User';
    const email = 'local@example.org';
    results['config user.name'] = { output: name + '\n' };
    results['config user.email'] = { output: email + '\n' };

    await publish(dist, { repo, message: 'Deploy', nojekyll: false, notfound: false });

    expect(commands().slice(0, 2).sort()).toEqual(['git config user.email', 'git config user.name']);
    expect(commands()).toContain(`git config user.email ${email}`);
    expect(commands()).toContain(`git config user.name ${name}`);
  });

  it('reads the git user with the configured git executable', async () => {
    const git = '/usr/bin/git';

    await publish(dist, { repo, git, message: 'Deploy', nojekyll: false, notfound: false });

    expect(calls.every((call) => call.cmd === git)).toBe(true);
  });

  it('uses the configured git executable and remote', async () => {
    const git = '/usr/bin/git';
    const remote = 'upstream';

    await deploy({ git, remote });

    expect(calls.every((call) => call.cmd === git)).toBe(true);
    expect(commands()[3]).toBe(`${git} clone ${repo} ${workTree()} --separate-git-dir ${gitDir()} --origin ${remote} --no-checkout --branch gh-pages --single-branch --depth 1`);
    expect(commands().at(-1)).toBe(`${git} push --tags ${remote} gh-pages`);
  });

  it('pins commands to the clone, without inherited repository variables', async () => {
    process.env.GIT_DIR = '/project/.git';
    process.env.GIT_WORK_TREE = '/project';
    process.env.GIT_INDEX_FILE = '/project/.git/index.lock';

    await deploy();

    for (const call of calls) {
      expect(call.options.env?.GIT_INDEX_FILE).toBeUndefined();
    }
    // init of the probe and clone: no repository; remote add and ls-remote: the probe
    for (const call of calls.slice(0, 4)) {
      expect([undefined, gitDir()]).toContain(call.options.env?.GIT_DIR);
      expect(call.options.env?.GIT_WORK_TREE).toBeUndefined();
    }
    for (const call of calls.slice(4)) {
      expect(call.options.env?.GIT_DIR).toBe(gitDir());
      expect(call.options.env?.GIT_WORK_TREE).toBe(workTree());
      expect(call.options.cwd).toBe(workTree());
    }
  });

  it('keeps ls-remote out of the repository around the cache directory', async () => {
    await deploy();

    expect(path.dirname(cloneDir())).toBe(path.join(tempDir, 'cache', 'gh-pages'));
    expect(calls[0].options.env?.GIT_CEILING_DIRECTORIES).toBe(path.dirname(cloneDir()));
  });

  it('turns off git maintenance for the throwaway repository', async () => {
    await deploy();

    for (const call of calls.slice(4)) {
      expect(call.args.slice(0, 4)).toEqual(['-c', 'maintenance.auto=false', '-c', 'gc.auto=0']);
    }
  });

  it('overrides identity variables of the environment with the given user', async () => {
    process.env.GIT_AUTHOR_NAME = 'Env Author';

    await deploy();

    const commit = calls.find((call) => gitSubcommand(call.args) === 'commit')!;
    expect(commit.options.env?.GIT_AUTHOR_NAME).toBe(user.name);
    expect(commit.options.env?.GIT_AUTHOR_EMAIL).toBe(user.email);
    expect(commit.options.env?.GIT_COMMITTER_NAME).toBe(user.name);
    expect(commit.options.env?.GIT_COMMITTER_EMAIL).toBe(user.email);
  });

  it('warns about env files of the index and commits them', async () => {
    results['ls-files -z'] = { output: ['.env', 'index.html', 'config/.env.production'].join('\0') };
    const warnings: string[] = [];

    await publish(dist, { repo, user, message: 'Deploy', nojekyll: false, notfound: false, add: true }, undefined, (message) => warnings.push(message));

    expect(warnings).toEqual(envFileWarning(['.env', 'config/.env.production']));
    expect(commands().some((command) => command.startsWith('git rm'))).toBe(false);
    expect(commands()).toContain('git commit -m Deploy');
  });

  it('disables credential helpers and keeps the token out of the clone config for a URL with a password', async () => {
    const repoWithToken = 'https://x-access-token:secret@github.com/user/repo.git';

    await deploy({ repo: repoWithToken });

    expect(calls.every((call) => call.args[0] === '-c' && call.args[1] === 'credential.helper=')).toBe(true);
    expect(commands()).toContain('git remote set-url origin https://github.com/user/repo.git');
    expect(commands()).toContain('git commit -m Deploy');
    expect(commands().at(-1)).toBe(`git push --tags ${repoWithToken} gh-pages`);
  });

  it('keeps credential helpers for a URL with only a username, without the username in the clone config', async () => {
    const repoWithUser = 'https://org@dev.azure.com/org/project/_git/repo';

    await deploy({ repo: repoWithUser });

    expect(calls.some((call) => call.args.includes('credential.helper='))).toBe(false);
    expect(commands()).toContain('git remote set-url origin https://dev.azure.com/org/project/_git/repo');
    expect(commands().at(-1)).toBe(`git push --tags ${repoWithUser} gh-pages`);
  });

  it('keeps the remote of an ssh URL untouched', async () => {
    const sshRepo = 'ssh://git@github.com/user/repo.git';

    await deploy({ repo: sshRepo });

    expect(commands().some((command) => command.includes('set-url'))).toBe(false);
    expect(commands().at(-1)).toBe('git push --tags origin gh-pages');
  });
});
