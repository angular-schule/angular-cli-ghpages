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
  _context: SchematicContext
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

  if (!project.targets.get('build')?.options?.outputPath) {
    throw new SchematicsException(
      `Cannot read the output path (architect.build.options.outputPath) of the Angular project "${options.project}" in angular.json`
    );
  }

  project.targets.add({
    name: 'deploy',
    builder: 'angular-cli-ghpages:deploy',
    options: {}
  });

  workspaces.writeWorkspace(workspace, host);
  return tree;
};
