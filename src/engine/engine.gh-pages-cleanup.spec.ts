/**
 * End-to-end integration test for issue #204 — REAL git, REAL gh-pages, REAL filesystem.
 *
 * No mocks. This test proves the `beforeAdd` cleanup hook actually produces a clean
 * gh-pages commit when the branch previously contained dotfiles and submodule gitlinks.
 *
 * Flow:
 *   1. Create a local bare git repo (serves as "remote").
 *   2. Seed a gh-pages branch containing:
 *        - .github/workflows/deploy.yml  (dot-directory, nested)
 *        - .gitignore                    (dotfile)
 *        - .gitmodules                   (dotfile)
 *        - a submodule gitlink `build`   (mode 160000)
 *        - stale.html                    (regular file gh-pages' own remove would catch)
 *   3. Run `engine.run()` against the bare repo with a dist containing only index.html.
 *   4. `git ls-tree -r gh-pages` on the bare repo → assert ONLY `index.html` landed.
 *
 * A companion test demonstrates the upstream bug itself by calling `gh-pages.publish()`
 * directly (bypassing our hook) and observing the leftovers leak into the commit. That
 * test will start failing once tschaub/gh-pages ships PR #612 in a release — which is
 * fine; it's the signal that our workaround can be removed.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';

import { logging } from '@angular-devkit/core';

import * as engine from './engine';
import { cleanupMonkeypatch } from './engine.prepare-options-helpers';

// NO MOCKS — we want real gh-pages behavior end-to-end
const ghPages = require('gh-pages');

interface GitOptions {
  readonly cwd: string;
}

function git(args: string, options: GitOptions): string {
  return execSync(`git -C "${options.cwd}" ${args}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

async function seedGhPagesBranch(workDir: string, bareRepoPath: string): Promise<void> {
  await fs.mkdir(workDir, { recursive: true });
  execSync(`git init "${workDir}"`, { stdio: 'pipe' });
  git('config user.email "seed@test.com"', { cwd: workDir });
  git('config user.name "Seed"', { cwd: workDir });
  git('checkout -b gh-pages', { cwd: workDir });

  // Dotfiles and dot-directory (what gh-pages' broken remove step misses)
  await fs.mkdir(path.join(workDir, '.github', 'workflows'), { recursive: true });
  await fs.writeFile(path.join(workDir, '.github', 'workflows', 'deploy.yml'), 'name: deploy\n');
  await fs.writeFile(path.join(workDir, '.gitignore'), 'node_modules\n');
  await fs.writeFile(
    path.join(workDir, '.gitmodules'),
    '[submodule "build"]\n\tpath = build\n\turl = https://example.invalid/build.git\n'
  );
  // A regular non-dot file — gh-pages' own remove step WILL catch this one.
  await fs.writeFile(path.join(workDir, 'stale.html'), '<html>stale</html>\n');

  git('add .github .gitignore .gitmodules stale.html', { cwd: workDir });
  git('commit -m "seed dotfiles and stale content"', { cwd: workDir });

  // Add a submodule gitlink without needing a real subrepo.
  // update-index --cacheinfo creates the 160000 entry directly in the index.
  const seedSha = git('rev-parse HEAD', { cwd: workDir });
  git(`update-index --add --cacheinfo 160000,${seedSha},build`, { cwd: workDir });
  git('commit -m "add submodule gitlink"', { cwd: workDir });

  git(`remote add origin "${bareRepoPath}"`, { cwd: workDir });
  git('push origin gh-pages', { cwd: workDir });
}

describe('end-to-end cleanup regression (issue #204, real git)', () => {
  let tempDir: string;
  let distDir: string;
  let bareRepoPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  // Unique suffix so parallel-ish reruns never collide in /tmp.
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  beforeEach(async () => {
    cleanupMonkeypatch();

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

    bareRepoPath = path.join(tempDir, 'bare.git');
    execSync(`git init --bare "${bareRepoPath}"`, { stdio: 'pipe' });

    await seedGhPagesBranch(path.join(tempDir, 'seed'), bareRepoPath);

    // Clear gh-pages' cache so each test starts from a clean clone.
    ghPages.clean();
  });

  afterEach(async () => {
    ghPages.clean();
    cleanupMonkeypatch();
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
        // Keep assertions simple: don't let our own 404.html / .nojekyll machinery
        // add files to the expected set.
        notfound: false,
        nojekyll: false,
        name: 'Test',
        email: 'test@test.com',
        message: 'test deploy'
      },
      new logging.NullLogger()
    );

    // Inspect what actually landed on gh-pages in the bare repo.
    const tree = git('ls-tree -r gh-pages --name-only', { cwd: bareRepoPath })
      .split('\n')
      .filter(Boolean)
      .sort();

    expect(tree).toEqual(['index.html']);

    // Explicit negative checks — makes regressions very readable on failure.
    expect(tree).not.toContain('.gitignore');
    expect(tree).not.toContain('.gitmodules');
    expect(tree).not.toContain('.github/workflows/deploy.yml');
    expect(tree).not.toContain('build');
    expect(tree).not.toContain('stale.html');
  }, 30_000);

  it('baseline: without our hook, gh-pages alone leaks dotfiles and submodule gitlinks (demonstrates the upstream bug)', async () => {
    // Call gh-pages.publish() directly — no engine.run(), no beforeAdd hook.
    // This is exactly what angular-cli-ghpages v3 did before our fix.
    await new Promise<void>((resolve, reject) => {
      ghPages.publish(
        distDir,
        {
          repo: bareRepoPath,
          branch: 'gh-pages',
          dotfiles: true,
          user: { name: 'Test', email: 'test@test.com' },
          message: 'baseline: unhooked gh-pages publish'
        },
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const tree = git('ls-tree -r gh-pages --name-only', { cwd: bareRepoPath })
      .split('\n')
      .filter(Boolean);

    // gh-pages' broken remove step missed all of these:
    expect(tree).toContain('.gitignore');
    expect(tree).toContain('.gitmodules');
    expect(tree).toContain('.github/workflows/deploy.yml');
    expect(tree).toContain('build');
    // Our dist file did land:
    expect(tree).toContain('index.html');
    // And the non-dot stale file DID get removed by gh-pages' (partial) remove step:
    expect(tree).not.toContain('stale.html');
  }, 30_000);
});
