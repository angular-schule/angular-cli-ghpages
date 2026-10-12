/**
 * gh-pages-fork: lib/util.js of gh-pages, see ../README.md
 *
 * Original: https://github.com/tschaub/gh-pages (MIT License)
 * Copyright (c) 2014 Tim Schaub
 */

import { createReadStream, createWriteStream, realpath } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

import { Git } from './git';

export interface User {
  name: string;
  email: string;
}

/**
 * List all files below `base` as relative paths with POSIX separators.
 * Symbolic links are followed (their targets get copied); broken links and
 * links to a directory of the current path (cycles) are skipped.
 * Entries starting with `.` are skipped unless `dotfiles` is set; entries named
 * `.git` are always skipped (git can't track them).
 */
export async function listFiles(base: string, dotfiles: boolean): Promise<string[]> {
  const files: string[] = [];
  // JavaScript implementation: the native realpath fails on some Windows volumes (e.g. RAM disks)
  const resolve = promisify(realpath);

  async function walk(relDir: string, ancestors: string[]): Promise<void> {
    const realDir = await resolve(path.join(base, relDir));
    if (ancestors.includes(realDir)) {
      return;
    }
    ancestors = [...ancestors, realDir];

    const entries = await fs.readdir(path.join(base, relDir), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || (!dotfiles && entry.name.startsWith('.'))) {
        continue;
      }
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      let stat: { isDirectory(): boolean; isFile(): boolean } = entry;
      if (entry.isSymbolicLink()) {
        try {
          stat = await fs.stat(path.join(base, relPath));
        } catch {
          continue;
        }
      }
      if (stat.isDirectory()) {
        await walk(relPath, ancestors);
      } else if (stat.isFile()) {
        files.push(relPath);
      }
    }
  }

  await walk('', []);
  return files;
}

/**
 * Copy a list of files into an empty directory (the clone has no checkout).
 *
 * Files are created as new files with mode 0666 minus umask, so git records
 * them as 100644 regardless of the source file mode. Directories are created
 * once; files are copied with limited concurrency.
 */
export async function copy(files: string[], base: string, dest: string): Promise<void> {
  const pairs = files.map((file) => {
    const src = path.resolve(base, file);
    return { src, target: path.join(dest, path.relative(base, src)) };
  });

  const dirs = [...new Set(pairs.map(({ target }) => path.dirname(target)))].sort();
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const concurrency = 16;
  let next = 0;
  async function worker(): Promise<void> {
    while (next < pairs.length) {
      const { src, target } = pairs[next++];
      await pipeline(createReadStream(src), createWriteStream(target));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pairs.length) }, worker));
}

/**
 * Read the git user of the given working directory (default: process.cwd()).
 * Resolves with null when name or email is not configured.
 */
export async function getUser(cwd = process.cwd(), cmd = 'git'): Promise<User | null> {
  try {
    const [name, email] = await Promise.all([
      new Git(cwd, cmd).exec('config', 'user.name'),
      new Git(cwd, cmd).exec('config', 'user.email')
    ]);
    return { name: name.output.trim(), email: email.output.trim() };
  } catch {
    return null;
  }
}
