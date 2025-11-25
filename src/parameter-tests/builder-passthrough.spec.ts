import { BuilderContext, BuilderRun, ScheduleOptions, Target } from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import deploy from '../deploy/actions';
import { BuildTarget } from '../interfaces';
import { Schema } from '../deploy/schema';

/**
 * ANGULAR BUILDER PARAMETER PASSTHROUGH TESTS
 *
 * Tests that parameters from angular.json configuration are correctly passed
 * through the Angular builder to engine.run().
 *
 * Flow: angular.json → deploy/actions.ts → engine.run()
 */

describe('Angular Builder Parameter Passthrough', () => {
  let context: BuilderContext;
  let capturedDir: string | null = null;
  let capturedOptions: Schema | null = null;

  const PROJECT = 'test-project';
  const BUILD_TARGET: BuildTarget = {
    name: `${PROJECT}:build:production`
  };

  const mockEngine = {
    run: (dir: string, options: Schema, logger: logging.LoggerApi) => {
      capturedDir = dir;
      capturedOptions = options;
      return Promise.resolve();
    }
  };

  beforeEach(() => {
    capturedDir = null;
    capturedOptions = null;
    context = createMockContext();
  });

  describe('Basic parameter passing', () => {
    it('should pass repo parameter', async () => {
      const repo = 'https://github.com/test/repo.git';
      const options: Schema = { repo, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.repo).toBe(repo);
    });

    it('should pass remote parameter', async () => {
      const remote = 'upstream';
      const options: Schema = { remote, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.remote).toBe(remote);
    });

    it('should pass message parameter', async () => {
      const message = 'Custom deployment message';
      const options: Schema = { message, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.message).toBe(message);
    });

    it('should pass branch parameter', async () => {
      const branch = 'production';
      const options: Schema = { branch, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.branch).toBe(branch);
    });

    it('should pass name and email parameters together', async () => {
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      const options: Schema = { name, email, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.name).toBe(name);
      expect(capturedOptions!.email).toBe(email);
    });

    it('should pass cname parameter', async () => {
      const cname = 'example.com';
      const options: Schema = { cname, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.cname).toBe(cname);
    });

    it('should pass add flag', async () => {
      const add = true;
      const options: Schema = { add, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.add).toBe(add);
    });

    it('should pass dryRun flag', async () => {
      const dryRun = true;
      const options: Schema = { dryRun, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.dryRun).toBe(dryRun);
    });
  });

  describe('Boolean flags with no- prefix', () => {
    it('should pass noDotfiles flag', async () => {
      const noDotfiles = true;
      const options: Schema = { noDotfiles, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.noDotfiles).toBe(noDotfiles);
    });

    it('should pass noNotfound flag', async () => {
      const noNotfound = true;
      const options: Schema = { noNotfound, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.noNotfound).toBe(noNotfound);
    });

    it('should pass noNojekyll flag', async () => {
      const noNojekyll = true;
      const options: Schema = { noNojekyll, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.noNojekyll).toBe(noNojekyll);
    });

    it('should pass all three no- flags together', async () => {
      const noDotfiles = true;
      const noNotfound = true;
      const noNojekyll = true;
      const options: Schema = { noDotfiles, noNotfound, noNojekyll, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.noDotfiles).toBe(noDotfiles);
      expect(capturedOptions!.noNotfound).toBe(noNotfound);
      expect(capturedOptions!.noNojekyll).toBe(noNojekyll);
    });
  });

  describe('Directory handling', () => {
    it('should pass custom dir parameter when provided', async () => {
      const dir = 'dist/custom';
      const options: Schema = { dir, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedDir).toBe(dir);
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.dir).toBe(dir);
    });

    it('should use default outputPath/browser when dir not provided', async () => {
      const expectedDir = 'dist/some-folder/browser';
      const options: Schema = { noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedDir).toBe(expectedDir);
    });
  });

  describe('All parameters together', () => {
    it('should pass all parameters simultaneously', async () => {
      const dir = 'dist/custom';
      const repo = 'https://github.com/test/repo.git';
      const remote = 'upstream';
      const branch = 'production';
      const message = 'Full deploy';
      const name = 'Bot';
      const email = 'bot@test.com';
      const cname = 'test.com';
      const add = true;
      const dryRun = true;
      const noDotfiles = true;
      const noNotfound = true;
      const noNojekyll = true;

      const options: Schema = {
        dir,
        repo,
        remote,
        branch,
        message,
        name,
        email,
        cname,
        add,
        dryRun,
        noDotfiles,
        noNotfound,
        noNojekyll,
        noBuild: true
      };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.dir).toBe(dir);
      expect(capturedOptions!.repo).toBe(repo);
      expect(capturedOptions!.remote).toBe(remote);
      expect(capturedOptions!.branch).toBe(branch);
      expect(capturedOptions!.message).toBe(message);
      expect(capturedOptions!.name).toBe(name);
      expect(capturedOptions!.email).toBe(email);
      expect(capturedOptions!.cname).toBe(cname);
      expect(capturedOptions!.add).toBe(add);
      expect(capturedOptions!.dryRun).toBe(dryRun);
      expect(capturedOptions!.noDotfiles).toBe(noDotfiles);
      expect(capturedOptions!.noNotfound).toBe(noNotfound);
      expect(capturedOptions!.noNojekyll).toBe(noNojekyll);
    });
  });

  describe('baseHref parameter', () => {
    it('should pass baseHref parameter', async () => {
      const baseHref = '/my-app/';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });

    it('should handle baseHref with trailing slash', async () => {
      const baseHref = '/app/';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      // Passthrough - same variable proves no transformation
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });

    it('should handle baseHref without trailing slash', async () => {
      const baseHref = '/app';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      // Passthrough - same variable proves no transformation
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });

    it('should handle empty baseHref', async () => {
      const baseHref = '';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      // Even empty string should pass through
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });

    it('should handle absolute URL as baseHref', async () => {
      const baseHref = 'https://example.com/app/';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      // Passthrough - absolute URLs allowed
      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });

    it('should handle baseHref with special characters', async () => {
      const baseHref = '/my-app_v2.0/';
      const options: Schema = { baseHref, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.baseHref).toBe(baseHref);
    });
  });

  describe('Special values', () => {
    it('should handle URLs correctly', async () => {
      const repo = 'https://github.com/org/repo-name.git';
      const options: Schema = { repo, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.repo).toBe(repo);
    });

    it('should handle branch names with slashes', async () => {
      const branch = 'feature/new-feature';
      const options: Schema = { branch, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.branch).toBe(branch);
    });

    it('should handle email with plus addressing', async () => {
      const name = 'User';
      const email = 'user+deploy@example.com';
      const options: Schema = { name, email, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.name).toBe(name);
      expect(capturedOptions!.email).toBe(email);
    });

    it('should handle subdomain in cname', async () => {
      const cname = 'app.subdomain.example.com';
      const options: Schema = { cname, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.cname).toBe(cname);
    });

    it('should handle message with quotes', async () => {
      const message = 'Deploy "version 2.0"';
      const options: Schema = { message, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.message).toBe(message);
    });

    it('should handle message with unicode characters', async () => {
      const message = 'Deploy 🚀 with emojis ✨';
      const options: Schema = { message, noBuild: true };

      await deploy(mockEngine, context, BUILD_TARGET, options);

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.message).toBe(message);
    });
  });
});

function createMockContext(): BuilderContext {
  const mockContext: Partial<BuilderContext> = {
    target: {
      configuration: 'production',
      project: 'test-project',
      target: 'deploy'
    },
    builder: {
      builderName: 'angular-cli-ghpages:deploy',
      description: 'Deploy to GitHub Pages',
      optionSchema: false
    },
    currentDirectory: '/test',
    id: 1,
    logger: new logging.NullLogger(),
    workspaceRoot: '/test',
    addTeardown: _ => {},
    validateOptions: <T extends JsonObject = JsonObject>(_options: JsonObject, _builderName: string) => Promise.resolve({} as T),
    getBuilderNameForTarget: () => Promise.resolve(''),
    getTargetOptions: (_: Target) =>
      Promise.resolve({
        outputPath: 'dist/some-folder'
      } as JsonObject),
    reportProgress: (_: number, __?: number, ___?: string) => {},
    reportStatus: (_: string) => {},
    reportRunning: () => {},
    scheduleBuilder: (_: string, __?: JsonObject, ___?: ScheduleOptions) =>
      Promise.resolve({} as BuilderRun),
    scheduleTarget: (_: Target, __?: JsonObject, ___?: ScheduleOptions) =>
      Promise.resolve({
        result: Promise.resolve({
          success: true,
          error: '',
          info: {},
          target: {} as Target
        })
      } as BuilderRun)
  };

  return mockContext as BuilderContext;
}
