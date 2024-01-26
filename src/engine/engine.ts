import { logging } from '@angular-devkit/core';
import * as fse from 'fs-extra';
import * as path from 'path';

import { Schema } from '../deploy/schema';
import { GHPages } from '../interfaces';
import { defaults } from './defaults';

import Git from 'gh-pages/lib/git';

export async function run(
  dir: string,
  options: Schema,
  logger: logging.LoggerApi
) {
  options = await prepareOptions(options, logger);

  // this has to occur _after_ the monkeypatch of util.debuglog:
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

export async function prepareOptions(
  origOptions: Schema,
  logger: logging.LoggerApi
) {
  const options = {
    ...defaults,
    ...origOptions
  };

  // this is the place where the old `noSilent` was enabled
  // (which is now always enabled because gh-pages is NOT silent by default)
  // monkeypatch util.debuglog to get all the extra information
  // see https://stackoverflow.com/a/39129886
  const util = require('util');
  let debuglog = util.debuglog;
  util.debuglog = set => {
    if (set === 'gh-pages') {
      return function () {
        let message = util.format.apply(util, arguments);
        logger.info(message);
      };
    }
    return debuglog(set);
  };

  if (origOptions.noDotfiles) {
    options.dotfiles = !origOptions.noDotfiles;
  }

  if (options.dryRun) {
    logger.info('Dry-run: No changes are applied at all.');
  }

  if (options.name && options.email) {
    options['user'] = {
      name: options.name,
      email: options.email
    };
  }

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

  // NEW in 0.6.2: always discover remote URL (if not set)
  // this allows us to inject tokens from environment even if `--repo` is not set manually
  if (!options.repo) {
    options.repo = await getRemoteUrl(options);
  }

  // for backwards compatibility only,
  // in the past --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git was advised
  //
  // this repalcement was also used to inject other tokens into the URL,
  // so it should only be removed with the next major version
  if (
    process.env.GH_TOKEN &&
    options.repo &&
    options.repo.includes('GH_TOKEN')
  ) {
    options.repo = options.repo.replace('GH_TOKEN', process.env.GH_TOKEN);
  }
  // preffered way: token is replaced from plain URL
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

  return options;
}

async function checkIfDistFolderExists(dir: string) {
  if (await !fse.pathExists(dir)) {
    throw new Error(
      'Dist folder does not exist. Check the dir --dir parameter or build the project first!'
    );
  }
}

async function createNotFoundFile(
  dir: string,
  options: Schema,
  logger: logging.LoggerApi
) {
  if (options.noNotfound) {
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
  options: Schema,
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
  options: Schema,
  logger: logging.LoggerApi
) {
  if (options.noNojekyll) {
    return;
  }

  const nojekyllFile = path.join(dir, '.nojekyll');
  if (options.dryRun) {
    logger.info('Dry-run / SKIPPED: creating an empty .nojekyll file');
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
  options: Schema,
  logger: logging.LoggerApi
) {
  if (options.dryRun) {
    logger.info(
      `Dry-run / SKIPPED: publishing folder "${dir}" with the following options: ` +
        JSON.stringify(
          {
            dir,
            repo:       options.repo       || 'falsy: current working directory (which must be a git repo in this case) will be used to commit & push',
            message:    options.message,
            branch:     options.branch,
            name:       options.name       || 'falsy: local or global git username will be used',
            email:      options.email      || 'falsy: local or global git user email will be used',
            dotfiles:   options.dotfiles   || 'falsy: dotfiles are included by default',
            noNotfound: options.noNotfound || 'falsy: a 404.html file will be created by default',
            noNojekyll: options.noNojekyll || 'falsy: a .nojekyll file will be created by default',
            cname:      options.cname      || 'falsy: no CNAME file will be created'
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

async function getRemoteUrl(options) {
  const git = new Git(process.cwd(), options.git);
  return await git.getRemoteUrl(options.remote);
}
