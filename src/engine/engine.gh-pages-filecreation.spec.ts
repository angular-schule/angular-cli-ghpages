/**
 * gh-pages-fork file creation tests (REAL filesystem with local git repo)
 *
 * These tests verify that publish() ACTUALLY creates CNAME and .nojekyll files
 * on the REAL filesystem when the options are passed.
 *
 * IMPORTANT: These tests do NOT mock child_process or fs.
 *
 * Approach:
 * - Create a local bare git repository for each test
 * - publish() clones from and pushes to the local repo (no network required)
 * - Verify the files on the pushed gh-pages branch
 *
 * 404.html is created by the engine in dist; CNAME and .nojekyll are written
 * by publish() into its clone.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';


import * as ghPages from '../gh-pages-fork/lib';

describe('gh-pages-fork CNAME/.nojekyll file creation (REAL filesystem)', () => {
  let tempDir: string;
  let basePath: string;
  let bareRepoPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  // Unique ID to prevent conflicts with parallel test runs
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeEach(async () => {
    // Create a unique temp directory for this test, including the clone cache
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `gh-pages-file-test-${testRunId}-`));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');

    // Create source directory with minimal files
    basePath = path.join(tempDir, 'dist');
    await fs.mkdir(basePath, { recursive: true });
    await fs.writeFile(path.join(basePath, 'index.html'), '<html>test</html>');

    // Create a local bare git repository that gh-pages can clone from
    bareRepoPath = path.join(tempDir, 'bare-repo.git');
    execSync(`git init --bare "${bareRepoPath}"`, { stdio: 'pipe' });

    // Initialize the gh-pages branch in the bare repo with an initial commit
    const initWorkDir = path.join(tempDir, 'init-work');
    await fs.mkdir(initWorkDir, { recursive: true });
    execSync(`git init "${initWorkDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" config user.email "test@test.com"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" config user.name "Test"`, { stdio: 'pipe' });
    await fs.writeFile(path.join(initWorkDir, 'README.md'), 'init');
    execSync(`git -C "${initWorkDir}" add .`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" commit -m "init"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" branch gh-pages`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" remote add origin "${bareRepoPath}"`, { stdio: 'pipe' });
    execSync(`git -C "${initWorkDir}" push -u origin gh-pages`, { stdio: 'pipe' });
  });

  afterEach(async () => {
    process.env = originalEnv;
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Content of a file on the pushed gh-pages branch, or null if it doesn't exist
   */
  function readPublished(file: string): string | null {
    try {
      return execSync(`git --git-dir="${bareRepoPath}" show gh-pages:${file}`, { stdio: 'pipe' }).toString();
    } catch {
      return null;
    }
  }

  describe('CNAME file creation', () => {
    it('should create CNAME file with exact domain content when cname option is set', async () => {
      const testDomain = 'test-cname.example.com';

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        message: 'Test CNAME creation',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      // Verify CNAME file was created by publish()
      expect(readPublished('CNAME')).toBe(testDomain);
    });

    it('should NOT create CNAME file when cname option is not provided', async () => {

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        // cname NOT provided
        message: 'Test no CNAME',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      expect(readPublished('CNAME')).toBeNull();
    });
  });

  describe('.nojekyll file creation', () => {
    it('should create .nojekyll file when nojekyll option is true', async () => {

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: true,
        message: 'Test nojekyll creation',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      expect(readPublished('.nojekyll')).toBe('');
    });

    it('should NOT create .nojekyll file when nojekyll option is false', async () => {

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: false,
        message: 'Test no nojekyll',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      expect(readPublished('.nojekyll')).toBeNull();
    });
  });

  describe('Both CNAME and .nojekyll together', () => {
    it('should create both files when both options are set', async () => {
      const testDomain = 'both-files.example.com';

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        nojekyll: true,
        message: 'Test both files',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      expect(readPublished('CNAME')).toBe(testDomain);
      expect(readPublished('.nojekyll')).toBe('');
    });
  });
});
