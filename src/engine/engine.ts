import * as path from 'path';
import * as fse from 'fs-extra';

import { logging } from '@angular-devkit/core';
import { defaults } from './defaults';
import { GHPages } from '../interfaces';
import { Schema } from '../deploy/schema';

const ghpages = require('gh-pages');

export async function run(dir: string, options: Schema, logger: logging.LoggerApi) {

  options = prepareOptions(options, logger);

  // always clean the cache directory.
  // avoids "Error: Remote url mismatch."
  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: cleaning of the cache directory');
  } else {
    ghpages.clean();
  }

  try {
    await checkIfDistFolderExists(dir);
    await createNotFoundPage(dir, options, logger);
    await createCnameFile(dir, options, logger);
    await publishViaGhPages(ghpages, dir, options, logger);

    logger.info('🚀 Successfully published via angular-cli-ghpages! Have a nice day!');
  }
  catch (error) {
    logger.error('❌ An error occurred!');
    throw error;
  }
};


export function prepareOptions(origOptions: Schema, logger: logging.LoggerApi) {

  const options = {
    ...defaults,
    ...origOptions
  };

  if (origOptions.noSilent) {
    options.silent = !origOptions.noSilent
  }

  if (origOptions.noDotfiles) {
    options.dotfiles = !origOptions.noDotfiles
  }

  if (options.dryRun) {
    logger.info('Dry-run: No changes are applied at all.');
  }

  if (options.name && options.email) {
    options['user'] = {
      name: options.name,
      email: options.email
    };
  };

  // gh-pages internal: forwards messages to logger
  options['logger'] = function (message) { logger.info(message); };

  if (process.env.TRAVIS) {
    options.message += ' -- ' + process.env.TRAVIS_COMMIT_MESSAGE + ' \n\n' +
      'Triggered by commit: https://github.com/' + process.env.TRAVIS_REPO_SLUG + '/commit/' + process.env.TRAVIS_COMMIT + '\n' +
      'Travis CI build: https://travis-ci.org/' + process.env.TRAVIS_REPO_SLUG + '/builds/' + process.env.TRAVIS_BUILD_ID;
  }

  if (process.env.CIRCLECI) {
    options.message += '\n\n' +
      'Triggered by commit: https://github.com/' + process.env.CIRCLE_PROJECT_USERNAME + '/' + process.env.CIRCLE_PROJECT_REPONAME + '/commit/' + process.env.CIRCLE_SHA1 + '\n' +
      'CircleCI build: ' + process.env.CIRCLE_BUILD_URL;
  }

  if (process.env.GH_TOKEN && options.repo) {
    options.repo = options.repo.replace('http://github.com/', 'http://GH_TOKEN@github.com/');
    options.repo = options.repo.replace('https://github.com/', 'https://GH_TOKEN@github.com/');
    options.repo = options.repo.replace('GH_TOKEN', process.env.GH_TOKEN);
  }


  return options;
}

async function checkIfDistFolderExists(dir: string) {
  if (await !fse.pathExists(dir)) {
    throw new Error('Dist folder does not exist. Check the dir --dir parameter or build the project first!');
  }
}

async function createNotFoundPage(dir: string, options: Schema, logger: logging.LoggerApi) {

  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: copying of index.html to 404.html');
    return;
  }

  // Note:
  // There is no guarantee that there will be an index.html file,
  // as we may may specify a custom index file.
  // TODO: respect setting in angular.json
  const indexHtml = path.join(dir, 'index.html');
  const notFoundPage = path.join(dir, '404.html');

  // console.log('***', indexHtml)
  // console.log('***', notFoundPage)

  try {
    return await fse.copy(indexHtml, notFoundPage);
  }
  catch (err) {
    logger.info('index.html could not be copied to 404.html. This does not look like an angular-cli project?!');
    logger.info('(Hint: are you sure that you have setup the directory correctly?)');
    logger.debug('Diagnostic info', err);
    return;
  }
}

async function createCnameFile(dir: string, options: Schema, logger: logging.LoggerApi) {

  if (!options.cname) {
    return;
  }

  const cnameFile = path.join(dir, 'CNAME');
  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: creating of CNAME file with content: ' + options.cname);
    return;
  }

  try {
    await fse.writeFile(cnameFile, options.cname);
    logger.info('CNAME file created');
  }
  catch (err) {
    logger.error('CNAME file could not be created. Stopping execution.');
    throw err;
  }
}

async function publishViaGhPages(ghPages: GHPages, dir: string, options: Schema, logger: logging.LoggerApi) {
  if (options.dryRun) {
    logger.info(`Dry-run / SKIPPED: publishing folder "${ dir }" with the following options: ` + JSON.stringify({
      dir: dir,
      repo: options.repo || 'falsy: current working directory (which must be a git repo in this case) will be used to commit & push',
      message: options.message,
      branch: options.branch,
      user: options.user || 'falsy: local or global git username & email properties will be taken',
      silent: options.silent || 'falsy: logging is in silent mode by default',
      dotfiles: options.dotfiles || 'falsy: dotfiles are included by default',
      cname: options.cname || 'falsy: no CNAME file will be created',
    }, null, '  '));
    return;
  }

  return await ghPages.publish(dir, options)
}
