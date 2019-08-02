import { BuilderContext } from '@angular-devkit/architect';
import { Schema as RealDeployOptions } from './schema';
import { json, logging } from '@angular-devkit/core';

type DeployOptions = RealDeployOptions & json.JsonObject;

export default async function deploy(
  engine: { run: (dir: string, options: RealDeployOptions, logger: logging.LoggerApi) => Promise<void> },
  context: BuilderContext,
  projectRoot: string,
  options: DeployOptions
) {

  if (!context.target) {
    throw new Error('Cannot execute the build target');
  }

  context.logger.info(`📦 Building "${context.target.project}"`);

  const build = await context.scheduleTarget({
    target: 'build',
    project: context.target.project,
    configuration: 'production'
  }, options);
  await build.result;

  await engine.run(
    projectRoot,
    options,
    context.logger as unknown as logging.LoggerApi
  );
}
