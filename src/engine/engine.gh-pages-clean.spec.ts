/**
 * gh-pages.clean() behavior verification
 *
 * What we're testing:
 * - gh-pages.clean() actually removes cache directories
 * - This catches breaking changes if gh-pages updates its behavior
 *
 * Why maxWorkers: 1 is required:
 * gh-pages uses a globally shared cache at node_modules/.cache/gh-pages/
 * The clean() function is a nuclear option - it wipes the ENTIRE cache directory:
 *
 *   exports.clean = function clean() {
 *     fs.removeSync(getCacheDir());  // Removes ALL repo caches at once!
 *   };
 *
 * If tests run in parallel, one test's clean() call destroys caches that
 * other tests are actively using, causing random failures.
 */

import * as path from 'path';
import * as fs from 'fs/promises';

import { pathExists } from '../utils';

const ghPages = require('gh-pages');
const findCacheDir = require('find-cache-dir');
const filenamify = require('filenamify');

describe('gh-pages.clean() behavior', () => {

  it('should remove repo-specific cache directories', async () => {
    const cacheBaseDir = findCacheDir({ name: 'gh-pages' });
    if (!cacheBaseDir) {
      // Skip if no cache dir available (e.g., in some CI environments)
      console.warn('Skipping test: no gh-pages cache directory available');
      return;
    }

    // Create a fake repo-specific cache directory
    const fakeRepoUrl = 'https://github.com/test/clean-test.git';
    const repoCacheDir = path.join(cacheBaseDir, filenamify(fakeRepoUrl, { replacement: '!' }));

    // Setup: create the fake cache directory with a marker file
    await fs.mkdir(repoCacheDir, { recursive: true });
    await fs.writeFile(path.join(repoCacheDir, 'marker.txt'), 'should be deleted');
    expect(await pathExists(repoCacheDir)).toBe(true);

    // Execute clean - this removes ALL repo cache directories
    ghPages.clean();

    // Verify the directory was removed
    expect(await pathExists(repoCacheDir)).toBe(false);
  });

  it('should not throw when cache directory does not exist', () => {
    // clean() should be safe to call even if nothing to clean
    expect(() => ghPages.clean()).not.toThrow();
  });
});
