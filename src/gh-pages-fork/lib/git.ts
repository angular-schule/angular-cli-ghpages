/**
 * gh-pages-fork: lib/git.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import * as cp from 'child_process';
import * as path from 'path';

/**
 * Error for a git process that didn't exit with code 0.
 * `message` holds the combined stderr/stdout output of the process.
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
      env: options.env ? { ...process.env, ...options.env } : process.env
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
      } else {
        const reason = signal ? 'Process killed by ' + signal : 'Process failed: ' + code;
        reject(new ProcessError(code, output.join('') || reason));
      }
    });
  });
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
   * @param env Additional environment variables for every git process
   */
  constructor(
    public readonly cwd: string,
    public readonly cmd = 'git',
    private readonly args: string[] = [],
    private readonly env?: NodeJS.ProcessEnv
  ) {}

  /**
   * Clone a branch of a repo into the given (empty or missing) dir.
   * Falls back to a full clone of the default branch when the branch doesn't exist yet.
   *
   * The returned instance never operates on a repository above `dir`
   * (GIT_CEILING_DIRECTORIES), even if `dir` loses its .git directory.
   */
  static async clone(repo: string, dir: string, branch: string, options: CloneOptions, args: string[] = []): Promise<Git> {
    const env = { GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(dir)) };
    try {
      await spawn(options.git, [
        ...args,
        'clone', repo, dir,
        '--branch', branch,
        '--single-branch',
        '--origin', options.remote,
        '--depth', String(options.depth)
      ], { env });
    } catch {
      await spawn(options.git, [...args, 'clone', repo, dir, '--origin', options.remote], { env });
    }
    return new Git(dir, options.git, args, env);
  }

  /**
   * Execute an arbitrary git command.
   */
  async exec(...args: string[]): Promise<this> {
    this.output = await spawn(this.cmd, [...this.args, ...args], { cwd: this.cwd, env: this.env });
    return this;
  }

  /**
   * Clean up unversioned files.
   */
  clean(): Promise<this> {
    return this.exec('clean', '-f', '-d');
  }

  /**
   * Hard reset to remote/branch.
   */
  reset(remote: string, branch: string): Promise<this> {
    return this.exec('reset', '--hard', remote + '/' + branch);
  }

  /**
   * Checkout a branch. A branch that doesn't exist on the remote is created as
   * an empty orphan branch (the files of the cloned default branch are removed).
   */
  async checkout(remote: string, branch: string): Promise<this> {
    const treeish = remote + '/' + branch;
    try {
      await this.exec('ls-remote', '--exit-code', '.', treeish);
    } catch (error) {
      if (error instanceof ProcessError && error.code === 2) {
        await this.exec('checkout', '--orphan', branch);
        return this.removeAll();
      }
      throw error;
    }

    await this.exec('checkout', branch);
    await this.clean();
    return this.reset(remote, branch);
  }

  /**
   * Remove files from the index and the working tree.
   */
  rm(files: string[]): Promise<this> {
    return this.exec('rm', '--ignore-unmatch', '-r', '-f', '--', ...files);
  }

  /**
   * Remove all tracked files, including dotfiles and submodule gitlinks.
   * `.gitmodules` goes first: `git rm` reads it to update submodule entries and
   * fails when it is already gone while a gitlink sorting before it remains.
   */
  async removeAll(): Promise<this> {
    await this.rm(['.gitmodules']);
    return this.rm(['.']);
  }

  /**
   * Add files.
   */
  add(files: string[]): Promise<this> {
    return this.exec('add', ...files);
  }

  /**
   * Commit (if there are any changes).
   */
  async commit(message: string): Promise<this> {
    try {
      return await this.exec('diff-index', '--quiet', 'HEAD');
    } catch {
      return this.exec('commit', '-m', message);
    }
  }

  /**
   * Push a branch.
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
