import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { asWindowsPath, experimental, normalize } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import os from 'os';
import * as path from 'path';

import * as engine from '../engine/engine';
import deploy from './actions';
import { Schema } from './schema';

// Call the createBuilder() function to create a builder. This mirrors
// createJobHandler() but add typings specific to Architect Builders.
export default createBuilder<any>(
  async (options: Schema, context: BuilderContext): Promise<BuilderOutput> => {
    // The project root is added to a BuilderContext.
    const root = normalize(context.workspaceRoot);
    const workspace = new experimental.workspace.Workspace(
      root,
      new NodeJsSyncHost()
    );
    await workspace
      .loadWorkspaceFromHost(normalize('angular.json'))
      .toPromise();

    if (!context.target) {
      throw new Error('Cannot deploy the application without a target');
    }

    const targets = workspace.getProjectTargets(context.target.project);

    if (
      !targets ||
      !targets.build ||
      !targets.build.options ||
      !targets.build.options.outputPath
    ) {
      throw new Error('Cannot find the project output directory');
    }

    // normalizes pathes don't work with all native functions
    // as a workaround, you can use the following 2 lines
    const isWin = os.platform() === 'win32';
    const workspaceRoot = !isWin
      ? workspace.root
      : asWindowsPath(workspace.root);
    // if this is not necessary, use this:
    // const workspaceRoot =  workspace.root;

    try {
      await deploy(
        engine,
        context,
        path.join(workspaceRoot, targets.build.options.outputPath),
        options
      );
    } catch (e) {
      context.logger.error('Error when trying to deploy:', e);
      console.error(e);
      return { success: false };
    }

    return { success: true };
  }
);
