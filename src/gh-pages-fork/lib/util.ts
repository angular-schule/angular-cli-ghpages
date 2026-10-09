/**
 * gh-pages-fork: lib/util.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { Git } from './git';

export interface User {
  name: string;
  email: string;
}

/**
 * List all files below `base` as relative paths with POSIX separators.
 * Symbolic links are followed (their targets get copied).
 * Entries starting with `.` are skipped unless `dotfiles` is set.
 */
export async function listFiles(base: string, dotfiles: boolean): Promise<string[]> {
  const files: string[] = [];

  async function walk(relDir: string): Promise<void> {
    const entries = await fs.readdir(path.join(base, relDir), { withFileTypes: true });
    for (const entry of entries) {
      if (!dotfiles && entry.name.startsWith('.')) {
        continue;
      }
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const stat = entry.isSymbolicLink() ? await fs.stat(path.join(base, relPath)) : entry;
      if (stat.isDirectory()) {
        await walk(relPath);
      } else if (stat.isFile()) {
        files.push(relPath);
      }
    }
  }

  await walk('');
  return files;
}

/**
 * Copy a list of files.
 */
export async function copy(files: string[], base: string, dest: string): Promise<void> {
  for (const file of files) {
    const src = path.resolve(base, file);
    const target = path.join(dest, path.relative(base, src));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(src, target);
  }
}

/**
 * Read the git user of the current working directory.
 * Resolves with null when name or email is not configured.
 */
export async function getUser(cwd?: string): Promise<User | null> {
  try {
    const [name, email] = await Promise.all([
      new Git(cwd ?? process.cwd()).exec('config', 'user.name'),
      new Git(cwd ?? process.cwd()).exec('config', 'user.email')
    ]);
    return { name: name.output.trim(), email: email.output.trim() };
  } catch {
    return null;
  }
}
