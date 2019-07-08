import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import deploy from './actions';
import { experimental, join, normalize } from '@angular-devkit/core';
const ghpages = require('gh-pages');

// Call the createBuilder() function to create a builder. This mirrors
// createJobHandler() but add typings specific to Architect Builders.
export default createBuilder<any>(
  async (_: any, context: BuilderContext): Promise<BuilderOutput> => {
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

    try {
      await deploy(
        ghpages,
        context,
        join(workspace.root, targets.build.options.outputPath)
      );
    } catch (e) {
      console.error('Error when trying to deploy: ');
      console.error(e.message);
      return { success: false };
    }

    return { success: true };
  }
);
