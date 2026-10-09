/**
 * gh-pages-fork: lib/index.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import { createHash } from 'crypto';
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

export const defaults = {
  add: false,
  git: 'git',
  depth: 1,
  dotfiles: false,
  branch: 'gh-pages',
  remote: 'origin',
  message: 'Updates',
  nojekyll: false
};

/**
 * Get the cache directory.
 *
 * Resolution order:
 * 1. `$CACHE_DIR/gh-pages` (boolean-like values such as `true` or `0` are ignored)
 * 2. `node_modules/.cache/gh-pages` next to the closest package.json above cwd
 * 3. `<os tmpdir>/angular-cli-ghpages-cache/gh-pages`
 *
 * With `optPath`, returns a subdirectory named after a hash of it, so repository
 * URLs (which may contain tokens) never end up in a path on disk.
 */
export function getCacheDir(optPath?: string): string {
  const dir = findCacheDir(process.cwd());
  if (!optPath) {
    return dir;
  }
  return path.join(dir, createHash('sha256').update(optPath).digest('hex').slice(0, 16));
}

function findCacheDir(cwd: string): string {
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
      return path.join(os.tmpdir(), 'angular-cli-ghpages-cache', 'gh-pages');
    }
    dir = parent;
  }
}

/**
 * Clean the cache directory.
 */
export async function clean(): Promise<void> {
  await fs.rm(getCacheDir(), { recursive: true, force: true });
}

async function getRepo(options: { repo?: string; git: string; remote: string }): Promise<string> {
  if (options.repo) {
    return options.repo;
  }
  return new Git(process.cwd(), options.git).getRemoteUrl(options.remote);
}

/**
 * Hide credentials (e.g. an injected token) in a repository URL for logging.
 */
function redact(repo: string): string {
  return repo.replace(/\/\/[^/@]+@/, '//***@');
}

/**
 * Publish the files in `basePath` to a branch of a git repository.
 *
 * Clones the branch into the cache directory, replaces its content with the
 * files from `basePath` (unless `add` is set), commits and pushes.
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

  const user = options.user ?? await getUser();
  const repoUrl = await getRepo(options);
  const clone = getCacheDir(repoUrl);

  log(`Cloning ${redact(repoUrl)} into ${clone}`);
  const git = await Git.clone(repoUrl, clone, options.branch, options);
  const url = await git.getRemoteUrl(options.remote);
  if (url !== repoUrl) {
    throw new Error(
      `Remote url mismatch.  Got "${redact(url)}" but expected "${redact(repoUrl)}" in ${git.cwd}.  Remove the cache directory and try again.`
    );
  }

  // only required if someone mucks with the checkout between builds
  log('Cleaning');
  await git.clean();

  log(`Fetching ${options.remote}`);
  await git.fetch(options.remote);

  log(`Checking out ${options.remote}/${options.branch}`);
  await git.checkout(options.remote, options.branch);

  if (!options.add) {
    log('Removing files');
    await git.rm(['.']);
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
  await git.add(['.']);

  if (user) {
    await git.exec('config', 'user.email', user.email);
    if (user.name) {
      await git.exec('config', 'user.name', user.name);
    }
  }

  log('Committing');
  await git.commit(options.message);

  log('Pushing');
  await git.push(options.remote, options.branch);
}
