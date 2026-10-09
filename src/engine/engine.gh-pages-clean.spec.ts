/**
 * gh-pages-fork clean() behavior verification
 *
 * What we're testing:
 * - clean() actually removes cache directories
 *
 * Why test files run serially (see vitest.config.mts):
 * The cache at node_modules/.cache/gh-pages/ is shared by all repositories.
 * clean() wipes the ENTIRE cache directory, so a parallel test file could
 * lose a clone it is actively using.
 */

import * as path from 'path';
import * as fs from 'fs/promises';

import { pathExists } from '../utils';

import * as ghPages from '../gh-pages-fork/lib';

describe('gh-pages-fork clean() behavior', () => {

  it('should remove repo-specific cache directories', async () => {
    // Create a fake repo-specific cache directory
    const fakeRepoUrl = 'https://github.com/test/clean-test.git';
    const repoCacheDir = ghPages.getCacheDir(fakeRepoUrl);

    // Setup: create the fake cache directory with a marker file
    await fs.mkdir(repoCacheDir, { recursive: true });
    await fs.writeFile(path.join(repoCacheDir, 'marker.txt'), 'should be deleted');
    expect(await pathExists(repoCacheDir)).toBe(true);

    // Execute clean - this removes ALL repo cache directories
    await ghPages.clean();

    // Verify the directory was removed
    expect(await pathExists(repoCacheDir)).toBe(false);
  });

  it('should not throw when cache directory does not exist', async () => {
    // clean() should be safe to call even if nothing to clean
    await ghPages.clean();
    await expect(ghPages.clean()).resolves.toBeUndefined();
  });
});
