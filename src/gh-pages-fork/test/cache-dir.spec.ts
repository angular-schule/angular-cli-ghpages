import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { clean, getCacheDir } from '../lib';

describe('gh-pages-fork getCacheDir() / clean()', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    delete process.env.CACHE_DIR;
    tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-cache-')));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uses $CACHE_DIR when set', () => {
    process.env.CACHE_DIR = path.join(tempDir, 'custom');

    expect(getCacheDir()).toBe(path.join(tempDir, 'custom', 'gh-pages'));
  });

  it('ignores boolean-like $CACHE_DIR values', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    process.chdir(tempDir);

    for (const value of ['true', 'false', '1', '0']) {
      process.env.CACHE_DIR = value;
      expect(getCacheDir()).toBe(path.join(tempDir, 'node_modules', '.cache', 'gh-pages'));
    }
  });

  it('uses node_modules/.cache next to the closest package.json', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    const nested = path.join(tempDir, 'a', 'b');
    await fs.mkdir(nested, { recursive: true });
    process.chdir(nested);

    expect(getCacheDir()).toBe(path.join(tempDir, 'node_modules', '.cache', 'gh-pages'));
  });

  it('falls back to the os temp directory without a package.json (issue #203)', () => {
    process.chdir(tempDir);

    expect(getCacheDir()).toBe(path.join(os.tmpdir(), 'angular-cli-ghpages-cache', 'gh-pages'));
  });

  it('names the clone directory after a hash, so tokens never end up on disk', () => {
    process.env.CACHE_DIR = tempDir;
    const repo = 'https://x-access-token:secret123@github.com/user/repo.git';

    const cloneDir = getCacheDir(repo);

    expect(path.dirname(cloneDir)).toBe(path.join(tempDir, 'gh-pages'));
    expect(cloneDir).not.toContain('secret123');
    expect(getCacheDir(repo)).toBe(cloneDir);
  });

  it('clean() removes the cache directory', async () => {
    process.env.CACHE_DIR = tempDir;
    const cloneDir = getCacheDir('https://github.com/user/repo.git');
    await fs.mkdir(cloneDir, { recursive: true });

    await clean();

    await expect(fs.access(path.join(tempDir, 'gh-pages'))).rejects.toThrow();
  });
});
