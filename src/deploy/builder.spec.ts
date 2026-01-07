/**
 * Tests for builder.ts - specifically testing executeDeploy function
 * which contains the browserTarget rejection and error handling logic.
 */

import {
  BuilderContext,
  BuilderRun,
  ScheduleOptions,
  Target
} from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { Schema } from './schema';

// Mock the deploy function to prevent actual deployment
jest.mock('./actions', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined)
}));

// Mock the engine module
jest.mock('../engine/engine', () => ({
  run: jest.fn().mockResolvedValue(undefined),
  prepareOptions: jest.fn().mockImplementation((options) => Promise.resolve(options))
}));

// Import after mocking dependencies
import { executeDeploy } from './builder';
import deployMock from './actions';

describe('builder.ts executeDeploy', () => {
  let mockContext: BuilderContext;
  let errorSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.fn();

    mockContext = {
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
      logger: {
        error: errorSpy,
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
        log: jest.fn(),
        createChild: jest.fn()
      } as unknown as logging.LoggerApi,
      workspaceRoot: '/test',
      addTeardown: jest.fn(),
      validateOptions: jest.fn().mockResolvedValue({}),
      getBuilderNameForTarget: jest.fn().mockResolvedValue(''),
      getTargetOptions: jest.fn().mockResolvedValue({ outputPath: 'dist/test' } as JsonObject),
      reportProgress: jest.fn(),
      reportStatus: jest.fn(),
      reportRunning: jest.fn(),
      scheduleBuilder: jest.fn().mockResolvedValue({} as BuilderRun),
      scheduleTarget: jest.fn().mockResolvedValue({
        result: Promise.resolve({ success: true })
      } as BuilderRun)
    } as unknown as BuilderContext;
  });

  describe('browserTarget rejection', () => {
    it('should reject browserTarget option with clear error message and return success: false', async () => {
      const options = { browserTarget: 'test-project:build:production' } as unknown as Schema;

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ The "browserTarget" option is not supported.');
      expect(errorSpy).toHaveBeenCalledWith('   Use "buildTarget" instead.');
    });

    it('should not call deploy when browserTarget is provided', async () => {
      const options = { browserTarget: 'test-project:build:production' } as unknown as Schema;

      await executeDeploy(options, mockContext);

      expect(deployMock).not.toHaveBeenCalled();
    });

    it('should proceed normally when buildTarget is used instead of browserTarget', async () => {
      const options: Schema = {
        buildTarget: 'test-project:build:production',
        noBuild: true
      };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(deployMock).toHaveBeenCalled();
    });
  });

  describe('missing context.target', () => {
    it('should throw error when context.target is undefined', async () => {
      const contextWithoutTarget = {
        ...mockContext,
        target: undefined
      } as unknown as BuilderContext;

      const options: Schema = { noBuild: true };

      await expect(executeDeploy(options, contextWithoutTarget)).rejects.toThrow(
        'Cannot deploy the application without a target'
      );
    });
  });

  describe('deploy error handling', () => {
    it('should catch deploy errors and return success: false with error message', async () => {
      (deployMock as jest.Mock).mockRejectedValueOnce(new Error('Deployment failed'));

      const options: Schema = { noBuild: true };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ An error occurred when trying to deploy:');
      expect(errorSpy).toHaveBeenCalledWith('Deployment failed');
    });

    it('should handle non-Error thrown values using String()', async () => {
      (deployMock as jest.Mock).mockRejectedValueOnce('String error');

      const options: Schema = { noBuild: true };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ An error occurred when trying to deploy:');
      expect(errorSpy).toHaveBeenCalledWith('String error');
    });

    it('should handle object thrown values using String()', async () => {
      (deployMock as jest.Mock).mockRejectedValueOnce({ code: 500, msg: 'Server error' });

      const options: Schema = { noBuild: true };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('[object Object]');
    });
  });

  describe('build target resolution', () => {
    it('should use prerenderTarget when provided', async () => {
      const options: Schema = {
        prerenderTarget: 'test-project:prerender:production',
        noBuild: true
      };

      await executeDeploy(options, mockContext);

      expect(deployMock).toHaveBeenCalledWith(
        expect.anything(),
        mockContext,
        { name: 'test-project:prerender:production' },
        options
      );
    });

    it('should use buildTarget when provided (no prerenderTarget)', async () => {
      const options: Schema = {
        buildTarget: 'test-project:build:staging',
        noBuild: true
      };

      await executeDeploy(options, mockContext);

      expect(deployMock).toHaveBeenCalledWith(
        expect.anything(),
        mockContext,
        { name: 'test-project:build:staging' },
        options
      );
    });

    it('should use default build target when neither prerenderTarget nor buildTarget provided', async () => {
      const options: Schema = { noBuild: true };

      await executeDeploy(options, mockContext);

      expect(deployMock).toHaveBeenCalledWith(
        expect.anything(),
        mockContext,
        { name: 'test-project:build:production' },
        options
      );
    });

    it('should prefer prerenderTarget over buildTarget when both provided', async () => {
      const options: Schema = {
        buildTarget: 'test-project:build:production',
        prerenderTarget: 'test-project:prerender:production',
        noBuild: true
      };

      await executeDeploy(options, mockContext);

      expect(deployMock).toHaveBeenCalledWith(
        expect.anything(),
        mockContext,
        { name: 'test-project:prerender:production' },
        options
      );
    });
  });
});
