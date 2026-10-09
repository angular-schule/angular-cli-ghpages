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
 * - Verify files in the clone after publish completes
 *
 * 404.html is created by the engine in dist; CNAME and .nojekyll are written
 * by publish() into its clone.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';

import { pathExists } from '../utils';

import * as ghPages from '../gh-pages-fork/lib';

describe('gh-pages-fork CNAME/.nojekyll file creation (REAL filesystem)', () => {
  let tempDir: string;
  let basePath: string;
  let bareRepoPath: string;

  // Unique ID to prevent conflicts with parallel test runs
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeEach(async () => {
    // Create a unique temp directory for this test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `gh-pages-file-test-${testRunId}-`));

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

    // Every test starts from a fresh clone
    await ghPages.clean();
  });

  afterEach(async () => {
    await ghPages.clean();
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function getCacheDir(repoPath: string): string {
    return ghPages.getCacheDir(repoPath);
  }

  describe('CNAME file creation', () => {
    it('should create CNAME file with exact domain content when cname option is set', async () => {
      const testDomain = 'test-cname.example.com';
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        message: 'Test CNAME creation',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      // Verify CNAME file was created by publish()
      const cnamePath = path.join(cacheDir, 'CNAME');
      const exists = await pathExists(cnamePath);
      expect(exists).toBe(true);

      const content = await fs.readFile(cnamePath, 'utf-8');
      expect(content).toBe(testDomain);
    });

    it('should NOT create CNAME file when cname option is not provided', async () => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        // cname NOT provided
        message: 'Test no CNAME',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      const cnamePath = path.join(cacheDir, 'CNAME');
      const exists = await pathExists(cnamePath);
      expect(exists).toBe(false);
    });
  });

  describe('.nojekyll file creation', () => {
    it('should create .nojekyll file when nojekyll option is true', async () => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: true,
        message: 'Test nojekyll creation',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      const nojekyllPath = path.join(cacheDir, '.nojekyll');
      const exists = await pathExists(nojekyllPath);
      expect(exists).toBe(true);
    });

    it('should NOT create .nojekyll file when nojekyll option is false', async () => {
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        nojekyll: false,
        message: 'Test no nojekyll',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      const nojekyllPath = path.join(cacheDir, '.nojekyll');
      const exists = await pathExists(nojekyllPath);
      expect(exists).toBe(false);
    });
  });

  describe('Both CNAME and .nojekyll together', () => {
    it('should create both files when both options are set', async () => {
      const testDomain = 'both-files.example.com';
      const cacheDir = getCacheDir(bareRepoPath);

      const options = {
        repo: bareRepoPath,
        branch: 'gh-pages',
        cname: testDomain,
        nojekyll: true,
        message: 'Test both files',
        user: { name: 'Test', email: 'test@test.com' }
      };

      await ghPages.publish(basePath, options);

      // Verify CNAME
      const cnamePath = path.join(cacheDir, 'CNAME');
      expect(await pathExists(cnamePath)).toBe(true);
      expect(await fs.readFile(cnamePath, 'utf-8')).toBe(testDomain);

      // Verify .nojekyll
      const nojekyllPath = path.join(cacheDir, '.nojekyll');
      expect(await pathExists(nojekyllPath)).toBe(true);
    });
  });
});
