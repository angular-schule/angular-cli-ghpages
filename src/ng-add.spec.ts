import { SchematicContext, Tree } from '@angular-devkit/schematics';

import { ngAdd } from './ng-add';

const PROJECT_NAME = 'THEPROJECT';
const PROJECT_ROOT = 'PROJECTROOT';
const OTHER_PROJECT_NAME = 'OTHERPROJECT';

describe('ng-add', () => {
  describe('generating files', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = Tree.empty();
      tree.create('angular.json', JSON.stringify(generateAngularJson()));
    });

    it('generates new files if starting from scratch', async () => {
      const result = await ngAdd({
        project: PROJECT_NAME
      })(tree, {} as SchematicContext);

      const actual = result.read('angular.json')!.toString();
      expect(prettifyJSON(actual)).toMatchSnapshot();
    });

    it('overrides existing files', async () => {
      const tempTree = await ngAdd({
        project: PROJECT_NAME
      })(tree, {} as SchematicContext);

      const result = await ngAdd({
        project: OTHER_PROJECT_NAME
      })(tempTree, {} as SchematicContext);

      const actual = result.read('angular.json')!.toString();

      expect(prettifyJSON(actual)).toMatchSnapshot();
    });
  });

  describe('error handling', () => {
    it('should fail if project not defined', async () => {
      const tree = Tree.empty();
      const angularJSON = generateAngularJson();
      delete angularJSON.defaultProject;
      tree.create('angular.json', JSON.stringify(angularJSON));

      await expect(
        ngAdd({
          project: ''
        })(tree, {} as SchematicContext)
      ).rejects.toThrowError(
        'No Angular project selected and no default project in the workspace'
      );
    });

    it('should throw if angular.json not found', async () => {
      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(Tree.empty(), {} as SchematicContext)
      ).rejects.toThrowError('Unable to determine format for workspace path.');
    });

    it('should throw if angular.json can not be parsed', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', 'hi');

      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(tree, {} as SchematicContext)
      ).rejects.toThrowError('Invalid JSON character: "h" at 0:0.');
    });

    it('should throw if specified project does not exist', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify({ version: 1, projects: {} }));

      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(tree, {} as SchematicContext)
      ).rejects.toThrowError(
        'The specified Angular project is not defined in this workspace'
      );
    });

    it('should throw if specified project is not application', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: { [PROJECT_NAME]: { projectType: 'invalid' } }
        })
      );

      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(tree, {} as SchematicContext)
      ).rejects.toThrowError(
        'Deploy requires an Angular project type of "application" in angular.json'
      );
    });

    it('should throw if app does not have architect configured', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: { [PROJECT_NAME]: { projectType: 'application' } }
        })
      );

      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(tree, {} as SchematicContext)
      ).rejects.toThrowError(
        'Cannot read the output path (architect.build.options.outputPath) of the Angular project "THEPROJECT" in angular.json'
      );
    });
  });
});

function prettifyJSON(json: string) {
  return JSON.stringify(JSON.parse(json), null, 2);
}

function generateAngularJson() {
  return {
    version: 1,
    defaultProject: PROJECT_NAME as string | undefined,
    projects: {
      [PROJECT_NAME]: {
        projectType: 'application',
        root: PROJECT_ROOT,
        architect: {
          build: {
            options: {
              outputPath: 'dist/' + PROJECT_NAME
            }
          }
        }
      },
      [OTHER_PROJECT_NAME]: {
        projectType: 'application',
        root: PROJECT_ROOT,
        architect: {
          build: {
            options: {
              outputPath: 'dist/' + OTHER_PROJECT_NAME
            }
          }
        }
      }
    }
  };
}
