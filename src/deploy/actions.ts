import {
  BuilderContext,
  targetFromTargetString
} from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { Schema } from './schema';
import { BuildTarget } from '../interfaces';

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
  const buildOptions = await context.getTargetOptions(
    targetFromTargetString(buildTarget.name)
  );
  if (!buildOptions.outputPath || typeof buildOptions.outputPath !== 'string') {
    throw new Error(
      `Cannot read the output path option of the Angular project '${buildTarget.name}' in angular.json`
    );
  }

  await engine.run(
    buildOptions.outputPath,
    options,
    (context.logger as unknown) as logging.LoggerApi
  );
}
