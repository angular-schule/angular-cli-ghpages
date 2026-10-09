/**
 * Exact sequence of git commands that publish() runs.
 * child_process is mocked; every command succeeds unless configured otherwise.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));

vi.mock('child_process', () => ({ spawn: mockSpawn }));

import { publish } from '../lib';

interface FakeResult {
  code?: number;
  output?: string;
}

describe('gh-pages-fork git commands', () => {
  const repo = 'https://github.com/user/repo.git';
  let calls: string[];
  let results: Record<string, FakeResult>;
  let tempDir: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-cmd-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');
    dist = path.join(tempDir, 'dist');
    await fs.mkdir(dist);
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>test</h1>');

    calls = [];
    results = {
      'config --get remote.origin.url': { output: repo },
      'diff-index --quiet HEAD': { code: 1 }
    };
    mockSpawn.mockImplementation((cmd: string, args: string[], options: { cwd: string }) => {
      const command = args.join(' ');
      calls.push(`${cmd} ${command}`);
      if (args[0] === 'clone') {
        // git clone creates the target directory
        void fs.mkdir(args[2], { recursive: true });
      }
      const result = Object.entries(results).find(([key]) => command.startsWith(key))?.[1] ?? {};
      const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter()
      });
      setImmediate(() => {
        if (result.output) {
          child.stdout.emit('data', Buffer.from(result.output));
        }
        child.emit('close', result.code ?? 0);
      });
      expect(options.cwd).toBeTruthy();
      return child;
    });
  });

  afterEach(async () => {
    process.env = originalEnv;
    mockSpawn.mockReset();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function cloneDirOf(command: string): string {
    return command.split(' ')[3];
  }

  it('deploys to an existing branch', async () => {
    await publish(dist, {
      repo,
      branch: 'gh-pages',
      message: 'Deploy',
      user: { name: 'Bot', email: 'bot@example.org' },
      nojekyll: true
    });

    const cloneDir = cloneDirOf(calls[0]);
    expect(calls).toEqual([
      `git clone ${repo} ${cloneDir} --branch gh-pages --single-branch --origin origin --depth 1`,
      'git config --get remote.origin.url',
      'git clean -f -d',
      'git fetch origin',
      'git ls-remote --exit-code . origin/gh-pages',
      'git checkout gh-pages',
      'git clean -f -d',
      'git reset --hard origin/gh-pages',
      'git rm --ignore-unmatch -r -f -- .',
      'git add .',
      'git config user.email bot@example.org',
      'git config user.name Bot',
      'git diff-index --quiet HEAD',
      'git commit -m Deploy',
      'git push --tags origin gh-pages'
    ]);
  });

  it('creates an orphan branch when the branch does not exist on the remote', async () => {
    results['clone ' + repo] = { code: 128 };
    results['ls-remote'] = { code: 2 };
    const defaultImplementation = mockSpawn.getMockImplementation()!;
    mockSpawn.mockImplementation((cmd: string, args: string[], options: { cwd: string }) => {
      // only the clone with --branch fails, the fallback clone succeeds
      if (args[0] === 'clone' && !args.includes('--branch')) {
        delete results['clone ' + repo];
      }
      return defaultImplementation(cmd, args, options);
    });

    await publish(dist, { repo, user: { name: 'Bot', email: 'bot@example.org' } });

    const cloneDir = cloneDirOf(calls[0]);
    expect(calls.slice(0, 7)).toEqual([
      `git clone ${repo} ${cloneDir} --branch gh-pages --single-branch --origin origin --depth 1`,
      `git clone ${repo} ${cloneDir} --origin origin`,
      'git config --get remote.origin.url',
      'git clean -f -d',
      'git fetch origin',
      'git ls-remote --exit-code . origin/gh-pages',
      'git checkout --orphan gh-pages'
    ]);
  });

  it('skips removing files with add', async () => {
    await publish(dist, { repo, add: true, user: { name: 'Bot', email: 'bot@example.org' } });

    expect(calls.some((call) => call.startsWith('git rm'))).toBe(false);
  });

  it('skips the commit when nothing changed', async () => {
    results['diff-index --quiet HEAD'] = { code: 0 };

    await publish(dist, { repo, user: { name: 'Bot', email: 'bot@example.org' } });

    expect(calls.some((call) => call.startsWith('git commit'))).toBe(false);
    expect(calls[calls.length - 1]).toBe('git push --tags origin gh-pages');
  });

  it('reads the git user when no user is given', async () => {
    results['config user.name'] = { output: 'Local User\n' };
    results['config user.email'] = { output: 'local@example.org\n' };

    await publish(dist, { repo });

    expect(calls.slice(0, 2).sort()).toEqual(['git config user.email', 'git config user.name']);
    expect(calls).toContain('git config user.email local@example.org');
    expect(calls).toContain('git config user.name Local User');
  });

  it('uses the configured git executable and remote', async () => {
    results['config --get remote.upstream.url'] = { output: repo };

    await publish(dist, { repo, git: '/usr/bin/git', remote: 'upstream', user: { name: 'Bot', email: 'bot@example.org' } });

    expect(calls.every((call) => call.startsWith('/usr/bin/git '))).toBe(true);
    expect(calls[calls.length - 1]).toBe('/usr/bin/git push --tags upstream gh-pages');
  });
});
