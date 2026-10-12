/**
 * Helper functions for prepareOptions
 *
 * These functions handle the various transformations and validations
 * that prepareOptions performs on deployment options.
 */

import { logging } from '@angular-devkit/core';

import { Schema } from '../deploy/schema';
import { getRepo } from '../gh-pages-fork/lib';

/**
 * Type for options with the three boolean flags that prepareOptions adds,
 * plus the optional user object created from name + email
 */
export type PreparedOptions = Schema & {
  dotfiles: boolean;
  notfound: boolean;
  nojekyll: boolean;
  git?: string;
  user?: { name: string; email: string };
};

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
 * Warn if deprecated parameters are used: `noSilent` from ng deploy (the schema
 * has no default, so it is only set when passed), `silent: false` from the
 * standalone CLI's `--no-silent` flag.
 */
export function warnDeprecatedParameters(origOptions: Schema & { silent?: boolean }, logger: logging.LoggerApi): void {
  if (origOptions.noSilent !== undefined || origOptions.silent === false) {
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
      'Triggered by commit: ' +
      (process.env.GITHUB_SERVER_URL || 'https://github.com') +
      '/' +
      (process.env.GITHUB_REPOSITORY || '') +
      '/commit/' +
      (process.env.GITHUB_SHA || '') +
      '\n' +
      'GitHub Actions build: ' +
      (process.env.GITHUB_SERVER_URL || 'https://github.com') +
      '/' +
      (process.env.GITHUB_REPOSITORY || '') +
      '/actions/runs/' +
      (process.env.GITHUB_RUN_ID || '');
  }
}

/**
 * Inject authentication token into repository URL
 *
 * Supports GH_TOKEN, PERSONAL_TOKEN, and GITHUB_TOKEN environment variables.
 * Also handles legacy GH_TOKEN placeholder replacement for backwards compatibility.
 */
export async function injectTokenIntoRepoUrl(options: PreparedOptions): Promise<void> {
  // Discover the remote URL when --repo isn't set, so tokens from the environment
  // are injected into it as well
  if (!options.repo) {
    options.repo = await getRepo({ git: options.git, remote: options.remote });
  }

  // --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git gets the token
  // in place of the placeholder; CI configurations use this to inject other tokens, too
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
