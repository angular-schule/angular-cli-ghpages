/**
 * gh-pages-fork: lib/index.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Git, hasHttpUserinfo, hasPassword, redact, withoutUserinfo } from './git';
import { copy, getUser, isEnvFile, listFiles, User } from './util';

export { redact };

export interface PublishOptions {
  repo?: string;
  branch?: string;
  remote?: string;
  message?: string;
  git?: string;
  depth?: number;
  add?: boolean;
  dotfiles?: boolean;
  nojekyll?: boolean;
  notfound?: boolean;
  cname?: string;
  user?: User;
}

export type Log = (message: string) => void;

/**
 * Same values as engine/defaults.ts; the engine passes every option except
 * `depth` explicitly.
 */
export const defaults = {
  add: false,
  git: 'git',
  depth: 1,
  dotfiles: true,
  branch: 'gh-pages',
  remote: 'origin',
  message: 'Auto-generated commit',
  nojekyll: true,
  notfound: true
};

/** Prefix of temporary clones below the cache directory */
const CLONE_PREFIX = 'clone-';

/** Prefix of temporary clones in the os temp directory */
const TMP_CLONE_PREFIX = 'angular-cli-ghpages-clone-';

/** Temporary clones older than this belong to interrupted deploys */
const STALE_CLONE_MS = 6 * 60 * 60 * 1000;

/**
 * Get the cache directory that holds the temporary clones:
 * 1. `$CACHE_DIR/gh-pages` (boolean-like values such as `true` or `0` are ignored)
 * 2. `node_modules/.cache/gh-pages` next to the closest package.json above `cwd`
 *
 * Returns undefined if neither applies; clones then go to the os temp directory.
 */
export function getCacheDir(cwd = process.cwd()): string | undefined {
  const cacheDirEnv = process.env.CACHE_DIR;
  if (cacheDirEnv && !['true', 'false', '1', '0'].includes(cacheDirEnv)) {
    return path.join(cacheDirEnv, 'gh-pages');
  }

  let dir = path.resolve(cwd);
  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, 'node_modules', '.cache', 'gh-pages');
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/**
 * Create a fresh, private directory for a temporary clone: `clone-*` below the
 * cache directory, or `angular-cli-ghpages-clone-*` in the os temp directory if
 * there is no cache directory or it isn't writable (e.g. a read-only node_modules).
 * The path is absolute, because git resolves GIT_DIR and GIT_WORK_TREE against
 * the directory it runs in.
 */
async function createCloneDir(cacheDir: string | undefined): Promise<string> {
  if (cacheDir) {
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      return path.resolve(await fs.mkdtemp(path.join(cacheDir, CLONE_PREFIX)));
    } catch {
      // fall through to the os temp directory
    }
  }
  return path.resolve(await fs.mkdtemp(path.join(os.tmpdir(), TMP_CLONE_PREFIX)));
}

/**
 * Remove what interrupted deploys (Ctrl+C, a cancelled CI job) leave behind:
 * temporary clones older than STALE_CLONE_MS and every other entry of the cache
 * directory, plus `<os tmpdir>/angular-cli-ghpages-cache`. Such directories can
 * be named after a repository URL including a token. Clones of concurrent
 * deploys are younger and stay.
 */
async function removeStaleClones(cacheDir: string | undefined): Promise<void> {
  const now = Date.now();
  const removeIfStale = async (dir: string, name: string, clonePrefix: string) => {
    const target = path.join(dir, name);
    try {
      if (name.startsWith(clonePrefix) && now - (await fs.stat(target)).mtimeMs < STALE_CLONE_MS) {
        return;
      }
      await fs.rm(target, { recursive: true, force: true });
    } catch {
      // another deploy removed it, or it isn't ours to remove
    }
  };

  if (cacheDir) {
    const entries = await fs.readdir(cacheDir).catch(() => [] as string[]);
    await Promise.all(entries.map((name) => removeIfStale(cacheDir, name, CLONE_PREFIX)));
  }

  await fs.rm(path.join(os.tmpdir(), 'angular-cli-ghpages-cache'), { recursive: true, force: true }).catch(() => undefined);
  const tmpEntries = await fs.readdir(os.tmpdir()).catch(() => [] as string[]);
  await Promise.all(
    tmpEntries
      .filter((name) => name.startsWith(TMP_CLONE_PREFIX))
      .map((name) => removeIfStale(os.tmpdir(), name, TMP_CLONE_PREFIX))
  );
}

/**
 * Whether `repo` is a relative local path (not a URL, not an scp-like `host:path`).
 */
function isRelativePath(repo: string): boolean {
  return !/^[^/\\]+:/.test(repo) && !path.isAbsolute(repo);
}

/**
 * The repository to publish to: `options.repo`, or the URL of `options.remote`
 * of the git repository in the current working directory. Relative local paths
 * become absolute (the clone runs elsewhere): `options.repo` relative to the
 * current working directory, a path from the git config relative to the top
 * level of that repository, like git itself resolves it.
 */
export async function getRepo(options: { repo?: string; git?: string; remote?: string }): Promise<string> {
  if (options.repo) {
    return isRelativePath(options.repo) ? path.resolve(options.repo) : options.repo;
  }
  const git = new Git(process.cwd(), options.git ?? defaults.git);
  const repo = await git.getRemoteUrl(options.remote ?? defaults.remote);
  if (!isRelativePath(repo)) {
    return repo;
  }
  const topLevel = await git.exec('rev-parse', '--show-toplevel');
  return path.resolve(topLevel.trim(), repo);
}

/**
 * Publish the files in `basePath` to a branch of a git repository.
 *
 * Prepares the branch in a fresh temporary directory without checking out its
 * files, writes .nojekyll and CNAME, the files from `basePath` and a 404.html
 * copy of index.html, stages them as the complete new content of the branch
 * (with `add`: on top of the existing files), commits and pushes. Env files in
 * the commit are published like all other files, with a warning (`warn`, falls
 * back to `log`). The temporary directory is removed when publish() finishes;
 * a token in an http(s) URL stays in the clone's .git/config only until the
 * clone is done (an interrupted deploy can leave it there for the next deploy's
 * cleanup) and is passed to git on the command line.
 */
export async function publish(basePath: string, config: PublishOptions, log: Log = () => undefined, warn: Log = log): Promise<void> {
  const options = { ...defaults, ...config };

  if (!(await fs.stat(basePath)).isDirectory()) {
    throw new Error('The "base" option must be an existing directory');
  }

  // A project root as publish directory (e.g. an empty --dir) would publish the
  // sources and everything the project's .gitignore keeps out of its repository
  if (options.dotfiles && existsSync(path.join(basePath, '.git'))) {
    throw new Error(
      `The directory "${basePath}" contains a .git entry, so it looks like a project root and not like a build output. ` +
      'Set the directory to publish with --dir (or use --no-dotfiles if you really want to publish this directory).'
    );
  }

  const files = await listFiles(basePath, options.dotfiles);
  if (files.length === 0) {
    throw new Error(`The directory "${basePath}" doesn't contain any files to publish.`);
  }

  const user = options.user ?? await getUser(process.cwd(), options.git);
  const repoUrl = await getRepo(options);

  const cacheDir = getCacheDir();
  await removeStaleClones(cacheDir);
  const clone = await createCloneDir(cacheDir);

  try {
    // Credentials in the URL must not end up in a credential helper's store
    const gitArgs = hasPassword(repoUrl) ? ['-c', 'credential.helper='] : [];

    log(`Cloning ${redact(repoUrl)} into ${clone}`);
    const git = await Git.clone(repoUrl, clone, options.branch, options, gitArgs, log);
    const stripUserinfo = hasHttpUserinfo(repoUrl);
    if (stripUserinfo) {
      await git.exec('remote', 'set-url', options.remote, withoutUserinfo(repoUrl));
    }

    if (options.add && !git.isNewBranch) {
      log('Keeping the existing files');
      await git.keepExistingFiles();
    }

    if (options.nojekyll) {
      log('Creating .nojekyll');
      await fs.writeFile(path.join(git.cwd, '.nojekyll'), '');
    }

    if (options.cname) {
      log(`Creating CNAME for ${options.cname}`);
      await fs.writeFile(path.join(git.cwd, 'CNAME'), options.cname);
    }

    log('Copying files');
    await copy(files, basePath, git.cwd);

    // After the copy: the SPA fallback for GitHub Pages replaces a 404.html of the
    // build (--no-notfound publishes that one). writeFile: a new file without the
    // mode of index.html.
    if (options.notfound) {
      if (files.includes('index.html')) {
        await fs.writeFile(path.join(git.cwd, '404.html'), await fs.readFile(path.join(basePath, 'index.html')));
        log('404.html file created');
      } else {
        log('index.html could not be copied to 404.html. Proceeding without it.');
      }
    }

    log('Adding all');
    await git.addAll(options.add);

    // The complete content of the commit: also covers env files kept by `add`
    const envFiles = (await git.exec('ls-files', '-z')).split('\0').filter((file) => file && isEnvFile(file));
    if (envFiles.length > 0) {
      envFileWarning(envFiles).forEach((line) => warn(line));
    }

    if (!git.isNewBranch) {
      const removed = (await git.exec('diff', '--cached', '--name-only', '--diff-filter=D', 'HEAD')).split('\n').filter(Boolean);
      if (removed.length > 0) {
        log(`Removing ${removed.length} file(s) from the branch: ${removed.join(', ')}`);
      }
    }

    if (options.user) {
      git.setIdentity(options.user);
    }
    if (user) {
      await git.exec('config', 'user.email', user.email);
      if (user.name) {
        await git.exec('config', 'user.name', user.name);
      }
    }

    log('Committing');
    await git.commit(options.message);

    log('Pushing');
    await git.push(stripUserinfo ? repoUrl : options.remote, options.branch);
  } finally {
    try {
      await fs.rm(clone, { recursive: true, force: true, maxRetries: 10 });
    } catch (error) {
      // The deploy result doesn't depend on the cleanup; the next deploy removes stale clones
      log(`Could not remove the temporary clone ${clone}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Env files usually hold secrets, and everything on the branch is public on
 * GitHub Pages. Publishing them can still be intended, so this is a warning.
 * One message per line: loggers color each message, CI logs color each line.
 */
export function envFileWarning(envFiles: string[]): string[] {
  return [
    `⚠️  WARNING: Publishing env files, which usually contain secrets: ${envFiles.join(', ')}`,
    '   Everything on the branch is publicly visible. If this is not intended, remove them from the build ' +
    '(and from the branch with a deploy without --add) and rotate the secrets.'
  ];
}
