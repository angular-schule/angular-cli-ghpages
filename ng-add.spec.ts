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
      const result = ngAdd(tree, {
        project: PROJECT_NAME
      });
      expect(result.read('angular.json')!.toString()).toEqual(
        initialAngularJson
      );
    });

    it('uses default project', async () => {
      const result = ngAdd(tree, {});
      expect(result.read('angular.json')!.toString()).toEqual(
        overwriteAngularJson
      );
    });

    it('overrides existing files', async () => {
      const tempTree = ngAdd(tree, {
        project: PROJECT_NAME
      });
      const result = ngAdd(tempTree, {
        project: OTHER_PROJECT_NAME
      });
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
        ngAdd(tree, {
          project: ''
        })
      ).toThrowError(
        /No Angular project selected and no default project in the workspace/
      );
    });

    it('Should throw if angular.json not found', async () => {
      expect(() =>
        ngAdd(Tree.empty(), {
          project: PROJECT_NAME
        })
      ).toThrowError(/Could not find angular.json/);
    });

    it('Should throw if angular.json  can not be parsed', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', 'hi');
      expect(() =>
        ngAdd(tree, {
          project: PROJECT_NAME
        })
      ).toThrowError(/Could not parse angular.json/);
    });

    it('Should throw if specified project does not exist ', async () => {
      const tree = Tree.empty();
      tree.create('angular.json', JSON.stringify({ projects: {} }));
      expect(() =>
        ngAdd(tree, {
          project: PROJECT_NAME
        })
      ).toThrowError(
        /The specified Angular project is not defined in this workspace/
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
        ngAdd(tree, {
          project: PROJECT_NAME
        })
      ).toThrowError(
        /Deploy requires an Angular project type of "application" in angular.json/
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
        ngAdd(tree, {
          project: PROJECT_NAME
        })
      ).toThrowError(/Cannot read the output path/);
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
          \"builder\": \"ngx-gh:deploy\",
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
          \"builder\": \"ngx-gh:deploy\",
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
          \"builder\": \"ngx-gh:deploy\",
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
        },
        \"deploy\": {
          \"builder\": \"ngx-gh:deploy\",
          \"options\": {}
        }
      }
    }
  }
}`;
