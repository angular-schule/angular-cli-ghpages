/**
 * Runs before every spec file (vitest.config.mts setupFiles).
 *
 * Specs run real git commands; the developer's environment must not change
 * their results: no global/system git config (commit.gpgsign, global
 * gitignore, hooks), no repository, config or identity variables of a
 * surrounding git process, no tokens or CI variables that the engine would pick up.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { REPOSITORY_VARIABLES } from '../gh-pages-fork/lib/repository-variables';

const gitConfigDir = mkdtempSync(join(tmpdir(), 'angular-cli-ghpages-test-gitconfig-'));
const emptyGitConfig = join(gitConfigDir, 'gitconfig');
writeFileSync(emptyGitConfig, '');

process.env.GIT_CONFIG_GLOBAL = emptyGitConfig;
process.env.GIT_CONFIG_NOSYSTEM = '1';
// git's default ignore and attributes files live below XDG_CONFIG_HOME
process.env.XDG_CONFIG_HOME = gitConfigDir;

for (const name of [
  ...REPOSITORY_VARIABLES,
  'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT',
  'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_AUTHOR_DATE',
  'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_COMMITTER_DATE',
  'GH_TOKEN', 'PERSONAL_TOKEN', 'GITHUB_TOKEN',
  'TRAVIS', 'CIRCLECI', 'GITHUB_ACTIONS', 'CACHE_DIR'
]) {
  delete process.env[name];
}

afterAll(() => {
  rmSync(gitConfigDir, { recursive: true, force: true });
});
