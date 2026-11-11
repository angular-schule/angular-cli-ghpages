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

import { Git, hasHttpUserinfo, hasPassword, isolatedEnv, redact, spawn, withoutUserinfo } from './git';
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
 * files, writes .nojekyll, the files from `basePath`, CNAME (replacing one of the
 * build) and a 404.html copy of index.html, stages them as the complete new content of the branch
 * (with `add`: on top of the existing files), commits and pushes. Env files in
 * the commit are published like all other files, with a warning (`warn`, falls
 * back to `log`). The temporary directory is removed when publish() finishes;
 * a token in an http(s) URL stays in the clone's .git/config only until the
 * clone is done (an interrupted deploy can leave it there for the next deploy's
 * cleanup) and is passed to git on the command line.
 */
/**
 * Check what a deploy of `basePath` would publish and fail early with a clear
 * message: the directory, a project root, an empty directory, an empty branch
 * name or commit message. Runs for the deploy and for the dry run.
 * Resolves with the files to publish (relative paths, `/` as separator).
 */
export async function listPublishedFiles(basePath: string, config: PublishOptions): Promise<string[]> {
  const options = { ...defaults, ...config };

  let isDirectory = false;
  try {
    isDirectory = (await fs.stat(basePath)).isDirectory();
  } catch {
    // reported below
  }
  if (!isDirectory) {
    throw new Error(`The path "${basePath}" to publish (--dir) is not an existing directory.`);
  }

  // A project root as publish directory (e.g. an empty --dir) would publish the
  // sources and everything the project's .gitignore keeps out of its repository.
  // A build folder that is itself a clone (of the pages branch) has no package.json.
  if (options.dotfiles && existsSync(path.join(basePath, '.git')) && existsSync(path.join(basePath, 'package.json'))) {
    throw new Error(
      `The directory "${basePath}" contains a .git entry and a package.json, so it looks like a project root and not like a build output. ` +
      'Set the directory to publish with --dir (or use --no-dotfiles if you really want to publish this directory).'
    );
  }

  if (!options.branch) {
    throw new Error('The branch to publish to (--branch) must not be empty.');
  }
  if (!options.message) {
    throw new Error('The commit message (--message) must not be empty.');
  }

  const files = await listFiles(basePath, options.dotfiles);
  if (files.length === 0) {
    throw new Error(`The directory "${basePath}" doesn't contain any files to publish.`);
  }
  return files;
}

/**
 * The files of `files` (relative to `basePath`) that an ignore rule of the
 * build or of the user's git config matches, without a clone: a throwaway
 * repository with `basePath` as work tree, which git only reads. The dry run
 * uses this; a deploy also sees the ignore rules of a branch kept by `add`.
 */
export async function listIgnoredFiles(basePath: string, files: string[], gitCmd = defaults.git): Promise<string[]> {
  const gitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'angular-cli-ghpages-ignored-'));
  try {
    await spawn(gitCmd, ['init', '--quiet', '--bare', gitDir], { env: isolatedEnv() });
    const git = new Git(basePath, gitCmd, [], isolatedEnv({ GIT_DIR: gitDir, GIT_WORK_TREE: path.resolve(basePath) }));
    const ignored = new Set((await git.exec('ls-files', '--others', '--ignored', '--exclude-standard', '-z')).split('\0').filter(Boolean));
    return files.filter((file) => ignored.has(file));
  } finally {
    await fs.rm(gitDir, { recursive: true, force: true });
  }
}

export async function publish(basePath: string, config: PublishOptions, log: Log = () => undefined, warn: Log = log): Promise<void> {
  const options = { ...defaults, ...config };
  const files = await listPublishedFiles(basePath, options);

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

    log('Copying files');
    await copy(files, basePath, git.cwd);

    // After the copy: --cname replaces a CNAME of the build
    if (options.cname) {
      log(files.includes('CNAME') ? `Replacing the CNAME file of the build with ${options.cname}` : `Creating CNAME for ${options.cname}`);
      await fs.rm(path.join(git.cwd, 'CNAME'), { recursive: true, force: true });
      await fs.writeFile(path.join(git.cwd, 'CNAME'), options.cname);
    }

    // After the copy: the SPA fallback for GitHub Pages replaces a 404.html of the
    // build (--no-notfound publishes that one). writeFile: a new file without the
    // mode of index.html. Without a readable index.html file (also Index.html on a
    // case-sensitive file system) or with a 404.html folder, the deploy goes on.
    if (options.notfound) {
      try {
        await fs.writeFile(path.join(git.cwd, '404.html'), await fs.readFile(path.join(basePath, 'index.html')));
        log('404.html file created');
      } catch {
        log('index.html could not be copied to 404.html. Proceeding without it.');
      }
    }

    // Every file of the build is published; name the ones an ignore rule would leave out
    const ignored = (await git.exec('ls-files', '--others', '--ignored', '--exclude-standard', '-z')).split('\0').filter(Boolean);
    if (ignored.length > 0) {
      ignoredFileWarning(ignored).forEach((line) => warn(line));
    }

    log('Adding all');
    await git.addAll(options.add);

    // The complete content of the commit: also covers env files kept by `add`
    const envFiles = (await git.exec('ls-files', '-z')).split('\0').filter((file) => file && isEnvFile(file));
    if (envFiles.length > 0) {
      envFileWarning(envFiles).forEach((line) => warn(line));
    }

    if (!git.isNewBranch) {
      // diff-index: no rename detection, which would hide removed files and take seconds
      const removed = (await git.exec('diff-index', '--cached', '--name-only', '--diff-filter=D', '-z', 'HEAD', '--')).split('\0').filter(Boolean);
      if (removed.length > 0) {
        log(`Removing ${removed.length} file(s) from the branch: ${shortList(removed)}`);
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
    `⚠️  WARNING: Publishing env files, which usually contain secrets: ${shortList(envFiles)}`,
    '   Everything on the branch is publicly visible. If this is not intended, remove them from the build ' +
    '(and from the branch with a deploy without --add) and rotate the secrets.'
  ];
}

/**
 * Ignore rules (the user's global gitignore, a .gitignore in the build) don't
 * decide what is published: the deployment holds every file of the build.
 */
export function ignoredFileWarning(files: string[]): string[] {
  return [
    `⚠️  WARNING: Publishing files that match an ignore rule (global gitignore or a .gitignore in the build): ${shortList(files)}`,
    '   Every file of the build is published, ignore rules don\'t apply. If this is not intended, remove them from the build.'
  ];
}

/** At most 10 paths, so a large site doesn't produce a log line of megabytes */
function shortList(files: string[]): string {
  const limit = 10;
  return files.length > limit
    ? `${files.slice(0, limit).join(', ')} and ${files.length - limit} more`
    : files.join(', ');
}
