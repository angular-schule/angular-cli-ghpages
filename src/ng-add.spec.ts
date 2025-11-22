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

  describe('project selection', () => {

    it('should select the first project if there is only one', async () => {
      const tree = Tree.empty();
      const angularJSON = generateAngularJson();
      delete angularJSON.projects[PROJECT_NAME]; // delete one project so that one is left
      tree.create('angular.json', JSON.stringify(angularJSON));

      const resultTree = await ngAdd({ project: '' })(
        tree,
        {} as SchematicContext
      );

      const resultConfig = readJSONFromTree(resultTree, 'angular.json');
      expect(
        resultConfig.projects[OTHER_PROJECT_NAME].architect.deploy
      ).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should fail if there are multiple projects in workspace and project is not explicitly defined', async () => {
      const tree = Tree.empty();
      const angularJSON = generateAngularJson();
      tree.create('angular.json', JSON.stringify(angularJSON));

      await expect(
        ngAdd({ project: '' })(tree, {} as SchematicContext)
      ).rejects.toThrowError(
        'There is more than one project in your workspace. Please select it manually by using the --project argument.'
      );
    });

    it('should throw if angular.json not found', async () => {
      await expect(
        ngAdd({ project: PROJECT_NAME })(Tree.empty(), {} as SchematicContext)
      ).rejects.toThrowError('Unable to determine format for workspace path.');
    });

    it('should throw if angular.json can not be parsed', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', 'hi');

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, {} as SchematicContext)
      ).rejects.toThrowError('Invalid workspace file - expected JSON object.');
    });

    it('should throw if specified project does not exist', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify({ version: 1, projects: {} }));

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, {} as SchematicContext)
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
          projects: {
            [PROJECT_NAME]: { projectType: 'invalid', root: PROJECT_NAME }
          }
        })
      );

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, {} as SchematicContext)
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
          projects: {
            [PROJECT_NAME]: { projectType: 'application', root: PROJECT_NAME }
          }
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

function readJSONFromTree(tree: Tree, file: string) {
  return JSON.parse(tree.read(file)!.toString());
}

interface AngularJsonProject {
  projectType: string;
  root: string;
  architect: {
    build: {
      options: {
        outputPath: string;
      };
    };
  };
}

interface AngularJson {
  version: number;
  projects: {
    [key: string]: AngularJsonProject;
  };
}

function generateAngularJson(): AngularJson {
  return {
    version: 1,
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
