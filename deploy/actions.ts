import { BuilderContext } from '@angular-devkit/architect';
import { GHPages } from '../interfaces';
import { Schema as RealDeployOptions } from './schema';
import { json } from '@angular-devkit/core';
type DeployOptions = RealDeployOptions & json.JsonObject;

export default async function deploy(
  ghPages: GHPages,
  context: BuilderContext,
  projectRoot: string,
  options: DeployOptions
) {
  if (!context.target) {
    throw new Error('Cannot execute the build target');
  }

  context.logger.info(`📦 Building "${context.target.project}"`);

  const run = await context.scheduleTarget(
    {
      target: 'build',
      project: context.target.project,
      configuration: 'production'
    },
    options
  );
  await run.result;

  try {
    await ghPages.publish(projectRoot, {});
    if (options.deployUrl) {
      context.logger.info(
        `🚀 Your application is now available at ${options.deployUrl}`
      );
    } else {
      context.logger.info(`🚀 Your application is now on GitHub pages!`);
    }
  } catch (e) {
    context.logger.error(e);
  }
}
