import { BuilderContext } from '@angular-devkit/architect';
import { json, logging } from '@angular-devkit/core';

import { Schema } from './schema';


export default async function deploy(
  engine: { run: (dir: string, options: Schema, logger: logging.LoggerApi) => Promise<void> },
  context: BuilderContext,
  projectRoot: string,
  options: Schema
) {

  if (options.noBuild) {
    context.logger.info(`📦 Skipping build`);
  } else {

    if (!context.target) {
      throw new Error('Cannot execute the build target');
    }

    const configuration = options.configuration ? options.configuration : 'production'
    const overrides = {
      // this is an example how to override the workspace set of options
      ...(options.baseHref && {baseHref: options.baseHref})
    };

    context.logger.info(`📦 Building "${ context.target.project }". Configuration: "${ configuration }".${ options.baseHref ? ' Your base-href: "' + options.baseHref + '"' : '' }`);

    const build = await context.scheduleTarget({
      target: 'build',
      project: context.target.project,
      configuration
    }, overrides as json.JsonObject);
    await build.result;
  }

  await engine.run(
    projectRoot,
    options,
    context.logger as unknown as logging.LoggerApi
  );
}
