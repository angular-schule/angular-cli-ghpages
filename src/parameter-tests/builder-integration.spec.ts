import { BuilderContext, BuilderRun, ScheduleOptions, Target } from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { BuildTarget, PublishOptions } from '../interfaces';
import { Schema } from '../deploy/schema';

/**
 * ANGULAR BUILDER INTEGRATION TESTS
 *
 * These tests verify the COMPLETE Angular Builder execution path:
 *   angular.json config
 *     → deploy/actions.ts (builder entry point)
 *     → engine.run() (REAL engine, not mocked)
 *     → engine.prepareOptions() (parameter transformation)
 *     → gh-pages.publish() (MOCKED to capture final options)
 *
 * This ensures that parameter transformation from Angular Builder format
 * (noDotfiles, noNotfound, noNojekyll) to engine format (dotfiles, notfound, nojekyll)
 * works correctly in the complete execution flow.
 *
 * WHAT'S REAL vs MOCKED:
 * ✅ REAL: deploy/actions.ts, engine/engine.ts, prepareOptions()
 * ❌ MOCKED: gh-pages.publish() (to capture final options), fs-extra, gh-pages/lib/git
 * This IS a true integration test - we test the full internal code path with external dependencies mocked.
 */

// Captured options from gh-pages.publish()
let capturedPublishOptions: PublishOptions | null = null;

// Mock gh-pages/lib/git module (imported by engine.ts)
jest.mock('gh-pages/lib/git', () => {
  return jest.fn().mockImplementation(() => ({
    // Mock git instance methods if needed
  }));
});

// Mock gh-pages module
jest.mock('gh-pages', () => ({
  clean: jest.fn(),
  publish: jest.fn((dir: string, options: any, callback: Function) => {
    capturedPublishOptions = options;
    // Call callback asynchronously to simulate real gh-pages behavior
    setImmediate(() => callback(null));
  })
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => ''),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({ isDirectory: () => false })),
  promises: {
    readFile: jest.fn(() => Promise.resolve('')),
    writeFile: jest.fn(() => Promise.resolve()),
  },
  native: {} // For fs-extra
}));

// Mock fs-extra module (it extends fs)
jest.mock('fs-extra', () => ({
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  writeFile: jest.fn(() => Promise.resolve()),
  readFileSync: jest.fn(() => ''),
  readFile: jest.fn(() => Promise.resolve('')),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(() => ({ isDirectory: () => false })),
  promises: {
    readFile: jest.fn(() => Promise.resolve('')),
    writeFile: jest.fn(() => Promise.resolve()),
  },
  native: {},
  ensureDirSync: jest.fn(),
  emptyDirSync: jest.fn(),
  copy: jest.fn(() => Promise.resolve()),
  copySync: jest.fn(),
  removeSync: jest.fn(),
  pathExists: jest.fn(() => Promise.resolve(true)),
  pathExistsSync: jest.fn(() => true),
}));

// Import after mocking
import deploy from '../deploy/actions';
import * as engine from '../engine/engine';

describe('Angular Builder Integration Tests', () => {
  let context: BuilderContext;

  const PROJECT = 'test-project';
  const BUILD_TARGET: BuildTarget = {
    name: `${PROJECT}:build:production`
  };

  beforeEach(() => {
    capturedPublishOptions = null;
    context = createMockContext();
  });

  describe('Boolean negation transformation (CRITICAL)', () => {
    it('should transform noDotfiles: true to dotfiles: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noDotfiles: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.dotfiles).toBe(false);
      expect(capturedPublishOptions!.noDotfiles).toBe(true);
    });

    it('should transform noNotfound: true to notfound: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noNotfound: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.notfound).toBe(false);
      expect(capturedPublishOptions!.noNotfound).toBe(true);
    });

    it('should transform noNojekyll: true to nojekyll: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noNojekyll: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.nojekyll).toBe(false);
      expect(capturedPublishOptions!.noNojekyll).toBe(true);
    });

    it('should transform all three negation flags together in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.dotfiles).toBe(false);
      expect(capturedPublishOptions!.notfound).toBe(false);
      expect(capturedPublishOptions!.nojekyll).toBe(false);
      expect(capturedPublishOptions!.noDotfiles).toBe(true);
      expect(capturedPublishOptions!.noNotfound).toBe(true);
      expect(capturedPublishOptions!.noNojekyll).toBe(true);
    });

    it('should default all boolean flags to true when not specified', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.dotfiles).toBe(true);
      expect(capturedPublishOptions!.notfound).toBe(true);
      expect(capturedPublishOptions!.nojekyll).toBe(true);
    });
  });

  describe('String parameter passthrough (complete flow)', () => {
    it('should pass repo through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const options: Schema = { repo, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.repo).toBe(repo);
    });

    it('should pass branch through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const branch = 'production';
      const options: Schema = { repo, branch, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.branch).toBe(branch);
    });

    it('should pass message through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const message = 'Custom deployment message';
      const options: Schema = { repo, message, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.message).toBe(message);
    });

    it('should transform name and email into user object in complete flow', async () => {
      const repo = 'https://github.com/test/repo.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      const expectedUser = { name, email };
      const options: Schema = { repo, name, email, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.user).toEqual(expectedUser);
    });

    it('should pass cname through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const cname = 'example.com';
      const options: Schema = { repo, cname, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.cname).toBe(cname);
    });
  });

  describe('Boolean parameter passthrough (non-negated)', () => {
    it('should pass add flag through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const add = true;
      const options: Schema = { repo, add, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();
      expect(capturedPublishOptions!.add).toBe(add);
    });

    it('should not call gh-pages.publish when dryRun is true', async () => {
      const ghPages = require('gh-pages');

      // Reset mock to clear calls from previous tests
      ghPages.publish.mockClear();

      const repo = 'https://github.com/test/repo.git';
      const options: Schema = { repo, dryRun: true, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      // Verify publish was not called in this test
      expect(ghPages.publish).not.toHaveBeenCalled();
    });
  });

  describe('Complete integration with all parameters', () => {
    it('should handle all parameters together in complete flow', async () => {
      const repo = 'https://github.com/test/repo.git';
      const remote = 'upstream';
      const branch = 'production';
      const message = 'Full integration test';
      const name = 'Integration Bot';
      const email = 'bot@test.com';
      const cname = 'test.com';
      const add = true;

      const options: Schema = {
        repo,
        remote,
        branch,
        message,
        name,
        email,
        cname,
        add,
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedPublishOptions).not.toBeNull();

      // Verify passthrough parameters
      expect(capturedPublishOptions!.repo).toBe(repo);
      expect(capturedPublishOptions!.remote).toBe(remote);
      expect(capturedPublishOptions!.branch).toBe(branch);
      expect(capturedPublishOptions!.message).toBe(message);
      expect(capturedPublishOptions!.cname).toBe(cname);
      expect(capturedPublishOptions!.add).toBe(add);

      // Verify user object transformation
      expect(capturedPublishOptions!.user).toEqual({ name, email });

      // Verify boolean negation transformations
      expect(capturedPublishOptions!.dotfiles).toBe(false);
      expect(capturedPublishOptions!.notfound).toBe(false);
      expect(capturedPublishOptions!.nojekyll).toBe(false);

      // Verify engine defaults are set
      expect(capturedPublishOptions!.git).toBe('git');
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
