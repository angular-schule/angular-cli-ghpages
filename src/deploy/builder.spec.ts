/**
 * Tests for builder.ts - specifically testing executeDeploy function
 * which contains the browserTarget rejection and error handling logic.
 */

import {
  BuilderContext,
  BuilderRun,
} from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { Schema } from './schema';
import { Mock } from 'vitest';

// Mock the deploy function to prevent actual deployment
vi.mock('./actions', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue(undefined)
}));

// Mock the engine module
vi.mock('../engine/engine', () => ({
  run: vi.fn().mockResolvedValue(undefined),
  prepareOptions: vi.fn().mockImplementation((options) => Promise.resolve(options))
}));

// Import after mocking dependencies
import { executeDeploy } from './builder';
import deployMock from './actions';

describe('builder.ts executeDeploy', () => {
  let mockContext: BuilderContext;
  let errorSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.fn();

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
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        log: vi.fn(),
        createChild: vi.fn()
      } as unknown as logging.LoggerApi,
      workspaceRoot: '/test',
      addTeardown: vi.fn(),
      validateOptions: vi.fn().mockResolvedValue({}),
      getBuilderNameForTarget: vi.fn().mockResolvedValue(''),
      getTargetOptions: vi.fn().mockResolvedValue({ outputPath: 'dist/test' } as JsonObject),
      reportProgress: vi.fn(),
      reportStatus: vi.fn(),
      reportRunning: vi.fn(),
      scheduleBuilder: vi.fn().mockResolvedValue({} as BuilderRun),
      scheduleTarget: vi.fn().mockResolvedValue({
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
      (deployMock as Mock).mockRejectedValueOnce(new Error('Deployment failed'));

      const options: Schema = { noBuild: true };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ An error occurred when trying to deploy:');
      expect(errorSpy).toHaveBeenCalledWith('Deployment failed');
    });

    it('should handle non-Error thrown values using String()', async () => {
      (deployMock as Mock).mockRejectedValueOnce('String error');

      const options: Schema = { noBuild: true };

      const result = await executeDeploy(options, mockContext);

      expect(result.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ An error occurred when trying to deploy:');
      expect(errorSpy).toHaveBeenCalledWith('String error');
    });

    it('should handle object thrown values using String()', async () => {
      (deployMock as Mock).mockRejectedValueOnce({ code: 500, msg: 'Server error' });

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
