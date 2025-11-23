import {logging} from '@angular-devkit/core';
import * as fse from 'fs-extra';
import * as path from 'path';

import {Schema} from '../deploy/schema';
import {GHPages} from '../interfaces';
import {defaults} from './defaults';

import Git from 'gh-pages/lib/git';

export async function run(
  dir: string,
  options: Schema & {
    dotfiles: boolean,
    notfound: boolean,
    nojekyll: boolean
  },
  logger: logging.LoggerApi
) {
  options = await prepareOptions(options, logger);

  // CRITICAL: Must require gh-pages AFTER monkeypatching util.debuglog
  // gh-pages calls util.debuglog('gh-pages') during module initialization to set up its logger.
  // If we require gh-pages before monkeypatching, it caches the original util.debuglog,
  // and our monkeypatch won't capture the logging output.
  // See prepareOptions() for the monkeypatch implementation.
  const ghpages = require('gh-pages');

  // always clean the cache directory.
  // avoids "Error: Remote url mismatch."
  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: cleaning of the cache directory');
  } else {
    ghpages.clean();
  }

  await checkIfDistFolderExists(dir);
  await createNotFoundFile(dir, options, logger);
  await createCnameFile(dir, options, logger);
  await createNojekyllFile(dir, options, logger);
  await publishViaGhPages(ghpages, dir, options, logger);

  if (!options.dryRun) {
    logger.info(
      '🌟 Successfully published via angular-cli-ghpages! Have a nice day!'
    );
  }
}

/**
 * Setup monkeypatch for util.debuglog to intercept gh-pages logging
 *
 * gh-pages uses util.debuglog('gh-pages') internally for all verbose logging.
 * We intercept it and forward to Angular logger instead of stderr.
 *
 * CRITICAL: This must be called BEFORE requiring gh-pages, otherwise gh-pages
 * will cache the original util.debuglog and our interception won't work.
 */
export function setupMonkeypatch(logger: logging.LoggerApi): void {
  const util = require('util');
  const originalDebuglog = util.debuglog;

  util.debuglog = (set: string) => {
    // gh-pages uses util.debuglog('gh-pages') internally for all verbose logging
    // Intercept it and forward to Angular logger instead of stderr
    if (set === 'gh-pages') {
      return function (...args: unknown[]) {
        const message = util.format.apply(util, args);
        logger.info(message);
      };
    }
    return originalDebuglog(set);
  };
}

/**
 * Map negated boolean options to positive boolean options
 *
 * Angular-CLI is NOT renaming the vars, so noDotfiles, noNotfound, and noNojekyll
 * come in with no change. We map this to dotfiles, notfound, nojekyll to have a
 * consistent pattern between Commander and Angular-CLI.
 */
export function mapNegatedBooleans(
  options: Schema & { dotfiles: boolean; notfound: boolean; nojekyll: boolean },
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
  options: Schema & { dotfiles: boolean; notfound: boolean; nojekyll: boolean },
  origOptions: Schema,
  logger: logging.LoggerApi
): void {
  if (options.name && options.email) {
    options['user'] = {
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
export function appendCIMetadata(
  options: Schema & { dotfiles: boolean; notfound: boolean; nojekyll: boolean }
): void {
  if (process.env.TRAVIS) {
    options.message +=
      ' -- ' +
      process.env.TRAVIS_COMMIT_MESSAGE +
      ' \n\n' +
      'Triggered by commit: https://github.com/' +
      process.env.TRAVIS_REPO_SLUG +
      '/commit/' +
      process.env.TRAVIS_COMMIT +
      '\n' +
      'Travis CI build: https://travis-ci.org/' +
      process.env.TRAVIS_REPO_SLUG +
      '/builds/' +
      process.env.TRAVIS_BUILD_ID;
  }

  if (process.env.CIRCLECI) {
    options.message +=
      '\n\n' +
      'Triggered by commit: https://github.com/' +
      process.env.CIRCLE_PROJECT_USERNAME +
      '/' +
      process.env.CIRCLE_PROJECT_REPONAME +
      '/commit/' +
      process.env.CIRCLE_SHA1 +
      '\n' +
      'CircleCI build: ' +
      process.env.CIRCLE_BUILD_URL;
  }

  if (process.env.GITHUB_ACTIONS) {
    options.message +=
      '\n\n' +
      'Triggered by commit: https://github.com/' +
      process.env.GITHUB_REPOSITORY +
      '/commit/' +
      process.env.GITHUB_SHA;
  }
}

/**
 * Inject authentication token into repository URL
 *
 * Supports GH_TOKEN, PERSONAL_TOKEN, and GITHUB_TOKEN environment variables.
 * Also handles legacy GH_TOKEN placeholder replacement for backwards compatibility.
 */
export async function injectTokenIntoRepoUrl(
  options: Schema & { dotfiles: boolean; notfound: boolean; nojekyll: boolean }
): Promise<void> {
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
  else if (options.repo && !options.repo.includes('x-access-token:')) {
    if (process.env.GH_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.GH_TOKEN}@github.com/`
      );
    }

    if (process.env.PERSONAL_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.PERSONAL_TOKEN}@github.com/`
      );
    }

    if (process.env.GITHUB_TOKEN) {
      options.repo = options.repo.replace(
        'https://github.com/',
        `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`
      );
    }
  }
}

/**
 * Prepare and validate deployment options
 *
 * This orchestrator function:
 * 1. Merges defaults with user options
 * 2. Sets up monkeypatch for gh-pages logging
 * 3. Maps negated boolean options (noDotfiles → dotfiles)
 * 4. Handles user credentials
 * 5. Warns about deprecated parameters
 * 6. Appends CI environment metadata
 * 7. Discovers and injects remote URL with authentication tokens
 * 8. Logs dry-run message if applicable
 */
export async function prepareOptions(
  origOptions: Schema,
  logger: logging.LoggerApi
): Promise<Schema & {
  dotfiles: boolean,
  notfound: boolean,
  nojekyll: boolean
}> {
  // 1. Merge defaults with user options
  const options: Schema & {
    dotfiles: boolean,
    notfound: boolean,
    nojekyll: boolean
  } = {
    ...defaults,
    ...origOptions
  };

  // 2. Setup monkeypatch for gh-pages logging (MUST be before requiring gh-pages)
  setupMonkeypatch(logger);

  // 3. Map negated boolean options
  mapNegatedBooleans(options, origOptions);

  // 4. Handle user credentials
  handleUserCredentials(options, origOptions, logger);

  // 5. Warn about deprecated parameters
  warnDeprecatedParameters(origOptions, logger);

  // 6. Append CI environment metadata
  appendCIMetadata(options);

  // 7. Discover and inject remote URL with authentication tokens
  await injectTokenIntoRepoUrl(options);

  // 8. Log dry-run message if applicable
  if (options.dryRun) {
    logger.info('Dry-run: No changes are applied at all.');
  }

  return options;
}

async function checkIfDistFolderExists(dir: string) {
  // CRITICAL FIX: Operator precedence bug
  // WRONG: await !fse.pathExists(dir) - applies ! to Promise (always false)
  // RIGHT: !(await fse.pathExists(dir)) - awaits first, then negates boolean
  if (!(await fse.pathExists(dir))) {
    throw new Error(
      'Dist folder does not exist. Check the dir --dir parameter or build the project first!'
    );
  }
}

async function createNotFoundFile(
  dir: string,
  options: {
    notfound: boolean,
    dryRun?: boolean
  },
  logger: logging.LoggerApi
) {
  if (!options.notfound) {
    return;
  }

  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: copying of index.html to 404.html');
    return;
  }

  // Note:
  // There is no guarantee that there will be an index.html file,
  // as we may may specify a custom index file or a different folder is going to be deployed.
  const indexHtml = path.join(dir, 'index.html');
  const notFoundFile = path.join(dir, '404.html');

  try {
    await fse.copy(indexHtml, notFoundFile);
    logger.info('404.html file created');
  } catch (err) {
    logger.info('index.html could not be copied to 404.html. Proceeding without it.');
    logger.debug('Diagnostic info: ' + err.message);
    return;
  }
}

async function createCnameFile(
  dir: string,
  options: {
    cname?: string,
    dryRun?: boolean
  },
  logger: logging.LoggerApi
) {
  if (!options.cname) {
    return;
  }

  const cnameFile = path.join(dir, 'CNAME');
  if (options.dryRun) {
    logger.info(
      'Dry-run / SKIPPED: creating of CNAME file with content: ' + options.cname
    );
    return;
  }

  try {
    await fse.writeFile(cnameFile, options.cname);
    logger.info('CNAME file created');
  } catch (err) {
    throw new Error('CNAME file could not be created. ' + err.message);
  }
}

async function createNojekyllFile(
  dir: string,
  options: {
    nojekyll: boolean,
    dryRun?: boolean
  },
  logger: logging.LoggerApi
) {
  if (!options.nojekyll) {
    return;
  }

  const nojekyllFile = path.join(dir, '.nojekyll');
  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: creating a .nojekyll file');
    return;
  }

  try {
    await fse.writeFile(nojekyllFile, '');
    logger.info('.nojekyll file created');
  } catch (err) {
    throw new Error('.nojekyll file could not be created. ' + err.message);
  }
}

async function publishViaGhPages(
  ghPages: GHPages,
  dir: string,
  options: Schema & {
    dotfiles: boolean,
    notfound: boolean,
    nojekyll: boolean
  },
  logger: logging.LoggerApi
) {
  if (options.dryRun) {
    logger.info(
      `Dry-run / SKIPPED: publishing folder '${dir}' with the following options: ` +
      JSON.stringify(
        {
          dir,
          repo: options.repo || 'current working directory (which must be a git repo in this case) will be used to commit & push',
          remote: options.remote,
          message: options.message,
          branch: options.branch,
          name: options.name ? `the name '${options.name}' will be used for the commit` : 'local or global git user name will be used for the commit',
          email: options.email ? `the email '${options.email}' will be used for the commit` : 'local or global git user email will be used for the commit',
          dotfiles: options.dotfiles ? `files starting with dot ('.') will be included` : `files starting with dot ('.') will be ignored`,
          notfound: options.notfound ? 'a 404.html file will be created' : 'a 404.html file will NOT be created',
          nojekyll: options.nojekyll ? 'a .nojekyll file will be created' : 'a .nojekyll file will NOT be created',
          cname: options.cname ? `a CNAME file with the content '${options.cname}' will be created` : 'a CNAME file will NOT be created',
          add: options.add ? 'all files will be added to the branch. Existing files will not be removed' : 'existing files will be removed from the branch before adding the new ones',
        },
        null,
        '  '
      )
    );
    return;
  }

  logger.info('🚀 Uploading via git, please wait...');

  // do NOT (!!) await ghPages.publish,
  // the promise is implemented in such a way that it always succeeds – even on errors!
  return new Promise((resolve, reject) => {
    ghPages.publish(dir, options, error => {
      if (error) {
        return reject(error);
      }

      resolve(undefined);
    });
  });
}

async function getRemoteUrl(options: Schema & { git?: string; remote?: string }): Promise<string> {
  const git = new Git(process.cwd(), options.git);
  return await git.getRemoteUrl(options.remote);
}
