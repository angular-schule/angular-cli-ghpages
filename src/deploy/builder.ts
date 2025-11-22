import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';

import * as engine from '../engine/engine';
import deploy from './actions';
import { Schema } from './schema';
import { BuildTarget } from '../interfaces';

// Call the createBuilder() function to create a builder. This mirrors
// createJobHandler() but add typings specific to Architect Builders.
//
// if something breaks here, see how angularfire has fixed it:
// https://github.com/angular/angularfire/blob/master/src/schematics/deploy/builder.ts
export default createBuilder(
  async (options: Schema, context: BuilderContext): Promise<BuilderOutput> => {
    if (!context.target) {
      throw new Error('Cannot deploy the application without a target');
    }

    const staticBuildTarget = {
      name:
        options.browserTarget ||
        options.buildTarget ||
        `${context.target.project}:build:production`
    };

    let prerenderBuildTarget: BuildTarget | undefined;
    if (options.prerenderTarget) {
      prerenderBuildTarget = {
        name: options.prerenderTarget
      };
    }

    // serverBuildTarget is not supported and is completely ignored
    // let serverBuildTarget: BuildTarget | undefined;
    // if (options.ssr) {
    //   serverBuildTarget = {
    //     name: options.serverTarget || options.universalBuildTarget || `${context.target.project}:server:production`
    //   };
    // }

    const finalBuildTarget = prerenderBuildTarget
      ? prerenderBuildTarget
      : staticBuildTarget;

    try {
      await deploy(engine, context, finalBuildTarget, options);
    } catch (e) {
      context.logger.error('❌ An error occurred when trying to deploy:');
      context.logger.error(e.message);
      return { success: false };
    }

    return { success: true };
  }
);
