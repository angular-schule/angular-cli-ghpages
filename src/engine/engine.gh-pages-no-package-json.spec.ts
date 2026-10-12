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

import { logging } from '@angular-devkit/core';

import { createBareRepo, seedBranch, tree } from '../test-helpers/git';
import * as engine from './engine';

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
    bareRepoPath = createBareRepo(path.join(workDir, 'bare.git'));
    await seedBranch(bareRepoPath, path.join(workDir, 'seed'), 'gh-pages', { 'old.html': '<html>old</html>' });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await fs.rm(workDir, { recursive: true, force: true });
  });

  it('engine.run() succeeds and actually publishes when no package.json is reachable from cwd', async () => {
    // Only a real run proves the full chain (prepareOptions → publish() →
    // real git clone/push) in a cwd without package.json.

    process.chdir(workDir);
    const logger = new logging.Logger('test');
    const messages: string[] = [];
    logger.subscribe((entry) => messages.push(entry.message));

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
      logger
    );

    // Positive proof that the deploy actually landed:
    expect(tree(bareRepoPath)).toEqual(['index.html']);

    // The clone went to a private directory in the os temp dir
    const cloning = messages.find((message) => message.startsWith('Cloning '));
    const cloneDir = cloning!.split(' into ')[1];
    expect(path.dirname(cloneDir)).toBe(os.tmpdir());
    expect(path.basename(cloneDir)).toMatch(/^angular-cli-ghpages-clone-/);
  }, 30_000);
});
