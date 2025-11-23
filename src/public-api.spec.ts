/**
 * Tests for public API exports
 *
 * Verifies that all public types and functions are correctly exported
 * and accessible to consumers of angular-cli-ghpages.
 */

import * as publicApi from './public_api';

describe('Public API', () => {
  describe('Schema and Options Types', () => {
    it('should allow creating DeployUser objects with correct type', () => {
      // DeployUser is a type, we verify it compiles and works correctly
      const user: publicApi.DeployUser = {
        name: 'Test User',
        email: 'test@example.com'
      };
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
    });

    it('should allow creating AngularOutputPath with string variant', () => {
      const outputPath: publicApi.AngularOutputPath = '/dist/my-app';
      expect(typeof outputPath).toBe('string');
      expect(outputPath).toBe('/dist/my-app');
    });

    it('should allow creating AngularOutputPath with object variant', () => {
      const outputPath: publicApi.AngularOutputPath = {
        base: '/dist',
        browser: 'my-app'
      };
      expect(outputPath.base).toBe('/dist');
      expect(outputPath.browser).toBe('my-app');
    });

    it('should allow creating AngularOutputPathObject', () => {
      const outputPath: publicApi.AngularOutputPathObject = {
        base: '/dist',
        browser: 'browser'
      };
      expect(outputPath.base).toBe('/dist');
      expect(outputPath.browser).toBe('browser');
    });

    it('should export isOutputPathObject type guard function', () => {
      expect(typeof publicApi.isOutputPathObject).toBe('function');

      const stringPath = '/dist/app';
      const objectPath = { base: '/dist', browser: 'app' };

      expect(publicApi.isOutputPathObject(stringPath)).toBe(false);
      expect(publicApi.isOutputPathObject(objectPath)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should export defaults object', () => {
      expect(publicApi.defaults).toBeDefined();
      expect(typeof publicApi.defaults).toBe('object');
    });

    it('should have expected default values', () => {
      expect(publicApi.defaults.dir).toBe('dist');
      expect(publicApi.defaults.branch).toBe('gh-pages');
      expect(publicApi.defaults.remote).toBe('origin');
      expect(publicApi.defaults.dotfiles).toBe(true);
      expect(publicApi.defaults.notfound).toBe(true);
      expect(publicApi.defaults.nojekyll).toBe(true);
    });
  });

  describe('Core Deployment Functions', () => {
    it('should export deployToGHPages function', () => {
      expect(typeof publicApi.deployToGHPages).toBe('function');
    });

    it('should export angularDeploy function', () => {
      expect(typeof publicApi.angularDeploy).toBe('function');
    });
  });

  describe('Advanced Option Processing Functions', () => {
    it('should export setupMonkeypatch function', () => {
      expect(typeof publicApi.setupMonkeypatch).toBe('function');
    });

    it('should export mapNegatedBooleans function', () => {
      expect(typeof publicApi.mapNegatedBooleans).toBe('function');
    });

    it('should export handleUserCredentials function', () => {
      expect(typeof publicApi.handleUserCredentials).toBe('function');
    });

    it('should export warnDeprecatedParameters function', () => {
      expect(typeof publicApi.warnDeprecatedParameters).toBe('function');
    });

    it('should export appendCIMetadata function', () => {
      expect(typeof publicApi.appendCIMetadata).toBe('function');
    });

    it('should export injectTokenIntoRepoUrl function', () => {
      expect(typeof publicApi.injectTokenIntoRepoUrl).toBe('function');
    });

    it('should export prepareOptions function', () => {
      expect(typeof publicApi.prepareOptions).toBe('function');
    });
  });

  describe('Example Usage', () => {
    it('should allow users to create custom options with defaults', () => {
      const customOptions = {
        ...publicApi.defaults,
        dir: 'custom/dist',
        message: 'Custom deployment message',
        cname: 'example.com'
      };

      expect(customOptions.dir).toBe('custom/dist');
      expect(customOptions.branch).toBe('gh-pages');
      expect(customOptions.message).toBe('Custom deployment message');
      expect(customOptions.cname).toBe('example.com');
    });

    it('should allow type-safe user credentials', () => {
      const user: publicApi.DeployUser = {
        name: 'CI Bot',
        email: 'ci@example.com'
      };

      const options = {
        ...publicApi.defaults,
        name: user.name,
        email: user.email
      };

      expect(options.name).toBe('CI Bot');
      expect(options.email).toBe('ci@example.com');
    });
  });
});
