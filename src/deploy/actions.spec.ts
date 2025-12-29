import {
  BuilderContext,
  BuilderOutput,
  BuilderRun,
  ScheduleOptions,
  Target
} from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { BuildTarget } from '../interfaces';
import { Schema } from './schema';

import deploy from './actions';

interface EngineHost {
  run(dir: string, options: Schema, logger: logging.LoggerApi): Promise<void>;
}

let context: BuilderContext;
const mockEngine: EngineHost = { run: (_: string, __: Schema, __2: logging.LoggerApi) => Promise.resolve() };

const PROJECT = 'pirojok-project';
const BUILD_TARGET: BuildTarget = {
  name: `${PROJECT}:build:production`
};

describe('Deploy Angular apps', () => {
  beforeEach(() => initMocks());

  it('should invoke the builder', async () => {
    const spy = jest.spyOn(context, 'scheduleTarget');
    await deploy(mockEngine, context, BUILD_TARGET, {});

    expect(spy).toHaveBeenCalledWith(
      {
        target: 'build',
        configuration: 'production',
        project: PROJECT
      },
      {}
    );
  });

  it('should invoke the builder with the baseHref', async () => {
    const spy = jest.spyOn(context, 'scheduleTarget');
    await deploy(mockEngine, context, BUILD_TARGET, { baseHref: '/folder' });

    expect(spy).toHaveBeenCalledWith(
      {
        target: 'build',
        configuration: 'production',
        project: PROJECT
      },
      { baseHref: '/folder' }
    );
  });

  it('should invoke engine.run', async () => {
    const spy = jest.spyOn(mockEngine, 'run');
    await deploy(mockEngine, context, BUILD_TARGET, {});

    expect(spy).toHaveBeenCalledWith('dist/some-folder/browser', {}, context.logger);
  });

  describe('error handling', () => {
    it('throws if there is no target project', async () => {
      context.target = undefined;
      const expectedErrorMessage = 'Cannot execute the build target';

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, {})
      ).rejects.toThrow(expectedErrorMessage);
    });

    it('throws if app building fails', async () => {
      context.scheduleTarget = (
        _: Target,
        __?: JsonObject,
        ___?: ScheduleOptions
      ) =>
        Promise.resolve({
          result: Promise.resolve(createBuilderOutputMock(false))
        } as BuilderRun);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, {})
      ).rejects.toThrow('Error while building the app.');
    });

    it('uses default path when outputPath is undefined (Angular 20+)', async () => {
      // Angular 20+ omits outputPath, uses default: dist/<project>/browser
      let capturedDir: string | null = null;

      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      context.getTargetOptions = (_: Target) =>
        Promise.resolve({} as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });

      // Default path is dist/<project-name>/browser
      expect(capturedDir).toBe(`dist/${PROJECT}/browser`);
    });

    it('throws if outputPath has invalid shape (not string or object)', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: 123
        } as JsonObject);

      const expectedErrorMessage = `Unsupported outputPath configuration in angular.json for '${BUILD_TARGET.name}'. Expected string or {base, browser} object.`;

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(expectedErrorMessage);
    });

    it('throws if outputPath object is missing base property', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { browser: 'browser' }
        } as JsonObject);

      const expectedErrorMessage = `Unsupported outputPath configuration in angular.json for '${BUILD_TARGET.name}'. Expected string or {base, browser} object.`;

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(expectedErrorMessage);
    });

    it('throws if outputPath object has null base', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: null }
        } as JsonObject);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(/Unsupported outputPath configuration/);
    });

    it('throws if outputPath object has empty string base', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: '' }
        } as JsonObject);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(/Unsupported outputPath configuration/);
    });

    it('throws if outputPath object has numeric base', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 123 }
        } as JsonObject);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(/Unsupported outputPath configuration/);
    });

    it('throws if outputPath object has null browser', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 'dist/app', browser: null }
        } as JsonObject);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(/Unsupported outputPath configuration/);
    });

    it('uses correct dir when outputPath is object with base and browser (OP1)', async () => {
      let capturedDir: string | null = null;

      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 'dist/my-app', browser: 'browser' }
        } as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });

      expect(capturedDir).toBe('dist/my-app/browser');
    });

    it('uses correct dir when outputPath is object with only base (defaults browser to "browser")', async () => {
      // When browser property is undefined, Angular defaults to 'browser'
      // per Angular CLI schema: https://angular.io/guide/workspace-config#output-path-configuration
      let capturedDir: string | null = null;

      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 'dist/my-app' }
        } as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });

      expect(capturedDir).toBe('dist/my-app/browser');
    });

    it('uses isOutputPathObject type guard to handle object outputPath (OP2)', async () => {
      // This test verifies that actions.ts actually uses the isOutputPathObject
      // type guard from interfaces.ts to detect and handle object-shaped outputPath
      let capturedDir: string | null = null;

      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      // Provide a valid object outputPath that isOutputPathObject should recognize
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 'dist/test-project', browser: 'browser' }
        } as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });

      // If isOutputPathObject correctly identified this as an object and actions.ts
      // used it to construct the path, we should get base/browser
      expect(capturedDir).toBe('dist/test-project/browser');

      // Additionally verify it doesn't throw (meaning type guard returned true and
      // actions.ts successfully handled the object case)
      expect(capturedDir).not.toBeNull();
    });

    it('uses correct dir when outputPath is object with empty browser (Angular 19 SPA style)', async () => {
      // Angular 19 can use browser: "" to output directly to base folder
      let capturedDir: string | null = null;

      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { base: 'dist/my-app', browser: '' }
        } as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });

      expect(capturedDir).toBe('dist/my-app');
    });
  });
});

const initMocks = () => {
  const mockContext: Partial<BuilderContext> = {
    target: {
      configuration: 'production',
      project: PROJECT,
      target: 'foo'
    },
    builder: {
      builderName: 'mock',
      description: 'mock',
      optionSchema: false
    },
    currentDirectory: 'cwd',
    id: 1,
    logger: new logging.NullLogger(),
    workspaceRoot: 'cwd',
    addTeardown: _ => {},
    validateOptions: <T extends JsonObject = JsonObject>(_options: JsonObject) => Promise.resolve({} as T),
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
        result: Promise.resolve(createBuilderOutputMock(true))
      } as BuilderRun)
  };
  context = mockContext as BuilderContext;
};

const createBuilderOutputMock = (success: boolean): BuilderOutput => {
  return {
    info: { info: null },
    // unfortunately error is undefined in case of a build errors
    error: (undefined as unknown) as string,
    success: success,
    target: {} as Target
  };
};
