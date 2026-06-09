import { BuilderContext, BuilderRun, ScheduleOptions, Target } from '@angular-devkit/architect/src';
import { JsonObject, logging } from '@angular-devkit/core';
import { BuildTarget, PublishOptions } from '../interfaces';
import { Schema } from '../deploy/schema';
import { cleanupMonkeypatch } from '../engine/engine.prepare-options-helpers';

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
 * ❌ MOCKED: gh-pages.publish() (to capture final options), utils.pathExists, gh-pages/lib/git
 * This IS a true integration test - we test the full internal code path with external dependencies mocked.
 */

// Captured options from gh-pages.publish()
const { capturedOptions } = vi.hoisted(() => {
  const capturedOptions = { value: null as PublishOptions | null };
  return { capturedOptions };
});

// Mock gh-pages/lib/git module (imported by engine.ts)
vi.mock('gh-pages/lib/git', () => ({
  default: vi.fn().mockImplementation(() => ({}))
}));

// Mock utils.pathExists
vi.mock('../utils', async () => ({
  ...(await vi.importActual('../utils')),
  pathExists: vi.fn(() => Promise.resolve(true))
}));

// Import after mocking
import deploy from '../deploy/actions';
import * as engine from '../engine/engine';

// Spy on gh-pages at module level — vi.mock can't intercept dynamic require() in engine.ts
const ghPagesModule = require('gh-pages');

describe('Angular Builder Integration Tests', () => {
  let context: BuilderContext;
  let originalEnv: NodeJS.ProcessEnv;

  const PROJECT = 'test-project';
  const BUILD_TARGET: BuildTarget = {
    name: `${PROJECT}:build:production`
  };

  beforeEach(() => {
    // Save and clear CI environment variables to ensure consistent test behavior
    originalEnv = { ...process.env };
    delete process.env.TRAVIS;
    delete process.env.CIRCLECI;
    delete process.env.GITHUB_ACTIONS;

    // Clean up any previous monkeypatch so each test starts fresh
    cleanupMonkeypatch();
    capturedOptions.value = null;
    context = createMockContext();

    // Spy on gh-pages to intercept calls from engine.run()
    vi.spyOn(ghPagesModule, 'clean').mockImplementation(() => {});
    vi.spyOn(ghPagesModule, 'publish').mockImplementation(
      (_dir: string, options: PublishOptions, callback?: (error: Error | null) => void) => {
        capturedOptions.value = options;
        if (callback) {
          callback(null);
        }
        return Promise.resolve() as any;
      }
    );
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    // Clean up monkeypatch after all tests
    cleanupMonkeypatch();
  });

  describe('Boolean negation transformation (CRITICAL)', () => {
    it('should transform noDotfiles: true to dotfiles: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noDotfiles: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.dotfiles).toBe(false);
      // Internal options should NOT be passed to gh-pages
      expect(capturedOptions.value!.noDotfiles).toBeUndefined();
    });

    it('should transform noNotfound: true to notfound: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noNotfound: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      // notfound is internal to angular-cli-ghpages, NOT passed to gh-pages
      // (notfound controls 404.html creation which we do ourselves)
      expect(capturedOptions.value!.notfound).toBeUndefined();
      expect(capturedOptions.value!.noNotfound).toBeUndefined();
    });

    it('should transform noNojekyll: true to nojekyll: false in complete flow', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noNojekyll: true,
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      // nojekyll IS passed to gh-pages v6+ (delegated to gh-pages)
      expect(capturedOptions.value!.nojekyll).toBe(false);
      expect(capturedOptions.value!.noNojekyll).toBeUndefined();
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

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.dotfiles).toBe(false);
      // nojekyll IS passed to gh-pages v6+ (delegated)
      expect(capturedOptions.value!.nojekyll).toBe(false);
      // notfound is internal (404.html creation by angular-cli-ghpages)
      expect(capturedOptions.value!.notfound).toBeUndefined();
      // negated options should NOT be passed
      expect(capturedOptions.value!.noDotfiles).toBeUndefined();
      expect(capturedOptions.value!.noNotfound).toBeUndefined();
      expect(capturedOptions.value!.noNojekyll).toBeUndefined();
    });

    it('should default all boolean flags to true when not specified', async () => {
      const options: Schema = {
        repo: 'https://github.com/test/repo.git',
        noBuild: true
      };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.dotfiles).toBe(true);
      // nojekyll IS passed to gh-pages v6+ (delegated)
      expect(capturedOptions.value!.nojekyll).toBe(true);
      // notfound is internal (404.html creation by angular-cli-ghpages)
      expect(capturedOptions.value!.notfound).toBeUndefined();
    });
  });

  describe('String parameter passthrough (complete flow)', () => {
    it('should pass repo through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const options: Schema = { repo, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.repo).toBe(repo);
    });

    it('should pass branch through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const branch = 'production';
      const options: Schema = { repo, branch, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.branch).toBe(branch);
    });

    it('should pass message through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const message = 'Custom deployment message';
      const options: Schema = { repo, message, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.message).toBe(message);
    });

    it('should transform name and email into user object in complete flow', async () => {
      const repo = 'https://github.com/test/repo.git';
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      const expectedUser = { name, email };
      const options: Schema = { repo, name, email, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.user).toEqual(expectedUser);
    });

    it('should pass cname to gh-pages v6+ (delegated to gh-pages)', async () => {
      const repo = 'https://github.com/test/repo.git';
      const cname = 'example.com';
      const options: Schema = { repo, cname, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      // cname IS now passed to gh-pages v6+ (delegated file creation)
      expect(capturedOptions.value!.cname).toBe(cname);
    });
  });

  describe('Boolean parameter passthrough (non-negated)', () => {
    it('should pass add flag through complete flow unchanged', async () => {
      const repo = 'https://github.com/test/repo.git';
      const add = true;
      const options: Schema = { repo, add, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      expect(capturedOptions.value).not.toBeNull();
      expect(capturedOptions.value!.add).toBe(add);
    });

    it('should not call gh-pages.publish when dryRun is true', async () => {
      // Reset mock to clear calls from previous tests
      vi.mocked(ghPagesModule.publish).mockClear();

      const repo = 'https://github.com/test/repo.git';
      const options: Schema = { repo, dryRun: true, noBuild: true };

      await deploy(engine, context, BUILD_TARGET, options);

      // Verify publish was not called in this test
      expect(ghPagesModule.publish).not.toHaveBeenCalled();
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

      expect(capturedOptions.value).not.toBeNull();

      // Verify passthrough parameters
      expect(capturedOptions.value!.repo).toBe(repo);
      expect(capturedOptions.value!.remote).toBe(remote);
      expect(capturedOptions.value!.branch).toBe(branch);
      expect(capturedOptions.value!.message).toBe(message);
      expect(capturedOptions.value!.add).toBe(add);

      // cname and nojekyll ARE passed to gh-pages v6+ (delegated)
      expect(capturedOptions.value!.cname).toBe(cname);
      expect(capturedOptions.value!.nojekyll).toBe(false);

      // notfound is internal (404.html creation by angular-cli-ghpages)
      expect(capturedOptions.value!.notfound).toBeUndefined();

      // Negated options should NOT be passed
      expect(capturedOptions.value!.noDotfiles).toBeUndefined();
      expect(capturedOptions.value!.noNotfound).toBeUndefined();
      expect(capturedOptions.value!.noNojekyll).toBeUndefined();
      expect(capturedOptions.value!.name).toBeUndefined();
      expect(capturedOptions.value!.email).toBeUndefined();

      // Verify user object transformation
      expect(capturedOptions.value!.user).toEqual({ name, email });

      // Verify boolean negation transformations
      expect(capturedOptions.value!.dotfiles).toBe(false);

      // Verify engine defaults are set
      expect(capturedOptions.value!.git).toBe('git');
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
