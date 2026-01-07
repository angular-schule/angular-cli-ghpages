/**
 * gh-pages v6+ file creation tests (REAL filesystem with local git repo)
 *
 * These tests verify that gh-pages ACTUALLY creates CNAME and .nojekyll files
 * on the REAL filesystem when the options are passed.
 *
 * IMPORTANT: These tests do NOT mock child_process or fs.
 * This ensures we test the actual gh-pages behavior, not mocked behavior.
 *
 * Approach:
 * - Create a local bare git repository for each test
 * - gh-pages clones from the local repo (no network required)
 * - Use beforeAdd callback to verify files before git add
 * - Abort before push to avoid side effects
 *
 * Why this matters:
 * - We delegated CNAME/.nojekyll creation from angular-cli-ghpages to gh-pages v6+
 * - We must verify gh-pages actually creates these files
 * - Unlike 404.html (which we still create ourselves), these files are gh-pages' responsibility
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { execSync } from 'child_process';

// NO MOCKS - we want real gh-pages behavior
const ghPages = require('gh-pages');
const filenamify = require('filenamify');

describe('gh-pages v6+ CNAME/.nojekyll file creation (REAL filesystem)', () => {
  let tempDir: string;
  let basePath: string;
  let bareRepoPath: string;
  let cacheBaseDir: string;

  // Unique ID to prevent conflicts with parallel test runs
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeAll(async () => {
    // Get the cache directory that gh-pages will use
    const findCacheDir = require('find-cache-dir');
    cacheBaseDir = findCacheDir({ name: 'gh-pages' });
  });

  beforeEach(async () => {
    // Create a unique temp directory for this test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `gh-pages-file-test-${testRunId}-`));

    // Create source directory with minimal files
    basePath = path.join(tempDir, 'dist');
    await fs.ensureDir(basePath);
    await fs.writeFile(path.join(basePath, 'index.html'), '<html>test</html>');

    // Create a local bare git repository that gh-pages can clone from
    bareRepoPath = path.join(tempDir, 'bare-repo.git');
    execSync(`git init --bare "${bareRepoPath}"`, { stdio: 'pipe' });

    // Initialize gh-pages branch in the bare repo
    // gh-pages needs the branch to exist, so we create it with an initial commit
    const initWorkDir = path.join(tempDir, 'init-work');
    await fs.ensureDir(initWorkDir);
    execSync(`git init "${initWorkDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" config user.email "test@test.com"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" config user.name "Test"`, { stdio: 'pipe' });
    await fs.writeFile(path.join(initWorkDir, 'README.md'), 'init');
    execSync(`git -C "${initWorkDir}" add .`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" commit -m "init"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" branch gh-pages`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" remote add origin "${bareRepoPath}"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" push -u origin gh-pages`, { stdio: 'pipe' });

    // Clean gh-pages cache before each test
    ghPages.clean();
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.remove(tempDir);
    // Clean gh-pages cache after each test
    ghPages.clean();
  });

  /**
   * Helper to get the cache directory path for a repo URL
   * gh-pages uses filenamify to convert repo URL to directory name
   */
  function getCacheDir(repoPath: string): string {
    return path.join(cacheBaseDir, filenamify(repoPath, { replacement: '!' }));
  }

  describe('CNAME file creation', () => {
    it('should create CNAME file with exact domain content when cname option is set', (done) => {
      const testDomain = 'test-cname.example.com';
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        message: 'Test CNAME creation',
        user: { name: 'Test', email: 'test@test.com' },
        // beforeAdd callback runs AFTER files are created but BEFORE git add
        beforeAdd: async () => {
          // CRITICAL: Verify CNAME file was created by gh-pages
          const cnamePath = path.join(cacheDir, 'CNAME');

          // Check file exists
          const exists = await fs.pathExists(cnamePath);
          expect(exists).toBe(true);

          // Check file has correct content
          const content = await fs.readFile(cnamePath, 'utf-8');
          expect(content).toBe(testDomain);

          // Throw to abort publish (we don't want to actually push)
          throw new Error('ABORT_TEST_SUCCESS');
        }
      };

      ghPages.publish(basePath, options, (err: Error | null) => {
        // We expect an error because we threw in beforeAdd
        if (err && err.message === 'ABORT_TEST_SUCCESS') {
          done(); // Test passed - file was created correctly
        } else if (err) {
          done(err); // Unexpected error
        } else {
          done(new Error('Expected beforeAdd to abort, but publish succeeded'));
        }
      });
    }, 30000); // 30 second timeout for git operations

    it('should NOT create CNAME file when cname option is not provided', (done) => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        // cname NOT provided
        message: 'Test no CNAME',
        user: { name: 'Test', email: 'test@test.com' },
        beforeAdd: async () => {
          const cnamePath = path.join(cacheDir, 'CNAME');
          const exists = await fs.pathExists(cnamePath);
          expect(exists).toBe(false);
          throw new Error('ABORT_TEST_SUCCESS');
        }
      };

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err && err.message === 'ABORT_TEST_SUCCESS') {
          done();
        } else if (err) {
          done(err);
        } else {
          done(new Error('Expected beforeAdd to abort'));
        }
      });
    }, 30000);
  });

  describe('.nojekyll file creation', () => {
    it('should create .nojekyll file when nojekyll option is true', (done) => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: true,
        message: 'Test nojekyll creation',
        user: { name: 'Test', email: 'test@test.com' },
        beforeAdd: async () => {
          const nojekyllPath = path.join(cacheDir, '.nojekyll');
          const exists = await fs.pathExists(nojekyllPath);
          expect(exists).toBe(true);
          throw new Error('ABORT_TEST_SUCCESS');
        }
      };

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err && err.message === 'ABORT_TEST_SUCCESS') {
          done();
        } else if (err) {
          done(err);
        } else {
          done(new Error('Expected beforeAdd to abort'));
        }
      });
    }, 30000);

    it('should NOT create .nojekyll file when nojekyll option is false', (done) => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: false,
        message: 'Test no nojekyll',
        user: { name: 'Test', email: 'test@test.com' },
        beforeAdd: async () => {
          const nojekyllPath = path.join(cacheDir, '.nojekyll');
          const exists = await fs.pathExists(nojekyllPath);
          expect(exists).toBe(false);
          throw new Error('ABORT_TEST_SUCCESS');
        }
      };

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err && err.message === 'ABORT_TEST_SUCCESS') {
          done();
        } else if (err) {
          done(err);
        } else {
          done(new Error('Expected beforeAdd to abort'));
        }
      });
    }, 30000);
  });

  describe('Both CNAME and .nojekyll together', () => {
    it('should create both files when both options are set', (done) => {
      const testDomain = 'both-files.example.com';
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        nojekyll: true,
        message: 'Test both files',
        user: { name: 'Test', email: 'test@test.com' },
        beforeAdd: async () => {
          // Verify CNAME
          const cnamePath = path.join(cacheDir, 'CNAME');
          expect(await fs.pathExists(cnamePath)).toBe(true);
          expect(await fs.readFile(cnamePath, 'utf-8')).toBe(testDomain);

          // Verify .nojekyll
          const nojekyllPath = path.join(cacheDir, '.nojekyll');
          expect(await fs.pathExists(nojekyllPath)).toBe(true);

          throw new Error('ABORT_TEST_SUCCESS');
        }
      };

      ghPages.publish(basePath, options, (err: Error | null) => {
        if (err && err.message === 'ABORT_TEST_SUCCESS') {
          done();
        } else if (err) {
          done(err);
        } else {
          done(new Error('Expected beforeAdd to abort'));
        }
      });
    }, 30000);
  });
});
