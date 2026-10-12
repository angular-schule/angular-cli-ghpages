/**
 * gh-pages-fork: lib/git.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

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
 * Variables that point git at a repository. A deploy started by git itself
 * (hooks, `!` aliases, worktrees) inherits them; commands for the clone must
 * never act on that repository.
 */
const REPOSITORY_VARIABLES = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR',
  'GIT_GRAFT_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX', 'GIT_SHALLOW_FILE'
];

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

export interface CloneOptions {
  git: string;
  remote: string;
  depth: number;
}

/**
 * Executes git commands in one repository directory.
 * `output` holds the stdout of the last executed command.
 */
export class Git {
  output = '';

  /**
   * @param cwd Repository directory
   * @param cmd Git executable
   * @param args Arguments placed before every git subcommand (e.g. `-c key=value`)
   * @param env Complete environment of every git process (default: process.env)
   * @param isNewBranch The branch doesn't exist on the remote yet (set by Git.clone)
   */
  constructor(
    public readonly cwd: string,
    public readonly cmd = 'git',
    private readonly args: string[] = [],
    private readonly env?: NodeJS.ProcessEnv,
    public readonly isNewBranch = false
  ) {}

  /**
   * Whether `branch` exists in the repository `repo`.
   * Rejects for every other failure (authentication, network, missing repository).
   */
  static async branchExists(repo: string, branch: string, cmd: string, args: string[] = []): Promise<boolean> {
    try {
      await spawn(cmd, [...args, 'ls-remote', '--exit-code', '--heads', repo, 'refs/heads/' + branch], { env: isolatedEnv() });
      return true;
    } catch (error) {
      if (error instanceof ProcessError && error.code === 2) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Prepare a repository for `branch` of `repo` in the given empty dir,
   * without checking out any files (the index starts empty):
   * - existing branch: clone only that branch (shallow, then in full for
   *   servers without shallow clone support)
   * - new branch: an empty repository with `repo` as remote and HEAD on the unborn branch
   *
   * The returned instance always operates on `dir`: GIT_DIR and GIT_WORK_TREE
   * point to it, inherited repository variables are removed, and
   * safe.directory covers it.
   */
  static async clone(repo: string, dir: string, branch: string, options: CloneOptions, args: string[] = []): Promise<Git> {
    const exists = await Git.branchExists(repo, branch, options.git, args);
    const run = (...gitArgs: string[]) => spawn(options.git, [...args, ...gitArgs], { env: isolatedEnv() });

    if (exists) {
      const clone = ['clone', repo, dir, '--origin', options.remote, '--branch', branch, '--single-branch', '--no-checkout'];
      try {
        await run(...clone, '--depth', String(options.depth));
      } catch {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
        await run(...clone);
      }
    } else {
      await run('init', dir);
    }

    const git = new Git(
      dir,
      options.git,
      [...args, '-c', 'safe.directory=' + dir],
      isolatedEnv({ GIT_DIR: path.join(dir, '.git'), GIT_WORK_TREE: dir }),
      !exists
    );
    if (!exists) {
      await git.exec('remote', 'add', options.remote, repo);
      await git.exec('symbolic-ref', 'HEAD', 'refs/heads/' + branch);
    }
    return git;
  }

  /**
   * Execute an arbitrary git command.
   */
  async exec(...args: string[]): Promise<this> {
    this.output = await spawn(this.cmd, [...this.args, ...args], { cwd: this.cwd, env: this.env });
    return this;
  }

  /**
   * Fill the index with the tree of HEAD (the clone has no checkout), so that
   * a commit keeps the existing files of the branch.
   */
  keepExistingFiles(): Promise<this> {
    return this.exec('read-tree', 'HEAD');
  }

  /**
   * Stage all files of the working tree, including files that match ignore rules
   * (the user's global gitignore or a .gitignore in dist must not drop files).
   * With `keepRemoved`, files missing from the working tree stay in the index.
   */
  addAll(keepRemoved: boolean): Promise<this> {
    return this.exec('add', '--force', keepRemoved ? '--ignore-removal' : '--all', '--', '.');
  }

  /**
   * Commit (if there are any changes). Hooks of the user don't apply to deploy commits.
   */
  async commit(message: string): Promise<this> {
    try {
      return await this.exec('diff-index', '--quiet', 'HEAD');
    } catch {
      return this.exec('commit', '--no-verify', '-m', message);
    }
  }

  /**
   * Push a branch to a remote name or URL.
   */
  push(remote: string, branch: string): Promise<this> {
    return this.exec('push', '--tags', remote, branch);
  }

  /**
   * Get the URL for a remote.
   */
  async getRemoteUrl(remote: string): Promise<string> {
    let repo: string | undefined;
    try {
      await this.exec('config', '--get', 'remote.' + remote + '.url');
      repo = this.output.split(/[\n\r]/).shift();
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
