import { logging } from '@angular-devkit/core';
import * as fse from 'fs-extra';

import { Schema } from '../deploy/schema';

// TODO: add your deployment code here!
export async function run(
  dir: string,
  options: Schema,
  logger: logging.LoggerApi
) {
  try {
    options.targetDir = options.targetDir || '/example-folder';

    if (!(await fse.pathExists(options.targetDir))) {
      throw new Error(`Target directory ${options.targetDir} does not exist!`);
    }

    await fse.copy(dir, options.targetDir);

    logger.info(
      '🚀 Successfully published via @angular-schule/ngx-deploy-starter! Have a nice day!'
    );
  } catch (error) {
    logger.error('❌ An error occurred!');
    throw error;
  }
}
