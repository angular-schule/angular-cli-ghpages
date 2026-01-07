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

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, {})
      ).rejects.toThrow('Cannot execute the build target');
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

    it('throws if outputPath has invalid shape', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { browser: 'browser' } // missing required 'base'
        } as JsonObject);

      await expect(
        deploy(mockEngine, context, BUILD_TARGET, { noBuild: false })
      ).rejects.toThrow(/Unsupported outputPath configuration/);
    });
  });

  describe('outputPath resolution', () => {
    const captureDir = async (outputPath: unknown): Promise<string> => {
      let capturedDir = '';
      const mockEngineWithCapture: EngineHost = {
        run: (dir: string, _options: Schema, _logger: logging.LoggerApi) => {
          capturedDir = dir;
          return Promise.resolve();
        }
      };

      context.getTargetOptions = (_: Target) =>
        Promise.resolve({ outputPath } as JsonObject);

      await deploy(mockEngineWithCapture, context, BUILD_TARGET, { noBuild: false });
      return capturedDir;
    };

    it('uses default path when outputPath is undefined (Angular 20+)', async () => {
      const dir = await captureDir(undefined);
      expect(dir).toBe(`dist/${PROJECT}/browser`);
    });

    it('appends /browser when outputPath is string (Angular 18-19)', async () => {
      const dir = await captureDir('dist/my-app');
      expect(dir).toBe('dist/my-app/browser');
    });

    it('uses base/browser when outputPath is object', async () => {
      const dir = await captureDir({ base: 'dist/my-app', browser: 'browser' });
      expect(dir).toBe('dist/my-app/browser');
    });

    it('defaults browser to "browser" when omitted from object', async () => {
      const dir = await captureDir({ base: 'dist/my-app' });
      expect(dir).toBe('dist/my-app/browser');
    });

    it('uses base only when browser is empty string (SPA mode)', async () => {
      const dir = await captureDir({ base: 'dist/my-app', browser: '' });
      expect(dir).toBe('dist/my-app');
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
