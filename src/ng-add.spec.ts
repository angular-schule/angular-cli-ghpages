import { Tree } from '@angular-devkit/schematics';
import { ngAdd } from './ng-add';

const PROJECT_NAME = 'pie-ka-chu';
const PROJECT_ROOT = 'pirojok';

const OTHER_PROJECT_NAME = 'pi-catch-you';

describe('ng-add', () => {
  describe('generating files', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = Tree.empty();
      tree.create('angular.json', JSON.stringify(generateAngularJson()));
    });

    it('generates new files if starting from scratch', async () => {
      const result = ngAdd({
        project: PROJECT_NAME
      })(tree, {});
      expect(result.read('angular.json')!.toString()).toEqual(
        initialAngularJson
      );
    });

    it('uses default project', async () => {
      const result = ngAdd({
        project: PROJECT_NAME
      })(tree, {});
      expect(result.read('angular.json')!.toString()).toEqual(
        overwriteAngularJson
      );
    });

    it('overrides existing files', async () => {
      const tempTree = ngAdd({
        project: PROJECT_NAME
      })(tree, {});
      const result = ngAdd({
        project: OTHER_PROJECT_NAME
      })(tempTree, {});
      expect(result.read('angular.json')!.toString()).toEqual(
        projectAngularJson
      );
    });
  });

  describe('error handling', () => {
    it('fails if project not defined', () => {
      const tree = Tree.empty();
      const angularJSON = generateAngularJson();
      delete angularJSON.defaultProject;
      tree.create('angular.json', JSON.stringify(angularJSON));
      expect(() =>
        ngAdd({
          project: ''
        })(tree, {})
      ).toThrowError(
        /No Angular project selected and no default project in the workspace/
      );
    });

    it('Should throw if angular.json not found', async () => {
      expect(() =>
        ngAdd({
          project: PROJECT_NAME
        })(Tree.empty(), {})
      ).toThrowError(/Could not find angular.json/);
    });

    it('Should throw if angular.json  can not be parsed', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', 'hi');
      expect(() =>
        ngAdd({
          project: PROJECT_NAME
        })(tree, {})
      ).toThrowError(/Could not parse angular.json/);
    });

    it('Should throw if specified project does not exist ', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify({ projects: {} }));
      expect(() =>
        ngAdd({
          project: PROJECT_NAME
        })(tree, {})
      ).toThrowError(
        /No Angular project selected and no default project in the workspace/
      );
    });

    it('Should throw if specified project is not application', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          projects: { [PROJECT_NAME]: { projectType: 'pokemon' } }
        })
      );
      expect(() =>
        ngAdd({
          project: PROJECT_NAME
        })(tree, {})
      ).toThrowError(
        /No Angular project selected and no default project in the workspace/
      );
    });

    it('Should throw if app does not have architect configured', async () => {
      const tree = Tree.empty();
      tree.create(
        'angular.json',
        JSON.stringify({
          projects: { [PROJECT_NAME]: { projectType: 'application' } }
        })
      );
      expect(() =>
        ngAdd({
          project: PROJECT_NAME
        })(tree, {})
      ).toThrowError(
        /No Angular project selected and no default project in the workspace/
      );
    });
  });
});

function generateAngularJson() {
  return {
    defaultProject: PROJECT_NAME,
    projects: {
      [PROJECT_NAME]: {
        projectType: 'application',
        root: PROJECT_ROOT,
        architect: {
          build: {
            options: {
              outputPath: 'dist/ikachu'
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
              outputPath: 'dist/ikachu'
            }
          }
        }
      }
    }
  };
}

const initialAngularJson = `{
  \"defaultProject\": \"pie-ka-chu\",
  \"projects\": {
    \"pie-ka-chu\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        },
        \"deploy\": {
          \"builder\": \"ngx-deploy-starter:deploy\",
          \"options\": {}
        }
      }
    },
    \"pi-catch-you\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        }
      }
    }
  }
}`;

const overwriteAngularJson = `{
  \"defaultProject\": \"pie-ka-chu\",
  \"projects\": {
    \"pie-ka-chu\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        },
        \"deploy\": {
          \"builder\": \"ngx-deploy-starter:deploy\",
          \"options\": {}
        }
      }
    },
    \"pi-catch-you\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        }
      }
    }
  }
}`;

const projectAngularJson = `{
  \"defaultProject\": \"pie-ka-chu\",
  \"projects\": {
    \"pie-ka-chu\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        },
        \"deploy\": {
          \"builder\": \"ngx-deploy-starter:deploy\",
          \"options\": {}
        }
      }
    },
    \"pi-catch-you\": {
      \"projectType\": \"application\",
      \"root\": \"pirojok\",
      \"architect\": {
        \"build\": {
          \"options\": {
            \"outputPath\": \"dist/ikachu\"
          }
        }
      }
    }
  }
}`;
