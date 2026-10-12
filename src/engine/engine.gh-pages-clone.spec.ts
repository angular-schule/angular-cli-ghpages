/**
 * Removal of the temporary clone (REAL git, REAL filesystem)
 *
 * What we're testing:
 * - publish() clones into a fresh directory below the cache directory
 * - that directory is removed after a successful AND after a failed deploy,
 *   so no clone (with a token in .git/config) stays on disk and concurrent
 *   deploys never share a clone
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import * as ghPages from '../gh-pages-fork/lib';

describe('gh-pages-fork temporary clone', () => {
  let tempDir: string;
  let cacheDir: string;
  let basePath: string;
  let bareRepoPath: string;
  let originalEnv: NodeJS.ProcessEnv;
  const user = { name: 'Test', email: 'test@test.com' };

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-clone-test-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');
    cacheDir = ghPages.getCacheDir();

    basePath = path.join(tempDir, 'dist');
    await fs.mkdir(basePath);
    await fs.writeFile(path.join(basePath, 'index.html'), '<html>test</html>');

    bareRepoPath = path.join(tempDir, 'bare-repo.git');
    execSync(`git init --bare "${bareRepoPath}"`, { stdio: 'pipe' });
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should clone below the cache directory', async () => {
    const messages: string[] = [];

    await ghPages.publish(basePath, { repo: bareRepoPath, user }, (message) => messages.push(message));

    const cloning = messages.find((message) => message.startsWith('Cloning '));
    const target = cloning!.split(' into ')[1];
    expect(path.dirname(target)).toBe(cacheDir);
    expect(path.basename(target)).toMatch(/^clone-/);
  });

  it('should remove the clone after a successful deploy', async () => {
    await ghPages.publish(basePath, { repo: bareRepoPath, user });

    expect(await fs.readdir(cacheDir)).toEqual([]);
  });

  it('should remove the clone after a failed deploy', async () => {
    const hook = path.join(bareRepoPath, 'hooks', 'pre-receive');
    await fs.writeFile(hook, '#!/bin/sh\nexit 1\n');
    await fs.chmod(hook, 0o755);

    await expect(ghPages.publish(basePath, { repo: bareRepoPath, user })).rejects.toThrow();

    expect(await fs.readdir(cacheDir)).toEqual([]);
  });
});
