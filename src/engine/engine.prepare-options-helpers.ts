/**
 * Helper functions for prepareOptions
 *
 * These functions handle the various transformations and validations
 * that prepareOptions performs on deployment options.
 */

import { logging } from '@angular-devkit/core';
import * as util from 'util';

import { Schema } from '../deploy/schema';
// Internal API dependency - by design. See getRemoteUrl() JSDoc for rationale and fallback options.
import Git from 'gh-pages/lib/git';

/**
 * Type for options with the three boolean flags that prepareOptions adds,
 * plus the optional user object created from name + email
 */
export type PreparedOptions = Schema & {
  dotfiles: boolean;
  notfound: boolean;
  nojekyll: boolean;
  user?: { name: string; email: string };
};

// Store original debuglog for cleanup (using CommonJS require for mutable access)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utilMutable = require('util');
let originalDebuglog: typeof util.debuglog | null = null;

/**
 * Setup monkeypatch for util.debuglog to intercept gh-pages logging
 *
 * gh-pages uses util.debuglog('gh-pages') internally for all verbose logging.
 * We intercept it and forward to Angular logger instead of stderr.
 *
 * CRITICAL: This must be called BEFORE requiring gh-pages, otherwise gh-pages
 * will cache the original util.debuglog and our interception won't work.
 *
 * NOTE: We use require('util') instead of ES import because ES module namespace
 * objects are read-only. CommonJS require returns a mutable object that we can patch.
 */
export function setupMonkeypatch(logger: logging.LoggerApi): void {
  // Guard against multiple calls - only patch once
  // If we're already patched, just return (prevents stack overflow from recursive calls)
  if (originalDebuglog !== null) {
    return;
  }

  originalDebuglog = utilMutable.debuglog;

  utilMutable.debuglog = (set: string) => {
    // gh-pages uses util.debuglog('gh-pages') internally for all verbose logging
    // Intercept it and forward to Angular logger instead of stderr
    if (set === 'gh-pages') {
      return function (...args: unknown[]) {
        const message = util.format.apply(util, args);
        logger.info(message);
      };
    }
    return originalDebuglog!(set);
  };
}

/**
 * Cleanup monkeypatch - restore original util.debuglog
 * Exported for testing
 */
export function cleanupMonkeypatch(): void {
  if (originalDebuglog) {
    utilMutable.debuglog = originalDebuglog;
    originalDebuglog = null;
  }
}

/**
 * Map negated boolean options to positive boolean options
 *
 * Angular-CLI is NOT renaming the vars, so noDotfiles, noNotfound, and noNojekyll
 * come in with no change. We map this to dotfiles, notfound, nojekyll to have a
 * consistent pattern between Commander and Angular-CLI.
 */
export function mapNegatedBooleans(
  options: PreparedOptions,
  origOptions: Schema
): void {
  if (origOptions.noDotfiles !== undefined) {
    options.dotfiles = !origOptions.noDotfiles;
  }
  if (origOptions.noNotfound !== undefined) {
    options.notfound = !origOptions.noNotfound;
  }
  if (origOptions.noNojekyll !== undefined) {
    options.nojekyll = !origOptions.noNojekyll;
  }
}

/**
 * Handle user credentials - create user object or warn if only one is set
 */
export function handleUserCredentials(
  options: PreparedOptions,
  origOptions: Schema,
  logger: logging.LoggerApi
): void {
  if (options.name && options.email) {
    options.user = {
      name: options.name,
      email: options.email
    };
  } else if (options.name || options.email) {
    logger.warn(
      'WARNING: Both --name and --email must be set together to configure git user. ' +
      (options.name ? 'Only --name is set.' : 'Only --email is set.') +
      ' Git will use the local or global git config instead.'
    );
  }
}

/**
 * Warn if deprecated parameters are used
 */
export function warnDeprecatedParameters(origOptions: Schema, logger: logging.LoggerApi): void {
  if (origOptions.noSilent !== undefined) {
    logger.warn(
      'The --no-silent parameter is deprecated and no longer needed. ' +
      'Verbose logging is now always enabled. This parameter will be ignored.'
    );
  }
}

/**
 * Append CI environment metadata to commit message
 */
export function appendCIMetadata(options: PreparedOptions): void {
  if (process.env.TRAVIS) {
    options.message +=
      ' -- ' +
      (process.env.TRAVIS_COMMIT_MESSAGE || '') +
      ' \n\n' +
      'Triggered by commit: https://github.com/' +
      (process.env.TRAVIS_REPO_SLUG || '') +
      '/commit/' +
      (process.env.TRAVIS_COMMIT || '') +
      '\n' +
      'Travis CI build: ' +
      (process.env.TRAVIS_BUILD_WEB_URL || '');
  }

  if (process.env.CIRCLECI) {
    options.message +=
      '\n\n' +
      'Triggered by commit: https://github.com/' +
      (process.env.CIRCLE_PROJECT_USERNAME || '') +
      '/' +
      (process.env.CIRCLE_PROJECT_REPONAME || '') +
      '/commit/' +
      (process.env.CIRCLE_SHA1 || '') +
      '\n' +
      'CircleCI build: ' +
      (process.env.CIRCLE_BUILD_URL || '');
  }

  if (process.env.GITHUB_ACTIONS) {
    options.message +=
      '\n\n' +
      'Triggered by commit: https://github.com/' +
      (process.env.GITHUB_REPOSITORY || '') +
      '/commit/' +
      (process.env.GITHUB_SHA || '');
  }
}

/**
 * Inject authentication token into repository URL
 *
 * Supports GH_TOKEN, PERSONAL_TOKEN, and GITHUB_TOKEN environment variables.
 * Also handles legacy GH_TOKEN placeholder replacement for backwards compatibility.
 */
export async function injectTokenIntoRepoUrl(options: PreparedOptions): Promise<void> {
  // NEW in 0.6.2: always discover remote URL (if not set)
  // this allows us to inject tokens from environment even if `--repo` is not set manually
  if (!options.repo) {
    options.repo = await getRemoteUrl(options);
  }

  // for backwards compatibility only,
  // in the past --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git was advised
  //
  // this replacement was also used to inject other tokens into the URL,
  // so it should only be removed with the next major version
  if (
    process.env.GH_TOKEN &&
    options.repo &&
    options.repo.includes('GH_TOKEN')
  ) {
    options.repo = options.repo.replace('GH_TOKEN', process.env.GH_TOKEN);
  }
  // preferred way: token is replaced from plain URL
  // Note: Only the first available token is used (GH_TOKEN > PERSONAL_TOKEN > GITHUB_TOKEN)
  else if (options.repo && !options.repo.includes('x-access-token:')) {
    if (process.env.GH_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.GH_TOKEN}@github.com/`
      );
    } else if (process.env.PERSONAL_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.PERSONAL_TOKEN}@github.com/`
      );
    } else if (process.env.GITHUB_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`
      );
    }
  }
}

/**
 * Get the remote URL from the git repository
 *
 * ⚠️  WARNING: This uses gh-pages internal API (gh-pages/lib/git)
 *
 * UPGRADE RISK:
 * - This function depends on gh-pages/lib/git which is an internal module
 * - Not part of gh-pages public API - could break in any version
 * - When upgrading gh-pages, verify this still works:
 *   1. Check if gh-pages/lib/git still exists
 *   2. Check if Git class constructor signature is unchanged
 *   3. Check if getRemoteUrl() method still exists and works
 *
 * FALLBACK OPTIONS if this breaks:
 * - Option 1: Shell out to `git config --get remote.origin.url` directly
 * - Option 2: Use a dedicated git library (simple-git, nodegit)
 * - Option 3: Require users to always pass --repo explicitly
 *
 * IMPORTANT: This function expects options.remote to be set (our defaults provide 'origin')
 * It should NOT be called with undefined remote, as gh-pages will convert it to string "undefined"
 *
 * Exported for testing - internal use only
 */
export async function getRemoteUrl(options: Schema & { git?: string; remote?: string }): Promise<string> {
  // process.cwd() returns the directory from which ng deploy was invoked.
  // This is the expected behavior - users run ng deploy from their project root.
  const git = new Git(process.cwd(), options.git);
  return await git.getRemoteUrl(options.remote);
}
