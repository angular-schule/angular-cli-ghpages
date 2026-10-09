/**
 * End-to-end integration test for issue #203 — REAL git, REAL gh-pages-fork, REAL filesystem.
 *
 * `angular-cli-ghpages` must work in a directory with no `package.json` in any
 * parent — typical for `npx angular-cli-ghpages` on a repo that is just a
 * `dist/` folder. The cache directory then falls back to
 * `<os tmpdir>/angular-cli-ghpages-cache/gh-pages` (see gh-pages-fork getCacheDir()).
 *
 * Flow:
 *   1. Make a local bare repo and seed a gh-pages branch with one file.
 *   2. Create a cwd that has NO package.json in any ancestor (os.mkdtemp).
 *   3. `process.chdir()` there so engine.run() sees that cwd.
 *   4. Run engine.run().
 *   5. Assert no throw AND the new dist file lands in the remote.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';

import { logging } from '@angular-devkit/core';

import * as engine from './engine';
import * as ghPages from '../gh-pages-fork/lib';

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

    // Bare repo + seed a gh-pages branch, so clone + checkout run the existing-branch path.
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
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await ghPages.clean();
    process.env = originalEnv;
    await fs.rm(workDir, { recursive: true, force: true });
  });

  it('engine.run() succeeds and actually publishes when no package.json is reachable from cwd', async () => {
    // Only a real run proves the full chain (prepareOptions → clean() →
    // publish() → real git clone/push) in a cwd without package.json.

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

    // Positive proof that the deploy actually landed:
    const tree = git('ls-tree -r gh-pages --name-only', bareRepoPath)
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(tree).toEqual(['index.html']);

    // The clone went to the tmpdir fallback
    expect(ghPages.getCacheDir()).toBe(path.join(os.tmpdir(), 'angular-cli-ghpages-cache', 'gh-pages'));
  }, 30_000);
});
