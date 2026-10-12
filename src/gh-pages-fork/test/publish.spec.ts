/**
 * publish() against real git repositories (local bare repos as remotes).
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { commitCount, createBareRepo, fileUrl, git, seedBranch, tree } from '../../test-helpers/git';
import { getCacheDir, publish, PublishOptions } from '../lib';

const user = { name: 'Deploy Bot', email: 'bot@example.org' };

describe('gh-pages-fork publish()', () => {
  let tempDir: string;
  let remote: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  // dotfiles/nojekyll off by default here, so the expected trees only show what a test enables
  function deploy(options: PublishOptions = {}, log?: (message: string) => void) {
    // file:// URL: git honors --depth only for real URLs, so clones are really shallow
    return publish(dist, { repo: fileUrl(remote), user, message: 'deploy', dotfiles: false, nojekyll: false, ...options }, log);
  }

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');

    remote = createBareRepo(path.join(tempDir, 'remote.git'));

    dist = path.join(tempDir, 'dist');
    await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>v1</h1>');
    await fs.writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1);');
    await fs.writeFile(path.join(dist, '.htaccess'), 'RewriteEngine On');
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function seedGhPagesBranch(): Promise<void> {
    return seedBranch(remote, path.join(tempDir, 'seed'), 'gh-pages', {
      '.github/workflows/deploy.yml': 'name: deploy',
      '.gitignore': 'node_modules',
      'stale.html': 'stale'
    }, ['build']);
  }

  it('creates the branch on the first deploy', async () => {
    await deploy({ dotfiles: true });

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html']);
    expect(git(remote, 'log', '-1', '--format=%an <%ae> | %s', 'gh-pages')).toBe('Deploy Bot <bot@example.org> | deploy');
  });

  it('replaces the whole branch content, including dotfiles and submodule gitlinks', async () => {
    await seedGhPagesBranch();

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
    await seedGhPagesBranch();

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
    // port 9 on localhost refuses the connection immediately, no network needed
    const repoWithToken = 'https://x-access-token:secret123@127.0.0.1:9/user/repo.git';

    await expect(
      publish(dist, { repo: repoWithToken, user }, (message) => messages.push(message))
    ).rejects.toThrow();

    expect(messages[0].split(' into ')[0]).toBe('Cloning https://***@127.0.0.1:9/user/repo.git');
    expect(messages.join('\n')).not.toContain('secret123');
  });

  it('removes a submodule gitlink that sorts before .gitmodules', async () => {
    await seedBranch(remote, path.join(tempDir, 'seed-gitmodules'), 'gh-pages', {
      '.gitmodules': '[submodule "shared"]\n\tpath = .github/actions/shared\n\turl = https://example.invalid/shared.git\n'
    }, ['.github/actions/shared']);

    await deploy();

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('never publishes the default branch on the first deploy with add', async () => {
    await seedBranch(remote, path.join(tempDir, 'source'), 'main', { 'environment.ts': 'apiKey=secret' });

    await deploy({ add: true });

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('skips broken symbolic links and symlink cycles in dist', async () => {
    await fs.symlink('/does/not/exist', path.join(dist, 'broken.svg'));
    await fs.symlink('..', path.join(dist, 'assets', 'loop'));

    await deploy();

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('writes files without the executable bit', async () => {
    await fs.chmod(path.join(dist, 'assets', 'app.js'), 0o755);

    await deploy();

    expect(git(remote, 'ls-tree', 'gh-pages', 'assets/app.js').split(/\s/)[0]).toBe('100644');
  });

  it('accepts a relative repository path', async () => {
    const cwd = process.cwd();
    process.chdir(tempDir);

    try {
      await publish(dist, { repo: './remote.git', user, message: 'deploy', dotfiles: false, nojekyll: false });
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('runs concurrent deploys to different branches without interference', async () => {
    const other = path.join(tempDir, 'other-dist');
    await fs.mkdir(other);
    await fs.writeFile(path.join(other, 'other.html'), 'other');

    await Promise.all([
      deploy({ branch: 'pages-a' }),
      publish(other, { repo: remote, user, branch: 'pages-b', message: 'deploy', nojekyll: false })
    ]);

    expect(tree(remote, 'pages-a')).toEqual(['assets/app.js', 'index.html']);
    expect(tree(remote, 'pages-b')).toEqual(['other.html']);
    expect(await fs.readdir(getCacheDir()!)).toEqual([]);
  });

  it('rejects when git is killed by a signal', async () => {
    const fakeGit = path.join(tempDir, 'fake-git');
    await fs.writeFile(fakeGit, `#!/bin/sh\nfor arg in "$@"; do [ "$arg" = "push" ] && kill -9 $$; done\nexec git "$@"\n`);
    await fs.chmod(fakeGit, 0o755);

    await expect(deploy({ git: fakeGit })).rejects.toThrow('Process killed by SIGKILL');
  });

  it('reports a missing git executable as such', async () => {
    const missing = path.join(tempDir, 'no-such-git');

    await expect(publish(dist, { git: missing, user, message: 'deploy' })).rejects.toThrow('ENOENT');
  });

  it('ignores stderr output of git when reading the remote URL and the user', async () => {
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    git(app, 'remote', 'add', 'origin', remote);
    git(app, 'config', 'user.name', 'Local User');
    git(app, 'config', 'user.email', 'local@example.org');
    const noisyGit = path.join(tempDir, 'noisy-git');
    await fs.writeFile(noisyGit, '#!/bin/sh\necho "trace: noise" >&2\nexec git "$@"\n');
    await fs.chmod(noisyGit, 0o755);
    const cwd = process.cwd();
    process.chdir(app);

    try {
      await publish(dist, { git: noisyGit, message: 'deploy' });
    } finally {
      process.chdir(cwd);
    }

    expect(git(remote, 'log', '-1', '--format=%an <%ae>', 'gh-pages')).toBe('Local User <local@example.org>');
  });

  // chmod has no effect for root (Docker CI) and on Windows
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('clones into the os temp directory when the cache directory is not writable', async () => {
    const readOnly = path.join(tempDir, 'read-only');
    await fs.mkdir(readOnly, { mode: 0o500 });
    process.env.CACHE_DIR = readOnly;
    const messages: string[] = [];

    try {
      await deploy({}, (message) => messages.push(message));
    } finally {
      await fs.chmod(readOnly, 0o700);
    }

    const cloneDir = messages.find((message) => message.startsWith('Cloning '))!.split(' into ')[1];
    expect(path.dirname(cloneDir)).toBe(os.tmpdir());
    expect(path.basename(cloneDir)).toMatch(/^angular-cli-ghpages-clone-/);
    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('copies more files than the copy concurrency', async () => {
    const files = Array.from({ length: 40 }, (_, i) => `chunk-${String(i).padStart(2, '0')}.js`);
    for (const file of files) {
      await fs.writeFile(path.join(dist, 'assets', file), file);
    }

    await deploy();

    expect(tree(remote)).toEqual([...files.map((file) => 'assets/' + file), 'assets/app.js', 'index.html'].sort());
  });

  it('includes nested dotfiles and dot-directories unless dotfiles is off', async () => {
    await fs.mkdir(path.join(dist, '.well-known'));
    await fs.writeFile(path.join(dist, '.well-known', 'security.txt'), 'Contact: mailto:security@example.org');
    await fs.writeFile(path.join(dist, 'assets', '.gitkeep'), '');

    await deploy({ dotfiles: true });
    expect(tree(remote)).toEqual(['.htaccess', '.well-known/security.txt', 'assets/.gitkeep', 'assets/app.js', 'index.html']);

    await deploy({ dotfiles: false });
    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('publishes to a non-default remote of the current repository', async () => {
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    git(app, 'remote', 'add', 'upstream', fileUrl(remote));
    const cwd = process.cwd();
    process.chdir(app);

    try {
      await publish(dist, { remote: 'upstream', user, message: 'deploy', dotfiles: false, nojekyll: false });
      await publish(dist, { remote: 'upstream', user, message: 'redeploy', dotfiles: true, nojekyll: false });
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html']);
    expect(commitCount(remote)).toBe(2);
  });

  it('keeps the history when the shallow clone fails once', async () => {
    await deploy();
    const firstCommit = git(remote, 'rev-parse', 'gh-pages');
    const flakyGit = path.join(tempDir, 'flaky-git');
    const flag = path.join(tempDir, 'failed-once');
    await fs.writeFile(flakyGit, [
      '#!/bin/sh',
      `for arg in "$@"; do if [ "$arg" = "--depth" ] && [ ! -f "${flag}" ]; then touch "${flag}"; echo "error: RPC failed; HTTP 503" >&2; exit 128; fi; done`,
      'exec git "$@"',
      ''
    ].join('\n'));
    await fs.chmod(flakyGit, 0o755);
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>v2</h1>');

    await deploy({ git: flakyGit });

    expect(git(remote, 'rev-parse', 'gh-pages~1')).toBe(firstCommit);
  });

  it('rejects when basePath is not a directory', async () => {
    const file = path.join(dist, 'index.html');

    await expect(publish(file, { repo: fileUrl(remote), user })).rejects.toThrow('The "base" option must be an existing directory');
  });

  it('commits with the git user from the environment when the project has none', async () => {
    const app = path.join(tempDir, 'no-user');
    git(tempDir, 'init', app);
    const cwd = process.cwd();
    process.chdir(app);
    process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'Env User';
    process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'env@example.org';

    try {
      await publish(dist, { repo: fileUrl(remote), message: 'deploy', nojekyll: false });
    } finally {
      process.chdir(cwd);
    }

    expect(git(remote, 'log', '-1', '--format=%an <%ae>', 'gh-pages')).toBe('Env User <env@example.org>');
  });

  it('publishes files that match the global gitignore of the user', async () => {
    const ignoreFile = path.join(tempDir, 'global-ignore');
    await fs.writeFile(ignoreFile, '*.map\n.htaccess\n');
    await fs.writeFile(process.env.GIT_CONFIG_GLOBAL!, `[core]\n\texcludesFile = ${ignoreFile}\n`);
    await fs.writeFile(path.join(dist, 'assets', 'app.js.map'), '{}');

    try {
      await deploy({ dotfiles: true });
    } finally {
      await fs.writeFile(process.env.GIT_CONFIG_GLOBAL!, '');
    }

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'assets/app.js.map', 'index.html']);
  });
});
