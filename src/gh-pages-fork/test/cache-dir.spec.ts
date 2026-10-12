import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { getCacheDir } from '../lib';

describe('gh-pages-fork getCacheDir()', () => {
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

  it('returns undefined without $CACHE_DIR and package.json (issue #203: clones go to the os temp dir)', () => {
    process.chdir(tempDir);

    expect(getCacheDir()).toBeUndefined();
  });

  it('resolves relative to the given directory', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

    expect(getCacheDir(tempDir)).toBe(path.join(tempDir, 'node_modules', '.cache', 'gh-pages'));
  });
});
