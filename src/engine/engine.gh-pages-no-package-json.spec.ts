/**
 * End-to-end integration test for issue #203 — REAL git, REAL gh-pages, REAL filesystem.
 *
 * Reproduces the original failure ("path argument must be of type string ... Received
 * undefined") that happens when `angular-cli-ghpages` runs in a directory with no
 * `package.json` in any parent — typical for `npx angular-cli-ghpages` on a repo
 * that is just a `dist/` folder.
 *
 * Root cause: gh-pages@6.3.0 uses `find-cache-dir` to determine where to clone.
 * `find-cache-dir` walks up looking for `package.json`; if it finds none, it
 * returns `undefined`, and gh-pages then does `path.join(undefined, ...)`.
 *
 * Fix: engine.run() calls `ensureGhPagesCacheDir()` before loading gh-pages,
 * which sets `CACHE_DIR` to an os.tmpdir() fallback when no `package.json` is
 * reachable. `find-cache-dir` honors `CACHE_DIR` as an explicit override.
 *
 * Flow:
 *   1. Make a local bare repo and seed a gh-pages branch with one file.
 *   2. Create a cwd that has NO package.json in any ancestor (os.mkdtemp).
 *   3. `process.chdir()` there so engine.run() / gh-pages see that cwd.
 *   4. Run engine.run().
 *   5. Assert no throw AND the new dist file lands in the remote.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';

import { logging } from '@angular-devkit/core';

import * as engine from './engine';
import { cleanupMonkeypatch } from './engine.prepare-options-helpers';

// NO MOCKS — we want real gh-pages behavior end-to-end.
const ghPages = require('gh-pages');

function git(args: string, cwd: string): string {
  return execSync(`git -C "${cwd}" ${args}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

describe('engine.run() in a directory with no package.json (issue #203)', () => {
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let workDir: string;       // Outside any package.json tree; becomes cwd.
  let bareRepoPath: string;
  let distDir: string;

  beforeEach(async () => {
    cleanupMonkeypatch();
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    delete process.env.CACHE_DIR;
    delete process.env.TRAVIS;
    delete process.env.CIRCLECI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GH_TOKEN;
    delete process.env.PERSONAL_TOKEN;
    delete process.env.GITHUB_TOKEN;

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ghp-203-e2e-'));

    // Dist with just index.html. Note: no package.json is ever created in workDir.
    distDir = path.join(workDir, 'dist');
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(path.join(distDir, 'index.html'), '<html>fresh</html>\n');

    // Bare repo + seed a gh-pages branch so gh-pages' clone + checkout succeed.
    bareRepoPath = path.join(workDir, 'bare.git');
    execSync(`git init --bare "${bareRepoPath}"`, { stdio: 'pipe' });

    const seedDir = path.join(workDir, 'seed');
    await fs.mkdir(seedDir, { recursive: true });
    execSync(`git init "${seedDir}"`, { stdio: 'pipe' });
    git('config user.email "seed@test.com"', seedDir);
    git('config user.name "Seed"', seedDir);
    git('checkout -b gh-pages', seedDir);
    await fs.writeFile(path.join(seedDir, 'old.html'), '<html>old</html>');
    git('add .', seedDir);
    git('commit -m "seed"', seedDir);
    git(`remote add origin "${bareRepoPath}"`, seedDir);
    git('push origin gh-pages', seedDir);

    ghPages.clean();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    ghPages.clean();
    cleanupMonkeypatch();
    await fs.rm(workDir, { recursive: true, force: true });
  });

  it('engine.run() succeeds and actually publishes when no package.json is reachable from cwd', async () => {
    // This test exists because spawn-mock or unit coverage cannot prove the
    // full chain (prepareOptions → ensureGhPagesCacheDir → require("gh-pages")
    // → gh-pages.clean() → gh-pages.publish() → real git clone/push). Only a
    // real run can.

    process.chdir(workDir);

    await engine.run(
      distDir,
      {
        repo: bareRepoPath,
        branch: 'gh-pages',
        dotfiles: true,
        notfound: false,
        nojekyll: false,
        name: 'Test',
        email: 'test@test.com',
        message: 'test deploy (no package.json)'
      },
      new logging.NullLogger()
    );

    // Would-have-been-the-bug: if ensureGhPagesCacheDir didn't run or failed,
    // gh-pages.clean() / publish() would have thrown the "path ... Received
    // undefined" TypeError before reaching here.

    // Positive proof that the deploy actually landed:
    const tree = git('ls-tree -r gh-pages --name-only', bareRepoPath)
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(tree).toEqual(['index.html']);

    // And CACHE_DIR was set to our tmpdir fallback (not some boolean-ish or empty).
    expect(process.env.CACHE_DIR).toBe(path.join(os.tmpdir(), 'angular-cli-ghpages-cache'));
  }, 30_000);

  it('baseline: bare gh-pages.clean() in a no-package-json cwd throws the #203 error (fresh child process)', () => {
    // Run in a separate Node process so there is no shared require.cache / env
    // pollution from the primary test. This proves the upstream bug is real —
    // NOT a mock story.
    const ghPagesPath = require.resolve('gh-pages');
    const script =
      `process.chdir(${JSON.stringify(workDir)});` +
      `const ghPages = require(${JSON.stringify(ghPagesPath)});` +
      `try { ghPages.clean(); console.log('NOTHROW'); process.exit(1); }` +
      `catch (e) { process.stdout.write(String(e && e.message)); process.exit(0); }`;

    // Explicitly unset CACHE_DIR in the child's env so find-cache-dir must
    // fall back to the package.json walk (which finds nothing here).
    const childEnv = { ...process.env };
    delete childEnv.CACHE_DIR;

    const out = execSync(`node -e ${JSON.stringify(script)}`, {
      cwd: workDir,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();

    expect(out).toMatch(/must be of type string|Received undefined/);
  }, 10_000);
});
