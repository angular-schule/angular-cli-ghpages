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
      try {
        await deploy(mockEngine, context, BUILD_TARGET, {});
        fail();
      } catch (e) {
        expect(e.message).toBe(expectedErrorMessage);
      }
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
      try {
        await deploy(mockEngine, context, BUILD_TARGET, {});
        fail();
      } catch (e) {
        expect(e.message).toEqual('Error while building the app.');
      }
    });

    it('throws if outputPath is missing from build options', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({} as JsonObject);

      const expectedErrorMessage = `Cannot read the outputPath option of the Angular project '${BUILD_TARGET.name}' in angular.json.`;

      try {
        await deploy(mockEngine, context, BUILD_TARGET, { noBuild: false });
        fail();
      } catch (e) {
        expect(e.message).toBe(expectedErrorMessage);
      }
    });

    it('throws if outputPath has invalid shape (not string or object)', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: 123
        } as JsonObject);

      const expectedErrorPrefix = 'Unsupported outputPath configuration';

      try {
        await deploy(mockEngine, context, BUILD_TARGET, { noBuild: false });
        fail();
      } catch (e) {
        expect(e.message).toContain(expectedErrorPrefix);
      }
    });

    it('throws if outputPath object is missing base property', async () => {
      context.getTargetOptions = (_: Target) =>
        Promise.resolve({
          outputPath: { browser: 'browser' }
        } as JsonObject);

      const expectedErrorPrefix = 'Unsupported outputPath configuration';

      try {
        await deploy(mockEngine, context, BUILD_TARGET, { noBuild: false });
        fail();
      } catch (e) {
        expect(e.message).toContain(expectedErrorPrefix);
      }
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
