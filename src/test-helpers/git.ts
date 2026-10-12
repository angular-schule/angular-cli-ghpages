/**
 * Shared helpers for specs that run real git commands or mock child processes.
 * Not part of the published package (excluded in tsconfig.build.json).
 */

import { ChildProcess, execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Run git in `cwd` and return its trimmed stdout.
 */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

/**
 * Sorted list of all files on a branch.
 */
export function tree(repo: string, branch = 'gh-pages'): string[] {
  return git(repo, 'ls-tree', '-r', '--name-only', branch).split('\n').filter(Boolean).sort();
}

export function commitCount(repo: string, branch = 'gh-pages'): number {
  return Number(git(repo, 'rev-list', '--count', branch));
}

/**
 * Create a bare repository that serves as the remote.
 */
export function createBareRepo(dir: string): string {
  git(path.dirname(dir), 'init', '--bare', dir);
  return dir;
}

/**
 * Push a branch with the given files (and optional submodule gitlinks) to `remote`.
 */
export async function seedBranch(
  remote: string,
  workDir: string,
  branch: string,
  files: Record<string, string>,
  gitlinks: string[] = []
): Promise<void> {
  await fs.mkdir(workDir, { recursive: true });
  git(workDir, 'init', '-b', branch);
  git(workDir, 'config', 'user.name', 'Seed');
  git(workDir, 'config', 'user.email', 'seed@example.org');
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(workDir, file)), { recursive: true });
    await fs.writeFile(path.join(workDir, file), content);
  }
  git(workDir, 'add', '.');
  git(workDir, 'commit', '--allow-empty', '-m', 'seed');
  for (const gitlink of gitlinks) {
    // update-index --cacheinfo creates a 160000 (submodule) entry without a real subrepo
    git(workDir, 'update-index', '--add', '--cacheinfo', `160000,${git(workDir, 'rev-parse', 'HEAD')},${gitlink}`);
  }
  if (gitlinks.length > 0) {
    git(workDir, 'commit', '-m', 'gitlinks');
  }
  git(workDir, 'push', remote, branch);
}

/**
 * Child process stand-in with what gh-pages-fork lib/git.ts uses: stdout/stderr 'data', 'close'.
 */
export function createMockChildProcess(): ChildProcess {
  return Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter()
  }) as unknown as ChildProcess;
}
