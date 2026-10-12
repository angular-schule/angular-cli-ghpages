/**
 * End-to-end integration test for issue #204 — REAL git, REAL gh-pages-fork, REAL filesystem.
 *
 * No mocks. This test proves that a deploy produces a clean gh-pages commit
 * when the branch previously contained dotfiles and submodule gitlinks.
 *
 * Flow:
 *   1. Create a local bare git repo (serves as "remote").
 *   2. Seed a gh-pages branch containing:
 *        - .github/workflows/deploy.yml  (dot-directory, nested)
 *        - .gitignore                    (dotfile)
 *        - .gitmodules                   (dotfile)
 *        - a submodule gitlink `build`   (mode 160000)
 *        - stale.html                    (regular stale file)
 *   3. Run `engine.run()` against the bare repo with a dist containing only index.html.
 *   4. `git ls-tree -r gh-pages` on the bare repo → assert ONLY `index.html` landed.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import { logging } from '@angular-devkit/core';

import { createBareRepo, git, seedBranch, tree } from '../test-helpers/git';
import * as engine from './engine';

function seedGhPagesBranch(workDir: string, bareRepoPath: string): Promise<void> {
  return seedBranch(bareRepoPath, workDir, 'gh-pages', {
    // Dotfiles and dot-directory
    '.github/workflows/deploy.yml': 'name: deploy\n',
    '.gitignore': 'node_modules\n',
    '.gitmodules': '[submodule "build"]\n\tpath = build\n\turl = https://example.invalid/build.git\n',
    // A regular non-dot file
    'stale.html': '<html>stale</html>\n'
  }, ['build']);
}

describe('end-to-end cleanup regression (issue #204, real git)', () => {
  let tempDir: string;
  let distDir: string;
  let bareRepoPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  // Unique suffix so parallel-ish reruns never collide in /tmp.
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeEach(async () => {
    // Isolate from ambient CI envs and tokens so engine.prepareOptions doesn't
    // rewrite the repo URL or append CI metadata during tests.
    originalEnv = { ...process.env };
    delete process.env.TRAVIS;
    delete process.env.CIRCLECI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GH_TOKEN;
    delete process.env.PERSONAL_TOKEN;
    delete process.env.GITHUB_TOKEN;

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `ghp-204-${testRunId}-`));

    distDir = path.join(tempDir, 'dist');
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(path.join(distDir, 'index.html'), '<html>fresh dist</html>\n');

    bareRepoPath = createBareRepo(path.join(tempDir, 'bare.git'));

    await seedGhPagesBranch(path.join(tempDir, 'seed'), bareRepoPath);

    process.env.CACHE_DIR = path.join(tempDir, 'cache');
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('engine.run() produces a gh-pages commit containing ONLY dist files (no dotfiles, no submodule)', async () => {
    await engine.run(
      distDir,
      {
        repo: bareRepoPath,
        branch: 'gh-pages',
        dotfiles: true,
        // Keep assertions simple: no 404.html / .nojekyll in the expected set.
        notfound: false,
        nojekyll: false,
        name: 'Test',
        email: 'test@test.com',
        message: 'test deploy'
      },
      new logging.NullLogger()
    );

    // Inspect what actually landed on gh-pages in the bare repo.
    const files = tree(bareRepoPath);

    expect(files).toEqual(['index.html']);

    // Explicit negative checks — makes regressions very readable on failure.
    expect(files).not.toContain('.gitignore');
    expect(files).not.toContain('.gitmodules');
    expect(files).not.toContain('.github/workflows/deploy.yml');
    expect(files).not.toContain('build');
    expect(files).not.toContain('stale.html');
  }, 30_000);

  it('keeps .nojekyll and CNAME on a redeploy', async () => {
    const deploy = () => engine.run(
      distDir,
      {
        repo: bareRepoPath,
        branch: 'gh-pages',
        dotfiles: true,
        notfound: false,
        nojekyll: true,
        cname: 'example.org',
        name: 'Test',
        email: 'test@test.com',
        message: 'test deploy'
      },
      new logging.NullLogger()
    );

    await deploy();
    await fs.writeFile(path.join(distDir, 'index.html'), '<html>second deploy</html>\n');
    await deploy();

    const files = tree(bareRepoPath);

    expect(files).toEqual(['.nojekyll', 'CNAME', 'index.html']);
    expect(git(bareRepoPath, 'show', 'gh-pages:CNAME')).toBe('example.org');
  }, 30_000);

  it('removes a leftover .nojekyll when nojekyll is disabled', async () => {
    const deploy = (nojekyll: boolean) => engine.run(
      distDir,
      {
        repo: bareRepoPath,
        branch: 'gh-pages',
        dotfiles: true,
        notfound: false,
        nojekyll,
        name: 'Test',
        email: 'test@test.com',
        message: 'test deploy'
      },
      new logging.NullLogger()
    );

    await deploy(true);
    await deploy(false);

    const files = tree(bareRepoPath);

    expect(files).toEqual(['index.html']);
  }, 30_000);
});
