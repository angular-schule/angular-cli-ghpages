import { workspaces } from '@angular-devkit/core';
import {
  SchematicContext,
  SchematicsException,
  Tree
} from '@angular-devkit/schematics';
import { createHost } from './utils';

interface NgAddOptions {
  project: string;
}

export const ngAdd = (options: NgAddOptions) => async (
  tree: Tree,
  context: SchematicContext
) => {
  const host = createHost(tree);
  const { workspace } = await workspaces.readWorkspace('/', host);

  if (!options.project) {
    if (workspace.projects.size === 1) {
      // If there is only one project, return that one.
      options.project = Array.from(workspace.projects.keys())[0];
    } else {
      throw new SchematicsException(
        'There is more than one project in your workspace. Please select it manually by using the --project argument.'
      );
    }
  }

  const project = workspace.projects.get(options.project);
  if (!project) {
    throw new SchematicsException(
      'The specified Angular project is not defined in this workspace'
    );
  }

  if (project.extensions.projectType !== 'application') {
    throw new SchematicsException(
      `Deploy requires an Angular project type of "application" in angular.json`
    );
  }

  // Validate build target exists (required for deployment)
  const buildTarget = project.targets.get('build');
  if (!buildTarget) {
    throw new SchematicsException(
      `Cannot find build target for the Angular project "${options.project}" in angular.json.`
    );
  }

  // outputPath validation:
  // - Angular 20+: outputPath is omitted (uses default dist/<project-name>)
  // - Angular 17-19: object format { base: "dist/app", browser: "", ... }
  // - Earlier versions: string format "dist/app"
  // See: https://github.com/angular/angular-cli/pull/26675
  const outputPath = buildTarget.options?.outputPath;
  const hasValidOutputPath =
    outputPath === undefined || // Angular 20+ uses sensible defaults
    typeof outputPath === 'string' ||
    (typeof outputPath === 'object' && outputPath !== null && 'base' in outputPath);

  if (!hasValidOutputPath) {
    throw new SchematicsException(
      `Invalid outputPath configuration for the Angular project "${options.project}" in angular.json. ` +
      `Expected undefined (default), a string, or an object with a "base" property.`
    );
  }

  project.targets.add({
    name: 'deploy',
    builder: 'angular-cli-ghpages:deploy',
    options: {}
  });

  workspaces.writeWorkspace(workspace, host);

  // Show next steps
  context.logger.info('');
  context.logger.info('🚀 angular-cli-ghpages is ready!');
  context.logger.info('');
  context.logger.info('Next steps:');
  context.logger.info('  1. Read the docs: https://github.com/angular-schule/angular-cli-ghpages');
  context.logger.info('  2. Deploy via: ng deploy');
  context.logger.info('  3. Have a nice day!');

  return tree;
};
