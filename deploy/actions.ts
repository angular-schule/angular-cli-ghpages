import { BuilderContext } from '@angular-devkit/architect';
import { GHPages } from '../interfaces';

export default async function deploy(
  ghPages: GHPages,
  context: BuilderContext,
  projectRoot: string
) {
  if (!context.target) {
    throw new Error('Cannot execute the build target');
  }

  context.logger.info(`📦 Building "${context.target.project}"`);

  const run = await context.scheduleTarget({
    target: 'build',
    project: context.target.project,
    configuration: 'production'
  });
  await run.result;

  try {
    await ghPages.publish(projectRoot, {});
    context.logger.info(
      `🚀 Your application is now available at https://${''}.firebaseapp.com/`
    );
  } catch (e) {
    context.logger.error(e);
  }
}
