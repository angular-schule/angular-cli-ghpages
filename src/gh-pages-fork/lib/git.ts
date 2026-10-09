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
 * Error for a git process that exited with a non-zero code.
 * `message` holds the combined stdout/stderr output of the process.
 */
export class ProcessError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message);
    this.name = 'ProcessError';
  }
}

/**
 * Run a process and resolve with its combined stdout/stderr output.
 * Rejects with a ProcessError on a non-zero exit code.
 */
export function spawn(exe: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(exe, args, { cwd: cwd || process.cwd() });
    const buffer: string[] = [];
    child.stderr.on('data', (chunk: Buffer) => buffer.push(chunk.toString()));
    child.stdout.on('data', (chunk: Buffer) => buffer.push(chunk.toString()));
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      const output = buffer.join('');
      if (code) {
        reject(new ProcessError(code, output || 'Process failed: ' + code));
      } else {
        resolve(output);
      }
    });
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface CloneOptions {
  git: string;
  remote: string;
  depth: number;
}

/**
 * Executes git commands in one repository directory.
 * `output` holds the output of the last executed command.
 */
export class Git {
  output = '';

  constructor(
    public readonly cwd: string,
    public readonly cmd = 'git'
  ) {}

  /**
   * Clone a repo into the given dir if it doesn't already exist.
   * Falls back to a full clone of the default branch when the branch doesn't exist yet.
   */
  static async clone(repo: string, dir: string, branch: string, options: CloneOptions): Promise<Git> {
    if (await pathExists(dir)) {
      return new Git(dir, options.git);
    }

    await fs.mkdir(path.dirname(path.resolve(dir)), { recursive: true });

    try {
      await spawn(options.git, [
        'clone', repo, dir,
        '--branch', branch,
        '--single-branch',
        '--origin', options.remote,
        '--depth', String(options.depth)
      ]);
    } catch {
      await spawn(options.git, ['clone', repo, dir, '--origin', options.remote]);
    }
    return new Git(dir, options.git);
  }

  /**
   * Execute an arbitrary git command.
   */
  async exec(...args: string[]): Promise<this> {
    this.output = await spawn(this.cmd, args, this.cwd);
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
   * Fetch from a remote.
   */
  fetch(remote: string): Promise<this> {
    return this.exec('fetch', remote);
  }

  /**
   * Checkout a branch (create an orphan if it doesn't exist on the remote).
   */
  async checkout(remote: string, branch: string): Promise<this> {
    const treeish = remote + '/' + branch;
    try {
      await this.exec('ls-remote', '--exit-code', '.', treeish);
    } catch (error) {
      if (error instanceof ProcessError && error.code === 2) {
        return this.exec('checkout', '--orphan', branch);
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
    } catch {
      repo = undefined;
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
