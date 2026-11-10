/**
 * gh-pages-fork: lib/git.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import { REPOSITORY_VARIABLES } from './repository-variables';

/**
 * Error for a git process that didn't exit with code 0.
 * `message` holds the combined stderr/stdout output of the process
 * (plus the signal, if the process was killed).
 */
export class ProcessError extends Error {
  constructor(
    public readonly code: number | null,
    message: string
  ) {
    super(message);
    this.name = 'ProcessError';
  }
}

export interface SpawnOptions {
  cwd?: string;
  /** Complete environment of the process (default: process.env) */
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a process and resolve with its stdout.
 * Rejects with a ProcessError unless the process exits with code 0,
 * which includes a process killed by a signal.
 */
export function spawn(exe: string, args: string[], options: SpawnOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(exe, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env ?? process.env
    });
    const stdout: string[] = [];
    const output: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk.toString());
      output.push(chunk.toString());
    });
    child.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString()));
    child.on('error', reject);
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        resolve(stdout.join(''));
        return;
      }
      const message = [output.join('').trim(), signal ? 'Process killed by ' + signal : ''].filter(Boolean).join('\n');
      reject(new ProcessError(code, message || 'Process failed: ' + code));
    });
  });
}

/**
 * process.env without the repository variables, plus `extra`.
 */
function isolatedEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of REPOSITORY_VARIABLES) {
    delete env[name];
  }
  return { ...env, ...extra };
}

/** Scheme (group 1) and userinfo (group 2) of a repository URL; two characters minimum, so `C:\\` is no scheme */
const URL_WITH_USERINFO = /^([a-z][a-z0-9+.-]+:[/\\]*)([^/]*)@/i;

/**
 * Hide credentials (e.g. an injected token) in a repository URL for logging.
 */
export function redact(repo: string): string {
  return repo.replace(URL_WITH_USERINFO, '$1***@');
}

/**
 * Whether a repository URL carries a password or token. A URL with only a
 * username (e.g. the HTTPS clone URLs of Bitbucket and Azure DevOps) relies on
 * the user's credential helper and doesn't count.
 */
export function hasPassword(repo: string): boolean {
  return !!URL_WITH_USERINFO.exec(repo)?.[2].includes(':');
}

/**
 * Whether an http(s) URL has userinfo: a token can also be the username
 * (`https://TOKEN@github.com/...`), so it must not stay in the clone's config.
 */
export function hasHttpUserinfo(repo: string): boolean {
  return /^https?:/i.test(repo) && URL_WITH_USERINFO.test(repo);
}

export function withoutUserinfo(repo: string): string {
  return repo.replace(URL_WITH_USERINFO, '$1');
}

export interface CloneOptions {
  git: string;
  remote: string;
  depth: number;
}

/**
 * Executes git commands in one repository directory.
 */
export class Git {

  /**
   * @param cwd Work tree
   * @param cmd Git executable
   * @param args Arguments placed before every git subcommand (e.g. `-c key=value`)
   * @param env Complete environment of every git process (default: process.env)
   * @param isNewBranch The branch doesn't exist on the remote yet (set by Git.clone)
   */
  constructor(
    public readonly cwd: string,
    public readonly cmd = 'git',
    private readonly args: string[] = [],
    private env?: NodeJS.ProcessEnv,
    public readonly isNewBranch = false
  ) {}

  /**
   * Prepare a repository for `branch` of `repo` below the given private, empty
   * dir, without checking out any files (the index starts empty):
   * - existing branch: clone only that branch (see cloneBranch)
   * - new branch: an empty repository with `repo` as remote and HEAD on the unborn branch
   *
   * The git directory (`<dir>/.git`) lives outside the work tree (`<dir>/work`),
   * so no copied file can ever overwrite it. Commands of the returned instance
   * have GIT_DIR and GIT_WORK_TREE pinned to these, inherited repository
   * variables are removed, and the throwaway repository runs no maintenance.
   * The work tree also gets a `.git` file pointing to the git directory: a git
   * launcher that drops GIT_DIR (wslgit, sudo) still finds the clone and never
   * the project's repository.
   */
  static async clone(repo: string, dir: string, branch: string, options: CloneOptions, args: string[] = [], log: (message: string) => void = () => undefined): Promise<Git> {
    const workTree = path.join(dir, 'work');
    // Named .git: [includeIf "gitdir:..."] patterns of the user's config often end in /.git
    const gitDir = path.join(dir, '.git');
    const run = (gitArgs: string[], env: NodeJS.ProcessEnv = {}) =>
      spawn(options.git, [...args, ...gitArgs], {
        cwd: dir,
        // Git must not read the config of a repository around the private dir
        // (e.g. the extraheader of actions/checkout in the project)
        env: isolatedEnv({ GIT_CEILING_DIRECTORIES: path.dirname(dir), ...env })
      });
    const cloneArgs = ['clone', repo, workTree, '--separate-git-dir', gitDir, '--origin', options.remote, '--no-checkout'];

    const refs = (await listRemoteRefs(run, repo, gitDir, options.remote)).split('\n').filter(Boolean);
    const exists = refs.some((ref) => ref.endsWith('\trefs/heads/' + branch));

    if (exists) {
      await cloneBranch(
        (extraArgs) => run([...cloneArgs, '--branch', branch, '--single-branch', ...extraArgs]),
        String(options.depth),
        async () => {
          await fs.rm(workTree, { recursive: true, force: true });
          await fs.rm(gitDir, { recursive: true, force: true });
        },
        (message) => log(message.split(repo).join(redact(repo)))
      );
    } else if (refs.length > 0) {
      // The object format of a new repository must match the remote, or the push fails
      const objectFormat = refs[0].split('\t')[0].length === 64 ? 'sha256' : 'sha1';
      await run(['init', '--separate-git-dir', gitDir, workTree], { GIT_DEFAULT_HASH: objectFormat });
    } else {
      // An empty remote: cloning it takes over its object format
      await run(cloneArgs);
    }

    // A relative path keeps working when a launcher translates paths (wslgit).
    // Removed first: git marks the file hidden on Windows, which can't be opened for writing.
    const gitFile = path.join(workTree, '.git');
    await fs.mkdir(workTree, { recursive: true });
    await fs.rm(gitFile, { force: true });
    await fs.writeFile(gitFile, 'gitdir: ../.git\n');

    const git = new Git(
      workTree,
      options.git,
      [...args, '-c', 'maintenance.auto=false', '-c', 'gc.auto=0'],
      isolatedEnv({ GIT_DIR: gitDir, GIT_WORK_TREE: workTree }),
      !exists
    );
    if (!exists) {
      if (refs.length > 0) {
        await git.exec('remote', 'add', options.remote, repo);
      }
      await git.exec('symbolic-ref', 'HEAD', 'refs/heads/' + branch);
    }
    return git;
  }

  /**
   * Commit with this identity, also over GIT_AUTHOR_* / GIT_COMMITTER_* from the
   * environment (git hooks and some CI systems export them).
   */
  setIdentity(user: { name: string; email: string }): void {
    // An empty value leaves the identity of the config in place (like `git config` in publish())
    this.env = {
      ...(this.env ?? process.env),
      ...(user.name ? { GIT_AUTHOR_NAME: user.name, GIT_COMMITTER_NAME: user.name } : {}),
      ...(user.email ? { GIT_AUTHOR_EMAIL: user.email, GIT_COMMITTER_EMAIL: user.email } : {})
    };
  }

  /**
   * Execute an arbitrary git command and resolve with its stdout.
   */
  exec(...args: string[]): Promise<string> {
    return spawn(this.cmd, [...this.args, ...args], { cwd: this.cwd, env: this.env });
  }

  /**
   * Fill the index with the tree of HEAD (the clone has no checkout), so that
   * a commit keeps the existing files of the branch.
   */
  async keepExistingFiles(): Promise<void> {
    await this.exec('read-tree', 'HEAD');
  }

  /**
   * Stage all files of the working tree, including files that match ignore rules
   * (the user's global gitignore or a .gitignore in dist must not drop files).
   * With `keepRemoved`, files missing from the working tree stay in the index.
   */
  async addAll(keepRemoved: boolean): Promise<void> {
    await this.exec('add', '--force', keepRemoved ? '--ignore-removal' : '--all', '--', '.');
  }

  /**
   * Commit (if there are any changes).
   */
  async commit(message: string): Promise<void> {
    try {
      // --cached: the work tree only holds the new files, not the kept ones of --add;
      // `--`: a file or folder named HEAD (or head) in the build is no revision
      await this.exec('diff-index', '--cached', '--quiet', 'HEAD', '--');
    } catch {
      await this.exec('commit', '-m', message);
    }
  }

  /**
   * Push a branch to a remote name or URL.
   */
  async push(remote: string, branch: string): Promise<void> {
    await this.exec('push', '--tags', remote, branch);
  }

  /**
   * Get the URL for a remote.
   */
  async getRemoteUrl(remote: string): Promise<string> {
    let repo: string | undefined;
    try {
      repo = (await this.exec('config', '--get', 'remote.' + remote + '.url')).split(/[\n\r]/).shift();
    } catch (error) {
      if (!(error instanceof ProcessError)) {
        throw error;
      }
      // exit code 1: the key is not set; anything else is a real git error
      if (error.code !== 1) {
        throw new Error('Failed to get remote.' + remote + '.url: ' + error.message);
      }
    }
    if (!repo) {
      throw new Error(
        'Failed to get remote.' + remote + '.url (task must either be ' +
        'run in a git repository with a configured ' + remote + ' remote ' +
        'or must be configured with the "repo" option).'
      );
    }
    return repo;
  }
}

/**
 * The refs of `repo`, read from inside a throwaway repository at `gitDir` with
 * `repo` as remote: [includeIf "gitdir:..."] and [includeIf "hasconfig:remote.*.url:..."]
 * sections of the user's config (per-account SSH key, insteadOf, proxy) apply
 * as they do for the clone and the push. The repository is removed afterwards.
 */
async function listRemoteRefs(
  run: (gitArgs: string[], env?: NodeJS.ProcessEnv) => Promise<string>,
  repo: string,
  gitDir: string,
  remote: string
): Promise<string> {
  try {
    await run(['init', '--quiet', '--bare', gitDir]);
    await run(['remote', 'add', remote, repo], { GIT_DIR: gitDir });
    return await run(['ls-remote', repo], { GIT_DIR: gitDir });
  } finally {
    await fs.rm(gitDir, { recursive: true, force: true });
  }
}

/**
 * Clone shallow; a server without shallow clone support gets a full clone right
 * away. Any other failure may be transient: one more shallow attempt, then a
 * full clone as the last resort.
 */
async function cloneBranch(
  clone: (extraArgs: string[]) => Promise<string>,
  depth: string,
  reset: () => Promise<void>,
  log: (message: string) => void
): Promise<void> {
  const shallow = ['--depth', depth];
  for (const last of [false, true]) {
    try {
      await clone(shallow);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Shallow clone failed: ${message}`);
      await reset();
      if (last || /shallow/i.test(message)) {
        await clone([]);
        return;
      }
    }
  }
}
