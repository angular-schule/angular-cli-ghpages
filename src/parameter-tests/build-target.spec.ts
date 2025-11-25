import { BuilderContext, BuilderRun, ScheduleOptions, Target } from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import deploy from '../deploy/actions';
import { BuildTarget } from '../interfaces';
import { Schema } from '../deploy/schema';

/**
 * BUILD TARGET RESOLUTION TESTS
 *
 * Tests for Angular Builder-specific target parameters:
 * - buildTarget: Standard build target
 * - browserTarget: Legacy/alternative build target
 * - prerenderTarget: SSG/prerender build target
 * - noBuild: Skip build process
 *
 * These tests verify the builder correctly resolves which build target
 * to use and whether to trigger a build at all.
 */

describe('Build Target Resolution', () => {
  let context: BuilderContext;
  let scheduleTargetSpy: jest.SpyInstance;
  let capturedOptions: Schema | null = null;

  const PROJECT = 'test-project';

  const mockEngine = {
    run: (dir: string, options: Schema, logger: logging.LoggerApi) => {
      capturedOptions = options;
      return Promise.resolve();
    }
  };

  beforeEach(() => {
    capturedOptions = null;
    context = createMockContext();
    scheduleTargetSpy = jest.spyOn(context, 'scheduleTarget');
  });

  describe('buildTarget parameter', () => {
    it('should use buildTarget when specified', async () => {
      const buildTarget = `${PROJECT}:build:staging`;
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: 'staging'
        },
        {}
      );
    });

    it('should parse buildTarget with project:target:configuration format', async () => {
      const buildTarget = 'myapp:build:production';
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: 'myapp',
          target: 'build',
          configuration: 'production'
        },
        {}
      );
    });

    it('should handle buildTarget without configuration', async () => {
      const buildTarget = `${PROJECT}:build`;
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: undefined
        },
        {}
      );
    });

    it('should default to project:build:production when buildTarget not specified', async () => {
      const defaultTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: defaultTarget };
      const options: Schema = { noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: 'production'
        },
        {}
      );
    });
  });

  describe('browserTarget parameter (legacy)', () => {
    it('should use browserTarget when specified', async () => {
      const browserTarget = `${PROJECT}:build:staging`;
      const expectedBuildTarget: BuildTarget = { name: browserTarget };
      const options: Schema = { browserTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: 'staging'
        },
        {}
      );
    });

    it('should parse browserTarget with project:target:configuration format', async () => {
      const browserTarget = 'legacy-app:build:development';
      const expectedBuildTarget: BuildTarget = { name: browserTarget };
      const options: Schema = { browserTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: 'legacy-app',
          target: 'build',
          configuration: 'development'
        },
        {}
      );
    });
  });

  describe('buildTarget vs browserTarget precedence', () => {
    it('should prefer browserTarget over buildTarget when both specified', async () => {
      // Note: In builder.ts line 25, browserTarget comes BEFORE buildTarget in the OR chain
      const browserTarget = `${PROJECT}:build:staging`;
      const buildTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: browserTarget };
      const options: Schema = { browserTarget, buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      // Should use browserTarget (comes first in OR chain)
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: 'staging'
        },
        {}
      );
    });
  });

  describe('prerenderTarget parameter', () => {
    it('should use prerenderTarget for SSG builds', async () => {
      const prerenderTarget = `${PROJECT}:prerender:production`;
      const expectedBuildTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'prerender',
          configuration: 'production'
        },
        {}
      );
    });

    it('should parse prerenderTarget with project:target:configuration format', async () => {
      const prerenderTarget = 'ssg-app:prerender:staging';
      const expectedBuildTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: 'ssg-app',
          target: 'prerender',
          configuration: 'staging'
        },
        {}
      );
    });

    it('should prefer prerenderTarget over buildTarget when both specified', async () => {
      // Per builder.ts lines 45-47: prerenderTarget takes precedence
      const prerenderTarget = `${PROJECT}:prerender:production`;
      const buildTarget = `${PROJECT}:build:production`;
      const expectedPrerenderTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedPrerenderTarget, options);

      // Should use prerenderTarget (explicit precedence in code)
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'prerender',
          configuration: 'production'
        },
        {}
      );
    });

    it('should prefer prerenderTarget over browserTarget when both specified', async () => {
      const prerenderTarget = `${PROJECT}:prerender:production`;
      const browserTarget = `${PROJECT}:build:staging`;
      const expectedPrerenderTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, browserTarget, noBuild: false };

      await deploy(mockEngine, context, expectedPrerenderTarget, options);

      // Should use prerenderTarget (highest precedence)
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'prerender',
          configuration: 'production'
        },
        {}
      );
    });

    it('should handle all three target types specified simultaneously', async () => {
      // Precedence: prerenderTarget > browserTarget > buildTarget > default
      const prerenderTarget = `${PROJECT}:prerender:production`;
      const browserTarget = `${PROJECT}:build:staging`;
      const buildTarget = `${PROJECT}:build:development`;
      const expectedPrerenderTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, browserTarget, buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedPrerenderTarget, options);

      // Should use prerenderTarget (highest priority)
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'prerender',
          configuration: 'production'
        },
        {}
      );
    });
  });

  describe('noBuild parameter', () => {
    it('should skip build when noBuild is true', async () => {
      const buildTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget, noBuild: true };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      // Should NOT call scheduleTarget when noBuild is true
      expect(scheduleTargetSpy).not.toHaveBeenCalled();
    });

    it('should trigger build when noBuild is false', async () => {
      const buildTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget, noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      // Should call scheduleTarget when noBuild is false
      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
    });

    it('should default to building when noBuild is not specified', async () => {
      const buildTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: buildTarget };
      const options: Schema = { buildTarget };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      // Default is noBuild: false (should build)
      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
    });

    it('should skip build with noBuild=true even when prerenderTarget specified', async () => {
      const prerenderTarget = `${PROJECT}:prerender:production`;
      const expectedPrerenderTarget: BuildTarget = { name: prerenderTarget };
      const options: Schema = { prerenderTarget, noBuild: true };

      await deploy(mockEngine, context, expectedPrerenderTarget, options);

      // Should NOT build even with prerenderTarget
      expect(scheduleTargetSpy).not.toHaveBeenCalled();
    });

    it('should trigger build with noBuild=false when default target used', async () => {
      const defaultTarget = `${PROJECT}:build:production`;
      const expectedBuildTarget: BuildTarget = { name: defaultTarget };
      const options: Schema = { noBuild: false };

      await deploy(mockEngine, context, expectedBuildTarget, options);

      // Should build with default target
      expect(scheduleTargetSpy).toHaveBeenCalledTimes(1);
      expect(scheduleTargetSpy).toHaveBeenCalledWith(
        {
          project: PROJECT,
          target: 'build',
          configuration: 'production'
        },
        {}
      );
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
        outputPath: 'dist/test-project'
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
