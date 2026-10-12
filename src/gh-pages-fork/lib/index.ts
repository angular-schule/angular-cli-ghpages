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

import { Git } from './git';
import { copy, getUser, listFiles, User } from './util';

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
  nojekyll: true
};

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
 * Create a fresh, private directory for a temporary clone: `clone-*` below
 * getCacheDir(), or `angular-cli-ghpages-clone-*` in the os temp directory if
 * there is no cache directory or it isn't writable (e.g. a read-only node_modules).
 */
async function createCloneDir(): Promise<string> {
  const cacheDir = getCacheDir();
  if (cacheDir) {
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      return await fs.mkdtemp(path.join(cacheDir, 'clone-'));
    } catch {
      // fall through to the os temp directory
    }
  }
  return fs.mkdtemp(path.join(os.tmpdir(), TMP_CLONE_PREFIX));
}

/**
 * Remove what interrupted deploys (Ctrl+C, a cancelled CI job) leave behind:
 * `clone-*` directories older than STALE_CLONE_MS and any other entry of the
 * cache directory (clones of older angular-cli-ghpages versions, named after
 * the repository URL including a token), plus old temporary clones in the os
 * temp directory. Clones of concurrent deploys are younger and stay.
 */
async function removeStaleClones(): Promise<void> {
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

  const cacheDir = getCacheDir();
  if (cacheDir) {
    const entries = await fs.readdir(cacheDir).catch(() => [] as string[]);
    await Promise.all(entries.map((name) => removeIfStale(cacheDir, name, 'clone-')));
  }

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
  return !parseUrl(repo) && !/^[^/\\]+:/.test(repo) && !path.isAbsolute(repo);
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
  await git.exec('rev-parse', '--show-toplevel');
  return path.resolve(git.output.trim(), repo);
}

/**
 * Parse a repository URL; undefined for scp-like addresses and local paths.
 */
function parseUrl(repo: string): URL | undefined {
  try {
    return new URL(repo);
  } catch {
    return undefined;
  }
}

/**
 * Whether a repository URL carries a password or token. A URL with only a
 * username (e.g. the HTTPS clone URLs of Bitbucket and Azure DevOps) relies on
 * the user's credential helper and doesn't count.
 */
function hasPassword(repo: string): boolean {
  return !!parseUrl(repo)?.password;
}

function withoutCredentials(repo: string): string {
  const url = parseUrl(repo)!;
  url.username = '';
  url.password = '';
  return url.toString();
}

/**
 * Hide credentials (e.g. an injected token) in a repository URL for logging.
 */
export function redact(repo: string): string {
  const url = parseUrl(repo);
  if (!url || (!url.username && !url.password)) {
    return repo;
  }
  return repo.replace(/^([^:/]+:\/\/)[^/]*@/, '$1***@');
}

/**
 * Publish the files in `basePath` to a branch of a git repository.
 *
 * Prepares the branch in a fresh temporary directory without checking out its
 * files, writes the files from `basePath` (plus .nojekyll and CNAME), stages
 * them as the complete new content of the branch (with `add`: on top of the
 * existing files), commits and pushes. The temporary clone is removed when
 * publish() finishes; a token in the repository URL is only passed on the
 * command line, never kept in the clone's .git/config.
 */
export async function publish(basePath: string, config: PublishOptions, log: Log = () => undefined): Promise<void> {
  const options = { ...defaults, ...config };

  if (!(await fs.stat(basePath)).isDirectory()) {
    throw new Error('The "base" option must be an existing directory');
  }

  const files = await listFiles(basePath, options.dotfiles);
  if (files.length === 0) {
    throw new Error(`The directory "${basePath}" doesn't contain any files to publish.`);
  }

  const user = options.user ?? await getUser(process.cwd(), options.git);
  const repoUrl = await getRepo(options);

  await removeStaleClones();
  const clone = await createCloneDir();

  try {
    // Credentials in the URL must not end up in a credential helper's store
    const credentials = hasPassword(repoUrl);
    const gitArgs = credentials ? ['-c', 'credential.helper='] : [];

    log(`Cloning ${redact(repoUrl)} into ${clone}`);
    const git = await Git.clone(repoUrl, clone, options.branch, options, gitArgs);
    if (credentials) {
      await git.exec('remote', 'set-url', options.remote, withoutCredentials(repoUrl));
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

    log('Adding all');
    await git.addAll(options.add);

    if (user) {
      await git.exec('config', 'user.email', user.email);
      if (user.name) {
        await git.exec('config', 'user.name', user.name);
      }
    }

    log('Committing');
    await git.commit(options.message);

    log('Pushing');
    await git.push(credentials ? repoUrl : options.remote, options.branch);
  } finally {
    try {
      await fs.rm(clone, { recursive: true, force: true, maxRetries: 10 });
    } catch (error) {
      // The deploy result doesn't depend on the cleanup; the next deploy removes stale clones
      log(`Could not remove the temporary clone ${clone}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
