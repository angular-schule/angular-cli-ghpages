import {logging} from '@angular-devkit/core';
import * as fs from 'fs/promises';
import * as path from 'path';

import {Schema} from '../deploy/schema';
import * as ghpages from '../gh-pages-fork/lib';
import {pathExists} from '../utils';
import {defaults} from './defaults';
import {
  PreparedOptions,
  mapNegatedBooleans,
  handleUserCredentials,
  warnDeprecatedParameters,
  appendCIMetadata,
  injectTokenIntoRepoUrl
} from './engine.prepare-options-helpers';

export async function run(
  dir: string,
  options: Schema | PreparedOptions,
  logger: logging.LoggerApi
) {
  const prepared = await prepareOptions(options, logger);

  // Every deploy starts from a fresh clone of the target branch
  if (prepared.dryRun) {
    logger.info('Dry-run / SKIPPED: cleaning of the cache directory');
  } else {
    await ghpages.clean();
  }

  await checkIfDistFolderExists(dir);
  await createNotFoundFile(dir, prepared, logger);
  await publishViaGhPages(dir, prepared, logger);

  if (!prepared.dryRun) {
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
 * 2. Maps negated boolean options (noDotfiles → dotfiles)
 * 3. Handles user credentials
 * 4. Warns about deprecated parameters
 * 5. Appends CI environment metadata
 * 6. Discovers and injects remote URL with authentication tokens
 * 7. Logs dry-run message if applicable
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

  // 2. Map negated boolean options
  mapNegatedBooleans(options, origOptions);

  // 3. Handle user credentials
  handleUserCredentials(options, origOptions, logger);

  // 4. Warn about deprecated parameters
  warnDeprecatedParameters(origOptions, logger);

  // 5. Append CI environment metadata
  appendCIMetadata(options);

  // 6. Discover and inject remote URL with authentication tokens
  await injectTokenIntoRepoUrl(options);

  // 7. Log dry-run message if applicable
  if (options.dryRun) {
    logger.info('Dry-run: No changes are applied at all.');
  }

  return options;
}

async function checkIfDistFolderExists(dir: string) {
  if (!await pathExists(dir)) {
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
    await fs.copyFile(indexHtml, notFoundFile);
    logger.info('404.html file created');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.info('index.html could not be copied to 404.html. Proceeding without it.');
    logger.debug('Diagnostic info: ' + message);
    return;
  }
}

async function publishViaGhPages(
  dir: string,
  options: PreparedOptions,
  logger: logging.LoggerApi
) {
  if (options.dryRun) {
    // Note: options.repo may contain auth tokens. This is acceptable because:
    // 1. CI environments (GitHub Actions, etc.) automatically mask secrets in logs
    // 2. Dry-run is typically used for debugging, where seeing the full URL helps
    // 3. Local dry-runs don't persist logs
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

  await ghpages.publish(
    dir,
    {
      repo: options.repo,
      branch: options.branch,
      message: options.message,
      remote: options.remote,
      git: options.git,
      add: options.add,
      dotfiles: options.dotfiles,
      user: options.user,
      cname: options.cname,
      nojekyll: options.nojekyll
    },
    (message) => logger.info(message)
  );
}
