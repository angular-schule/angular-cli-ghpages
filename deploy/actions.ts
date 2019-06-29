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
    const success = ghPages.publish(projectRoot, {}, err => {
      if (err) {
        context.logger.error(err);
        return;
      }
      console.log(arguments);
      context.logger.info(
        `🚀 Your application is now available at https://${
          success.hosting.split('/')[1]
        }.firebaseapp.com/`
      );
    });
  } catch (e) {
    context.logger.error(e);
  }
}
