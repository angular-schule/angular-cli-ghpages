import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';

import * as engine from '../engine/engine';
import deploy from './actions';
import { Schema } from './schema';

// Call the createBuilder() function to create a builder. This mirrors
// createJobHandler() but add typings specific to Architect Builders.
export default createBuilder(
  async (options: Schema, context: BuilderContext): Promise<BuilderOutput> => {
    if (!context.target) {
      throw new Error('Cannot deploy the application without a target');
    }

    const buildTarget = {
      name: options.buildTarget || `${context.target.project}:build:production`
    };

    try {
      await deploy(engine, context, buildTarget, options);
    } catch (e) {
      context.logger.error('❌ An error occurred when trying to deploy:');
      context.logger.error(e.message);
      return { success: false };
    }

    return { success: true };
  }
);
