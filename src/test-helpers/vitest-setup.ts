/**
 * Runs before every spec file (vitest.config.mts setupFiles).
 *
 * Specs run real git commands; the developer's environment must not change
 * their results: no global/system git config (commit.gpgsign, global
 * gitignore, hooks), no repository variables of a surrounding git process,
 * no tokens or CI variables that the engine would pick up.
 */

import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const emptyGitConfig = join(mkdtempSync(join(tmpdir(), 'angular-cli-ghpages-test-gitconfig-')), 'gitconfig');
writeFileSync(emptyGitConfig, '');

process.env.GIT_CONFIG_GLOBAL = emptyGitConfig;
process.env.GIT_CONFIG_NOSYSTEM = '1';

for (const name of [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR',
  'GH_TOKEN', 'PERSONAL_TOKEN', 'GITHUB_TOKEN',
  'TRAVIS', 'CIRCLECI', 'GITHUB_ACTIONS', 'CACHE_DIR'
]) {
  delete process.env[name];
}
