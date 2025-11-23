import {logging} from '@angular-devkit/core';
import * as fse from 'fs-extra';
import * as path from 'path';

import {Schema} from '../deploy/schema';
import {GHPages, PublishOptions} from '../interfaces';
import {defaults} from './defaults';
import {
  PreparedOptions,
  setupMonkeypatch,
  mapNegatedBooleans,
  handleUserCredentials,
  warnDeprecatedParameters,
  appendCIMetadata,
  injectTokenIntoRepoUrl
} from './engine.prepare-options-helpers';

export async function run(
  dir: string,
  options: PreparedOptions,
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
): Promise<PreparedOptions> {
  // 1. Merge defaults with user options
  const options: PreparedOptions = {
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
  options: PreparedOptions,
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

  // Only pass options that gh-pages understands
  // If gh-pages adds new options in the future, we'll need to add them here
  const ghPagesOptions: PublishOptions = {
    repo: options.repo,
    branch: options.branch,
    message: options.message,
    remote: options.remote,
    git: options.git as string | undefined,
    add: options.add,
    dotfiles: options.dotfiles,
    user: options.user
  };

  // do NOT (!!) await ghPages.publish,
  // the promise is implemented in such a way that it always succeeds – even on errors!
  return new Promise((resolve, reject) => {
    ghPages.publish(dir, ghPagesOptions, error => {
      if (error) {
        return reject(error);
      }

      resolve(undefined);
    });
  });
}
