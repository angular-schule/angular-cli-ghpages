import {
  BuilderContext,
  BuilderOutput,
  BuilderRun,
  ScheduleOptions,
  Target
} from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { BuildTarget } from '../interfaces';

import deploy from './actions';

let context: BuilderContext;
const mockEngine = { run: (_: string, __: any, __2: any) => Promise.resolve() };

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
      try {
        await deploy(mockEngine, context, BUILD_TARGET, {});
        fail();
      } catch (e) {
        expect(e.message).toMatch(/Cannot execute the build target/);
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
  });
});

const initMocks = () => {
  context = {
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
    validateOptions: _ => Promise.resolve({} as any),
    getBuilderNameForTarget: () => Promise.resolve(''),
    analytics: null as any,
    getTargetOptions: (_: Target) =>
      Promise.resolve({
        outputPath: 'dist/some-folder'
      }),
    reportProgress: (_: number, __?: number, ___?: string) => {},
    reportStatus: (_: string) => {},
    reportRunning: () => {},
    scheduleBuilder: (_: string, __?: JsonObject, ___?: ScheduleOptions) =>
      Promise.resolve({} as BuilderRun),
    scheduleTarget: (_: Target, __?: JsonObject, ___?: ScheduleOptions) =>
      Promise.resolve({
        result: Promise.resolve(createBuilderOutputMock(true))
      } as BuilderRun)
  } as any;
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
