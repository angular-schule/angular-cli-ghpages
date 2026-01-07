import { SchematicContext, Tree } from '@angular-devkit/schematics';

import { ngAdd } from './ng-add';

const PROJECT_NAME = 'THEPROJECT';
const PROJECT_ROOT = 'PROJECTROOT';
const OTHER_PROJECT_NAME = 'OTHERPROJECT';

// Mock context with logger - only the methods we actually use
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  log: jest.fn(),
  createChild: jest.fn()
};

const mockContext = { logger: mockLogger } as unknown as SchematicContext;

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
      })(tree, mockContext);

      const actual = result.read('angular.json')!.toString();
      expect(prettifyJSON(actual)).toMatchSnapshot();
    });

    it('overrides existing files', async () => {
      const tempTree = await ngAdd({
        project: PROJECT_NAME
      })(tree, mockContext);

      const result = await ngAdd({
        project: OTHER_PROJECT_NAME
      })(tempTree, mockContext);

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
        mockContext
      );

      const resultConfig = readJSONFromTree(resultTree, 'angular.json');
      const deployTarget = resultConfig.projects[OTHER_PROJECT_NAME].architect.deploy;
      expect(deployTarget.builder).toBe('angular-cli-ghpages:deploy');
    });
  });

  describe('error handling', () => {
    it('should fail if there are multiple projects in workspace and project is not explicitly defined', async () => {
      const tree = Tree.empty();
      const angularJSON = generateAngularJson();
      tree.create('angular.json', JSON.stringify(angularJSON));

      await expect(
        ngAdd({ project: '' })(tree, mockContext)
      ).rejects.toThrowError(
        'There is more than one project in your workspace. Please select it manually by using the --project argument.'
      );
    });

    it('should throw if angular.json not found', async () => {
      await expect(
        ngAdd({ project: PROJECT_NAME })(Tree.empty(), mockContext)
      ).rejects.toThrowError('Unable to determine format for workspace path.');
    });

    it('should throw if angular.json can not be parsed', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', 'hi');

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, mockContext)
      ).rejects.toThrowError('Invalid workspace file - expected JSON object.');
    });

    it('should throw if specified project does not exist', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify({ version: 1, projects: {} }));

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, mockContext)
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
        ngAdd({ project: PROJECT_NAME })(tree, mockContext)
      ).rejects.toThrowError(
        'Deploy requires an Angular project type of "application" in angular.json'
      );
    });

    it('should throw if app does not have build target configured', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            [PROJECT_NAME]: {
              projectType: 'application',
              root: PROJECT_NAME,
              architect: {}
            }
          }
        })
      );

      await expect(
        ngAdd({
          project: PROJECT_NAME
        })(tree, mockContext)
      ).rejects.toThrowError(
        /Cannot find build target for the Angular project/
      );
    });
  });

  describe('Angular 17+ outputPath formats', () => {
    it('should accept Angular 20+ projects without outputPath (uses default)', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            [PROJECT_NAME]: {
              projectType: 'application',
              root: PROJECT_ROOT,
              architect: {
                build: {
                  builder: '@angular/build:application',
                  options: {
                    // Angular 20+ omits outputPath - uses sensible default
                  }
                }
              }
            }
          }
        })
      );

      const result = await ngAdd({ project: PROJECT_NAME })(
        tree,
        mockContext
      );

      const resultConfig = readJSONFromTree(result, 'angular.json');
      const deployTarget = resultConfig.projects[PROJECT_NAME].architect.deploy;
      expect(deployTarget.builder).toBe('angular-cli-ghpages:deploy');
    });

    it('should accept outputPath as object with base property', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            [PROJECT_NAME]: {
              projectType: 'application',
              root: PROJECT_ROOT,
              architect: {
                build: {
                  options: {
                    outputPath: { base: 'dist/my-app', browser: '' }
                  }
                }
              }
            }
          }
        })
      );

      const result = await ngAdd({ project: PROJECT_NAME })(
        tree,
        mockContext
      );

      const resultConfig = readJSONFromTree(result, 'angular.json');
      const deployTarget = resultConfig.projects[PROJECT_NAME].architect.deploy;
      expect(deployTarget.builder).toBe('angular-cli-ghpages:deploy');
    });

    it('should accept outputPath object with base and browser properties', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            [PROJECT_NAME]: {
              projectType: 'application',
              root: PROJECT_ROOT,
              architect: {
                build: {
                  options: {
                    outputPath: { base: 'dist/app', browser: 'browser', server: 'server' }
                  }
                }
              }
            }
          }
        })
      );

      const result = await ngAdd({ project: PROJECT_NAME })(
        tree,
        mockContext
      );

      const resultConfig = readJSONFromTree(result, 'angular.json');
      const deployTarget = resultConfig.projects[PROJECT_NAME].architect.deploy;
      expect(deployTarget.builder).toBe('angular-cli-ghpages:deploy');
    });

    it('should reject invalid outputPath object without base property', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            [PROJECT_NAME]: {
              projectType: 'application',
              root: PROJECT_ROOT,
              architect: {
                build: {
                  options: {
                    outputPath: { browser: 'browser' } // missing base - invalid
                  }
                }
              }
            }
          }
        })
      );

      await expect(
        ngAdd({ project: PROJECT_NAME })(tree, mockContext)
      ).rejects.toThrowError(
        /Invalid outputPath configuration.*Expected undefined.*a string.*an object with a "base" property/
      );
    });
  });

  describe('console output', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should display next steps after successful installation', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify(generateAngularJson()));

      await ngAdd({ project: PROJECT_NAME })(tree, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('🚀 angular-cli-ghpages is ready!');
      expect(mockLogger.info).toHaveBeenCalledWith('Next steps:');
      expect(mockLogger.info).toHaveBeenCalledWith('  1. Read the docs: https://github.com/angular-schule/angular-cli-ghpages');
      expect(mockLogger.info).toHaveBeenCalledWith('  2. Deploy via: ng deploy');
      expect(mockLogger.info).toHaveBeenCalledWith('  3. Have a nice day!');
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
