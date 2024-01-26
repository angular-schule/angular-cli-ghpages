import { BuilderContext, targetFromTargetString } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';
import path from 'path';

import { BuildTarget } from '../interfaces';
import { Schema } from './schema';

export default async function deploy(
  engine: {
    run: (
      dir: string,
      options: Schema,
      logger: logging.LoggerApi
    ) => Promise<void>;
  },
  context: BuilderContext,
  buildTarget: BuildTarget,
  options: Schema
) {
  // 1. BUILD
  if (options.noBuild) {
    context.logger.info(`📦 Skipping build`);
  } else {
    if (!context.target) {
      throw new Error('Cannot execute the build target');
    }

    const overrides = {
      ...(options.baseHref && { baseHref: options.baseHref })
    };

    context.logger.info(`📦 Building "${context.target.project}"`);
    context.logger.info(`📦 Build target "${buildTarget.name}"`);

    const build = await context.scheduleTarget(
      targetFromTargetString(buildTarget.name),
      {
        ...buildTarget.options,
        ...overrides
      }
    );
    const buildResult = await build.result;

    if (!buildResult.success) {
      throw new Error('Error while building the app.');
    }
  }

  // 2. DEPLOYMENT

  let dir: string;
  if (options.dir) {

    dir = options.dir;

  } else {

    const buildOptions = await context.getTargetOptions(
      targetFromTargetString(buildTarget.name)
    );

    // Output path configuration
    // The outputPath option can be either
    // - a String which will be used as the base value + default value 'browser'
    // - or an Object for more fine-tune configuration.
    // see https://angular.io/guide/workspace-config#output-path-configuration
    // see https://github.com/angular/angular-cli/pull/26675

    if (!buildOptions.outputPath) {
      throw new Error(
        `Cannot read the outputPath option of the Angular project '${buildTarget.name}' in angular.json.`
      );
    }

    if (typeof buildOptions.outputPath === 'string') {
      dir = path.join(buildOptions.outputPath, 'browser');
    } else {
      const obj = buildOptions.outputPath as any;
      dir = path.join(obj.base, obj.browser)
    }
  }

  await engine.run(
    dir,
    options,
    (context.logger as unknown) as logging.LoggerApi
  );
}
