/**
 * publish() against real git repositories (local bare repos as remotes).
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { clean, publish, PublishOptions } from '../lib';

const user = { name: 'Deploy Bot', email: 'bot@example.org' };

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function tree(remote: string, branch = 'gh-pages'): string[] {
  return git(remote, 'ls-tree', '-r', '--name-only', branch).split('\n').filter(Boolean).sort();
}

function commitCount(remote: string, branch = 'gh-pages'): number {
  return Number(git(remote, 'rev-list', '--count', branch));
}

describe('gh-pages-fork publish()', () => {
  let tempDir: string;
  let remote: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  function deploy(options: PublishOptions = {}, log?: (message: string) => void) {
    return publish(dist, { repo: remote, user, message: 'deploy', ...options }, log);
  }

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');

    remote = path.join(tempDir, 'remote.git');
    git(tempDir, 'init', '--bare', remote);

    dist = path.join(tempDir, 'dist');
    await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>v1</h1>');
    await fs.writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1);');
    await fs.writeFile(path.join(dist, '.htaccess'), 'RewriteEngine On');
  });

  afterEach(async () => {
    await clean();
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function seedBranch(): Promise<void> {
    const seed = path.join(tempDir, 'seed');
    git(tempDir, 'init', '-b', 'gh-pages', seed);
    git(seed, 'config', 'user.name', 'Seed');
    git(seed, 'config', 'user.email', 'seed@example.org');
    await fs.mkdir(path.join(seed, '.github', 'workflows'), { recursive: true });
    await fs.writeFile(path.join(seed, '.github', 'workflows', 'deploy.yml'), 'name: deploy');
    await fs.writeFile(path.join(seed, '.gitignore'), 'node_modules');
    await fs.writeFile(path.join(seed, 'stale.html'), 'stale');
    git(seed, 'add', '.');
    git(seed, 'commit', '-m', 'seed');
    git(seed, 'update-index', '--add', '--cacheinfo', `160000,${git(seed, 'rev-parse', 'HEAD')},build`);
    git(seed, 'commit', '-m', 'gitlink');
    git(seed, 'push', remote, 'gh-pages');
  }

  it('creates the branch on the first deploy', async () => {
    await deploy({ dotfiles: true });

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html']);
    expect(git(remote, 'log', '-1', '--format=%an <%ae> | %s', 'gh-pages')).toBe('Deploy Bot <bot@example.org> | deploy');
  });

  it('replaces the whole branch content, including dotfiles and submodule gitlinks', async () => {
    await seedBranch();

    await deploy();

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('keeps .nojekyll and CNAME on every redeploy', async () => {
    const options = { nojekyll: true, cname: 'example.org' };

    await deploy(options);
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>v2</h1>');
    await deploy(options);

    expect(tree(remote)).toEqual(['.nojekyll', 'CNAME', 'assets/app.js', 'index.html']);
    expect(git(remote, 'show', 'gh-pages:CNAME')).toBe('example.org');
    expect(commitCount(remote)).toBe(2);
  });

  it('removes .nojekyll when nojekyll is disabled', async () => {
    await deploy({ nojekyll: true });
    await deploy({ nojekyll: false });

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('keeps existing files with add', async () => {
    await seedBranch();

    await deploy({ add: true });

    expect(tree(remote)).toEqual([
      '.github/workflows/deploy.yml', '.gitignore', 'assets/app.js', 'build', 'index.html', 'stale.html'
    ]);
  });

  it('excludes dotfiles of dist unless dotfiles is set', async () => {
    await deploy({ dotfiles: false });

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('creates no commit when nothing changed', async () => {
    await deploy();
    await deploy({ message: 'unchanged' });

    expect(commitCount(remote)).toBe(1);
  });

  it('follows symbolic links in dist', async () => {
    const shared = path.join(tempDir, 'shared');
    await fs.mkdir(shared);
    await fs.writeFile(path.join(shared, 'data.txt'), 'shared');
    await fs.symlink(shared, path.join(dist, 'linked'));
    await fs.symlink('index.html', path.join(dist, 'alias.html'));

    await deploy();

    expect(tree(remote)).toEqual(['alias.html', 'assets/app.js', 'index.html', 'linked/data.txt']);
    expect(git(remote, 'show', 'gh-pages:linked/data.txt')).toBe('shared');
  });

  it('uses the git user of the current working directory when no user is given', async () => {
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    git(app, 'config', 'user.name', 'Local User');
    git(app, 'config', 'user.email', 'local@example.org');
    const cwd = process.cwd();
    process.chdir(app);

    try {
      await publish(dist, { repo: remote, message: 'deploy' });
    } finally {
      process.chdir(cwd);
    }

    expect(git(remote, 'log', '-1', '--format=%an <%ae>', 'gh-pages')).toBe('Local User <local@example.org>');
  });

  it('rejects when the remote rejects the push', async () => {
    const hook = path.join(remote, 'hooks', 'pre-receive');
    await fs.writeFile(hook, '#!/bin/sh\necho "rejected by hook" >&2\nexit 1\n');
    await fs.chmod(hook, 0o755);

    await expect(deploy()).rejects.toThrow('rejected by hook');
  });

  it('rejects when dist contains no files', async () => {
    const empty = path.join(tempDir, 'empty');
    await fs.mkdir(empty);

    await expect(publish(empty, { repo: remote, user })).rejects.toThrow(
      `The directory "${empty}" doesn't contain any files to publish.`
    );
  });

  it('hides credentials of the repository URL in log messages', async () => {
    const messages: string[] = [];
    const repoWithToken = 'https://x-access-token:secret123@example.invalid/user/repo.git';

    await expect(
      publish(dist, { repo: repoWithToken, user }, (message) => messages.push(message))
    ).rejects.toThrow();

    expect(messages[0]).toContain('https://***@example.invalid/user/repo.git');
    expect(messages.join('\n')).not.toContain('secret123');
  });
});
