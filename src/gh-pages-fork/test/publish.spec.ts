/**
 * publish() against real git repositories (local bare repos as remotes).
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { commitCount, createBareRepo, fileUrl, git, seedBranch, tree } from '../../test-helpers/git';
import { defaults as engineDefaults } from '../../engine/defaults';
import { defaults, envFileWarning, getCacheDir, ignoredFileWarning, publish, PublishOptions } from '../lib';

const user = { name: 'Deploy Bot', email: 'bot@example.org' };

describe('gh-pages-fork publish()', () => {
  let tempDir: string;
  let remote: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  // dotfiles/nojekyll off by default here, so the expected trees only show what a test enables
  function deploy(options: PublishOptions = {}, log?: (message: string) => void, warn?: (message: string) => void) {
    // file:// URL: git honors --depth only for real URLs, so clones are really shallow
    return publish(dist, { repo: fileUrl(remote), user, message: 'deploy', dotfiles: false, nojekyll: false, notfound: false, ...options }, log, warn);
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
    expect(git(remote, 'log', '-1', '--format=%an <%ae> | %s', 'gh-pages')).toBe(`${user.name} <${user.email}> | deploy`);
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
    expect(git(remote, 'show', 'gh-pages:CNAME')).toBe(options.cname);
    expect(commitCount(remote)).toBe(2);
  });

  it('removes .nojekyll when nojekyll is disabled', async () => {
    await deploy({ nojekyll: true });
    await deploy({ nojekyll: false, notfound: false });

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
    const content = 'shared';
    await fs.writeFile(path.join(shared, 'data.txt'), content);
    await fs.symlink(shared, path.join(dist, 'linked'));
    await fs.symlink('index.html', path.join(dist, 'alias.html'));

    await deploy();

    expect(tree(remote)).toEqual(['alias.html', 'assets/app.js', 'index.html', 'linked/data.txt']);
    expect(git(remote, 'show', 'gh-pages:linked/data.txt')).toBe(content);
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
      await publish(dist, { repo: './remote.git', user, message: 'deploy', dotfiles: false, nojekyll: false, notfound: false });
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
      publish(other, { repo: remote, user, branch: 'pages-b', message: 'deploy', nojekyll: false, notfound: false })
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
      await publish(dist, { remote: 'upstream', user, message: 'deploy', dotfiles: false, nojekyll: false, notfound: false });
      await publish(dist, { remote: 'upstream', user, message: 'redeploy', dotfiles: true, nojekyll: false, notfound: false });
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

    await expect(publish(file, { repo: fileUrl(remote), user })).rejects.toThrow(`The path "${file}" to publish (--dir) is not an existing directory.`);
  });

  it('commits with the git user from the environment when the project has none', async () => {
    const app = path.join(tempDir, 'no-user');
    git(tempDir, 'init', app);
    const cwd = process.cwd();
    process.chdir(app);
    process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'Env User';
    process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'env@example.org';

    try {
      await publish(dist, { repo: fileUrl(remote), message: 'deploy', nojekyll: false, notfound: false });
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

  describe('404.html', () => {
    it('publishes a copy of index.html as 404.html without touching dist', async () => {
      await deploy({ notfound: true });

      expect(tree(remote)).toEqual(['404.html', 'assets/app.js', 'index.html']);
      expect(git(remote, 'show', 'gh-pages:404.html')).toBe(git(remote, 'show', 'gh-pages:index.html'));
      expect((await fs.readdir(dist)).sort()).toEqual(['.htaccess', 'assets', 'index.html']);
    });

    it('replaces a 404.html of the directory with the SPA fallback', async () => {
      const index = '<h1>spa</h1>';
      await fs.writeFile(path.join(dist, 'index.html'), index);
      const notFound = 'custom not found page';
      await fs.writeFile(path.join(dist, '404.html'), notFound);

      await deploy({ notfound: true });

      expect(git(remote, 'show', 'gh-pages:404.html')).toBe(index);
      expect(await fs.readFile(path.join(dist, '404.html'), 'utf-8')).toBe(notFound);
    });

    it('publishes a 404.html of the directory with notfound: false', async () => {
      const notFound = 'custom not found page';
      await fs.writeFile(path.join(dist, '404.html'), notFound);

      await deploy({ notfound: false });

      expect(git(remote, 'show', 'gh-pages:404.html')).toBe(notFound);
    });

    it('does not take over the mode of index.html', async () => {
      await fs.chmod(path.join(dist, 'index.html'), 0o755);

      await deploy({ notfound: true });

      expect(git(remote, 'ls-tree', 'gh-pages', '404.html').split(/\s/)[0]).toBe('100644');
    });

    it('works with a read-only index.html and 404.html in the build', async () => {
      await fs.writeFile(path.join(dist, '404.html'), 'custom');
      await fs.chmod(path.join(dist, '404.html'), 0o444);
      await fs.chmod(path.join(dist, 'index.html'), 0o444);

      await deploy({ notfound: true });

      expect(git(remote, 'show', 'gh-pages:404.html')).toBe(git(remote, 'show', 'gh-pages:index.html'));
    });

    it('follows index.html on every deploy', async () => {
      await deploy({ notfound: true });
      const index = '<h1>v2</h1>';
      await fs.writeFile(path.join(dist, 'index.html'), index);
      await deploy({ notfound: true });

      expect(git(remote, 'show', 'gh-pages:404.html')).toBe(index);
    });

    it('creates no 404.html without index.html and still deploys', async () => {
      const messages: string[] = [];
      await fs.rm(path.join(dist, 'index.html'));

      await deploy({ notfound: true }, (message) => messages.push(message));

      expect(tree(remote)).toEqual(['assets/app.js']);
      expect(messages).toContain('index.html could not be copied to 404.html. Proceeding without it.');
    });

    it('creates no 404.html with notfound: false', async () => {
      await deploy({ notfound: false });

      expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
    });
  });

  describe('env files', () => {
    const envFiles = ['.env', '.ENV', '.env.production', '.env.local', 'production.env', 'config/.env', 'assets/deep/.env.staging', 'nested/.env/secret.txt'];

    beforeEach(async () => {
      for (const file of envFiles) {
        await fs.mkdir(path.dirname(path.join(dist, file)), { recursive: true });
        // .env and .ENV are the same file on a case-insensitive file system
        await fs.writeFile(path.join(dist, file), 'SECRET=value');
      }
    });

    it('publishes env files like other files, with dotfiles', async () => {
      await deploy({ dotfiles: true });

      expect(tree(remote)).toEqual(expect.arrayContaining(['.env', '.env.production', 'production.env', 'config/.env', 'assets/deep/.env.staging', 'nested/.env/secret.txt']));
    });

    it('leaves dotted env files out without dotfiles and publishes the others', async () => {
      await deploy({ dotfiles: false });

      expect(tree(remote)).toEqual(['assets/app.js', 'index.html', 'production.env']);
    });

    it('warns about every published env file', async () => {
      const messages: string[] = [];
      const warnings: string[] = [];

      await deploy({ dotfiles: false }, (message) => messages.push(message), (message) => warnings.push(message));

      expect(warnings).toEqual(envFileWarning(['production.env']));
      expect(messages).not.toContain(warnings[0]);
    });

    it('sends the warning to log without a warn function', async () => {
      const messages: string[] = [];

      await deploy({ dotfiles: false }, (message) => messages.push(message));

      expect(messages).toEqual(expect.arrayContaining(envFileWarning(['production.env'])));
    });

    it('warns about env files kept from the branch with add', async () => {
      await fs.rm(path.join(dist, 'production.env'));
      await seedBranch(remote, path.join(tempDir, 'seed-env'), 'gh-pages', { '.env': 'SECRET=old', 'kept.html': 'kept' });
      const warnings: string[] = [];

      await deploy({ add: true }, undefined, (message) => warnings.push(message));

      expect(tree(remote)).toEqual(['.env', 'assets/app.js', 'index.html', 'kept.html']);
      expect(warnings).toEqual(envFileWarning(['.env']));
    });

    it('does not warn without env files', async () => {
      const warnings: string[] = [];
      await fs.rm(path.join(dist, 'production.env'));

      await deploy({ dotfiles: false }, undefined, (message) => warnings.push(message));

      expect(warnings).toEqual([]);
    });
  });

  describe('project root as publish directory', () => {
    it('refuses a directory with a .git entry and a package.json when dotfiles are published', async () => {
      git(dist, 'init');
      await fs.writeFile(path.join(dist, 'package.json'), '{}');

      await expect(deploy({ dotfiles: true })).rejects.toThrow('contains a .git entry and a package.json');
      expect(() => git(remote, 'rev-parse', '--verify', 'gh-pages')).toThrow();
    });

    it('publishes a build folder that is a clone itself (no package.json)', async () => {
      git(dist, 'init');

      await deploy({ dotfiles: true });

      expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html']);
    });

    it('allows a project root without dotfiles', async () => {
      git(dist, 'init');
      await fs.writeFile(path.join(dist, 'package.json'), '{}');

      await deploy({ dotfiles: false });

      expect(tree(remote)).toEqual(['assets/app.js', 'index.html', 'package.json']);
    });
  });

  describe('compatibility with 3.1.2', () => {
    it('redeploys a build with a top-level HEAD folder', async () => {
      await fs.mkdir(path.join(dist, 'HEAD'));
      await fs.writeFile(path.join(dist, 'HEAD', 'index.html'), 'head route');
      await deploy();
      await fs.writeFile(path.join(dist, 'HEAD', 'index.html'), 'head route, changed');

      await deploy();
      // unchanged: no commit
      await deploy();

      expect(commitCount(remote)).toBe(2);
      expect(tree(remote)).toEqual(['HEAD/index.html', 'assets/app.js', 'index.html']);
    });

    it('redeploys when a tag has the name of the branch', async () => {
      await deploy();
      git(remote, 'tag', 'gh-pages', 'gh-pages');
      await fs.writeFile(path.join(dist, 'index.html'), 'changed');

      await deploy();

      expect(commitCount(remote, 'refs/heads/gh-pages')).toBe(2);
    });

    it('deploys a build with a 404.html folder without the 404.html copy', async () => {
      const messages: string[] = [];
      await fs.mkdir(path.join(dist, '404.html'));
      await fs.writeFile(path.join(dist, '404.html', 'index.html'), 'route');

      await deploy({ notfound: true }, (message) => messages.push(message));

      expect(tree(remote)).toEqual(['404.html/index.html', 'assets/app.js', 'index.html']);
      expect(messages).toContain('index.html could not be copied to 404.html. Proceeding without it.');
    });

    it('commits with the name of the config when the user has an empty name', async () => {
      process.env.GIT_CONFIG_GLOBAL = path.join(tempDir, 'gitconfig');
      await fs.writeFile(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = Global User\n');
      const email = 'bot@example.org';

      await deploy({ user: { name: '', email } });

      expect(git(remote, 'log', '-1', '--format=%an <%ae>', 'gh-pages').trim()).toBe(`Global User <${email}>`);
    });

    it('lists removed files without rename detection and with at most 10 names', async () => {
      const messages: string[] = [];
      const chunks = Array.from({ length: 12 }, (_, index) => `chunk-${index}.js`);
      for (const chunk of chunks) {
        await fs.writeFile(path.join(dist, chunk), 'export const value = 1;\n'.repeat(20));
      }
      await deploy();
      for (const chunk of chunks) {
        await fs.rename(path.join(dist, chunk), path.join(dist, 'new-' + chunk));
      }

      await deploy({}, (message) => messages.push(message));

      expect(messages.find((message) => message.startsWith('Removing '))).toMatch(/^Removing 12 file\(s\) from the branch: (chunk-\d+\.js, ){9}chunk-\d+\.js and 2 more$/);
    });

    it('warns about files that an ignore rule would leave out and publishes them', async () => {
      const warnings: string[] = [];
      await fs.writeFile(path.join(dist, '.gitignore'), '*.map\n');
      await fs.writeFile(path.join(dist, 'main.js.map'), '{}');

      await deploy({ dotfiles: true }, undefined, (message) => warnings.push(message));

      expect(tree(remote)).toContain('main.js.map');
      expect(warnings).toEqual(ignoredFileWarning(['main.js.map']));
    });

    it('applies includeIf sections of the user config to the remote check', async () => {
      // The alias only resolves through a config included for git directories ending in /.git
      const alias = 'https://alias.invalid/pages.git';
      const included = path.join(tempDir, 'included');
      await fs.writeFile(included, `[url "${fileUrl(remote)}"]\n\tinsteadOf = ${alias}\n`);
      process.env.GIT_CONFIG_GLOBAL = path.join(tempDir, 'gitconfig');
      await fs.writeFile(process.env.GIT_CONFIG_GLOBAL, `[includeIf "gitdir:**/.git"]\n\tpath = ${included}\n`);

      await deploy({ repo: alias });

      expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
    });

    it.skipIf(process.platform === 'win32')('keeps the clone when a git launcher drops GIT_DIR and GIT_WORK_TREE', async () => {
      // Like wslgit or sudo: same working directory, without the git variables
      const launcher = path.join(tempDir, 'launcher');
      await fs.writeFile(launcher, '#!/bin/sh\nunset GIT_DIR GIT_WORK_TREE\nexec git "$@"\n');
      await fs.chmod(launcher, 0o755);
      await seedBranch(remote, path.join(tempDir, 'seed'), 'gh-pages', { 'old.html': 'old' });

      await deploy({ git: launcher, add: true });

      expect(tree(remote)).toEqual(['assets/app.js', 'index.html', 'old.html']);
    });
  });

  it('skips nested git repositories in the directory', async () => {
    const nested = path.join(dist, 'vendor');
    await fs.mkdir(nested);
    await fs.writeFile(path.join(nested, 'lib.js'), 'lib');
    git(nested, 'init');

    await deploy({ dotfiles: true });

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html', 'vendor/lib.js']);
  });

  it('skips a .GIT directory in any case and never touches the git directory of the clone', async () => {
    // A build output that could overwrite the config of the clone (fsmonitor runs commands)
    const marker = path.join(tempDir, 'pwned');
    await fs.mkdir(path.join(dist, 'assets', '.GIT'));
    await fs.writeFile(path.join(dist, 'assets', '.GIT', 'config'), `[core]\n\tfsmonitor = "touch ${marker}"\n`);

    await deploy({ dotfiles: true });

    expect(tree(remote)).toEqual(['.htaccess', 'assets/app.js', 'index.html']);
    await expect(fs.access(marker)).rejects.toThrow();
  });

  it('redeploys with add and an unchanged directory without a new commit', async () => {
    await seedBranch(remote, path.join(tempDir, 'seed'), 'gh-pages', { 'old-chunk.js': 'old' });

    await deploy({ add: true });
    await deploy({ add: true });

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html', 'old-chunk.js']);
    expect(commitCount(remote)).toBe(2);
  });

  it('accepts a relative CACHE_DIR', async () => {
    const cwd = process.cwd();
    process.chdir(tempDir);
    process.env.CACHE_DIR = 'relative-cache';

    try {
      await deploy();
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('ignores the local git config of the project when it looks for the branch', async () => {
    // actions/checkout stores an extraheader for the source repository the same way
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    git(app, 'config', 'url.file:///does/not/exist/.insteadOf', fileUrl(remote));
    await seedBranch(remote, path.join(tempDir, 'seed'), 'gh-pages', { 'old.html': 'old' });
    const cwd = process.cwd();
    process.chdir(app);

    try {
      await publish(dist, { repo: fileUrl(remote), user, dotfiles: false, nojekyll: false, notfound: false });
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
    expect(commitCount(remote)).toBe(2);
  });

  it('works in a project with a broken .git file', async () => {
    const app = path.join(tempDir, 'broken');
    await fs.mkdir(app);
    await fs.writeFile(path.join(app, '.git'), 'gitdir: /does/not/exist\n');
    const cwd = process.cwd();
    process.chdir(app);

    try {
      await publish(dist, { repo: fileUrl(remote), user, dotfiles: false, nojekyll: false, notfound: false });
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('creates a new branch in the object format of the remote', async () => {
    await seedBranch(remote, path.join(tempDir, 'seed'), 'main', { 'source.ts': 'source' });
    process.env.GIT_DEFAULT_HASH = 'sha256';

    await deploy();

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('replaces a CNAME of the directory with the --cname option', async () => {
    const messages: string[] = [];
    const cname = 'option.example.org';
    await fs.writeFile(path.join(dist, 'CNAME'), 'build.example.org');

    await deploy({ cname }, (message) => messages.push(message));

    expect(git(remote, 'show', 'gh-pages:CNAME')).toBe(cname);
    expect(messages).toContain(`Replacing the CNAME file of the build with ${cname}`);
  });

  it('publishes a CNAME of the directory without the --cname option', async () => {
    const fromBuild = 'build.example.org';
    await fs.writeFile(path.join(dist, 'CNAME'), fromBuild);

    await deploy();

    expect(git(remote, 'show', 'gh-pages:CNAME')).toBe(fromBuild);
  });

  it('replaces a CNAME folder of the directory with the --cname option', async () => {
    const cname = 'option.example.org';
    await fs.mkdir(path.join(dist, 'CNAME'));
    await fs.writeFile(path.join(dist, 'CNAME', 'index.html'), 'route');

    await deploy({ cname });

    expect(tree(remote)).toEqual(['CNAME', 'assets/app.js', 'index.html']);
    expect(git(remote, 'show', 'gh-pages:CNAME')).toBe(cname);
  });

  it('publishes the bytes of the build regardless of git attributes and core.autocrlf', async () => {
    process.env.GIT_CONFIG_GLOBAL = path.join(tempDir, 'gitconfig');
    await fs.writeFile(process.env.GIT_CONFIG_GLOBAL, '[core]\n\tautocrlf = true\n[filter "upper"]\n\tclean = tr a-z A-Z\n\tsmudge = cat\n');
    const crlf = 'line 1\r\nline 2\r\n';
    await fs.writeFile(path.join(dist, '.gitattributes'), '* text=auto\n*.txt filter=upper ident\n');
    await fs.writeFile(path.join(dist, 'crlf.html'), crlf);
    await fs.writeFile(path.join(dist, 'lower.txt'), '$Id$ lower case');

    await deploy({ dotfiles: true });

    const blob = (file: string) => execFileSync('git', ['cat-file', 'blob', `gh-pages:${file}`], { cwd: remote }).toString();
    expect(blob('crlf.html')).toBe(crlf);
    expect(blob('lower.txt')).toBe('$Id$ lower case');
  });

  it('rejects an empty branch name and an empty commit message before cloning', async () => {
    await expect(deploy({ branch: '' })).rejects.toThrow('The branch to publish to (--branch) must not be empty.');
    await expect(deploy({ message: '' })).rejects.toThrow('The commit message (--message) must not be empty.');
    expect(git(remote, 'branch', '--list')).toBe('');
  });

  it('resolves a relative remote from a subdirectory against the top level of the repository', async () => {
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    git(app, 'remote', 'add', 'origin', '../remote.git');
    const subdirectory = path.join(app, 'frontend');
    await fs.mkdir(subdirectory);
    const cwd = process.cwd();
    process.chdir(subdirectory);

    try {
      await publish(dist, { user, dotfiles: false, nojekyll: false, notfound: false });
    } finally {
      process.chdir(cwd);
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('commits with the given user over identity variables of the environment', async () => {
    process.env.GIT_AUTHOR_NAME = 'Env Author';
    process.env.GIT_COMMITTER_EMAIL = 'env@example.org';

    await deploy();

    expect(git(remote, 'log', '-1', '--format=%an <%ae> %cn <%ce>', 'gh-pages')).toBe(
      `${user.name} <${user.email}> ${user.name} <${user.email}>`
    );
  });

  it('works when git variables of a surrounding git process point to another repository', async () => {
    const app = path.join(tempDir, 'app');
    git(tempDir, 'init', app);
    process.env.GIT_DIR = path.join(app, '.git');
    process.env.GIT_WORK_TREE = app;
    process.env.GIT_INDEX_FILE = path.join(app, '.git', 'index');

    try {
      await deploy();
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_WORK_TREE;
      delete process.env.GIT_INDEX_FILE;
    }

    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
    expect(() => git(app, 'rev-parse', '--verify', 'gh-pages')).toThrow();
  });

  it('publishes to an scp-like address without treating it as a relative path', async () => {
    const fakeGit = path.join(tempDir, 'fake-git');
    const addressLog = path.join(tempDir, 'addresses');
    // Maps the scp-like address to the local remote and records what git received
    await fs.writeFile(fakeGit, [
      '#!/bin/sh',
      `echo "$@" >> "${addressLog}"`,
      `exec git -c "url.${fileUrl(remote)}.insteadOf=git@example.org:o/r.git" "$@"`,
      ''
    ].join('\n'));
    await fs.chmod(fakeGit, 0o755);

    await deploy({ repo: 'git@example.org:o/r.git', git: fakeGit });

    expect(await fs.readFile(addressLog, 'utf-8')).toContain('ls-remote git@example.org:o/r.git');
    expect(tree(remote)).toEqual(['assets/app.js', 'index.html']);
  });

  it('has the defaults of angular-cli-ghpages', () => {
    const { depth, ...rest } = defaults;
    expect(depth).toBe(1);
    for (const [key, value] of Object.entries(rest)) {
      expect(engineDefaults[key as keyof typeof engineDefaults]).toBe(value);
    }
  });
});
