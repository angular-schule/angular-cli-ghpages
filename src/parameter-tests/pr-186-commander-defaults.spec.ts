/**
 * PR #186 COMPATIBILITY TESTS: Commander Boolean Defaults
 *
 * Context from PR #186 analysis:
 * Commander v9+ changed how boolean --no- options handle default values, which would break our CLI.
 * Decision: We forked Commander v3 to avoid this breaking change. We will NEVER upgrade to v9+.
 *
 * Commander v3 behavior (what we use):
 * - --no-dotfiles automatically sets dotfiles: false
 * - Default is implicitly true (no explicit default needed)
 * - This is the behavior we rely on and have locked in via our fork
 *
 * Our Code (src/angular-cli-ghpages lines 56-67):
 * .option('-T, --no-dotfiles', 'Includes dotfiles by default...')
 * .option('--no-notfound', 'By default a 404.html file is created...')
 * .option('--no-nojekyll', 'By default a .nojekyll file is created...')
 *
 * Our Defaults (src/engine/defaults.ts):
 * dotfiles: true,   // Default should be true
 * notfound: true,   // Default should be true
 * nojekyll: true,   // Default should be true
 *
 * What these tests verify:
 * - Commander v3 (our fork) + defaults.ts work together correctly
 * - When no CLI option is passed, defaults.ts values are used
 * - When --no-dotfiles is passed, dotfiles becomes false
 * - When --no-notfound is passed, notfound becomes false
 * - When --no-nojekyll is passed, nojekyll becomes false
 *
 * These tests document current behavior and serve as regression tests.
 */

import { logging } from '@angular-devkit/core';

import * as engine from '../engine/engine';
import { cleanupMonkeypatch } from '../engine/engine.prepare-options-helpers';
import { defaults } from '../engine/defaults';

describe('PR #186 - Commander Boolean Defaults Compatibility', () => {
  let logger: logging.LoggerApi;

  beforeEach(() => {
    // Clean up any previous monkeypatch so each test starts fresh
    cleanupMonkeypatch();
    logger = new logging.NullLogger();
  });

  afterAll(() => {
    // Clean up monkeypatch after all tests
    cleanupMonkeypatch();
  });

  describe('defaults.ts values', () => {
    it('should have dotfiles: true as default', () => {
      expect(defaults.dotfiles).toBe(true);
    });

    it('should have notfound: true as default', () => {
      expect(defaults.notfound).toBe(true);
    });

    it('should have nojekyll: true as default', () => {
      expect(defaults.nojekyll).toBe(true);
    });
  });

  describe('prepareOptions - default value application', () => {
    it('should apply all defaults when no CLI options provided', async () => {
      const userOptions = {}; // User passed no options (typical: ng deploy)

      const result = await engine.prepareOptions(userOptions, logger);

      // CRITICAL: Must be true (from defaults.ts), not undefined!
      // If undefined: Files won't be created, breaking deployments:
      // - no .nojekyll → Jekyll processes files → breaks Angular app
      // - no 404.html → broken SPA routing on GitHub Pages
      // - no dotfiles → missing .htaccess, etc.
      expect(result.dotfiles).toBe(true);
      expect(result.notfound).toBe(true);
      expect(result.nojekyll).toBe(true);
    });

    it('should respect noDotfiles: true (negation) to set dotfiles: false', async () => {
      // User passed --no-dotfiles flag
      const userOptions = {
        noDotfiles: true // This means: disable dotfiles
      };

      const result = await engine.prepareOptions(userOptions, logger);

      // CRITICAL: Must be false (negated)
      expect(result.dotfiles).toBe(false);
      // Others remain at defaults
      expect(result.notfound).toBe(true);
      expect(result.nojekyll).toBe(true);
    });

    it('should respect noNotfound: true (negation) to set notfound: false', async () => {
      // User passed --no-notfound flag (common for Cloudflare Pages)
      const userOptions = {
        noNotfound: true // This means: disable 404.html creation
      };

      const result = await engine.prepareOptions(userOptions, logger);

      expect(result.notfound).toBe(false); // Negated
      expect(result.dotfiles).toBe(true); // Default
      expect(result.nojekyll).toBe(true); // Default
    });

    it('should respect noNojekyll: true (negation) to set nojekyll: false', async () => {
      // User passed --no-nojekyll flag (rare, but possible)
      const userOptions = {
        noNojekyll: true // This means: disable .nojekyll creation
      };

      const result = await engine.prepareOptions(userOptions, logger);

      expect(result.nojekyll).toBe(false); // Negated
      expect(result.dotfiles).toBe(true); // Default
      expect(result.notfound).toBe(true); // Default
    });

    it('should handle two negations simultaneously', async () => {
      // User passed --no-dotfiles --no-notfound
      const userOptions = {
        noDotfiles: true,
        noNotfound: true
      };

      const result = await engine.prepareOptions(userOptions, logger);

      expect(result.dotfiles).toBe(false); // Negated
      expect(result.notfound).toBe(false); // Negated
      expect(result.nojekyll).toBe(true); // Default
    });

    it('should handle all three negations simultaneously', async () => {
      // User passed --no-dotfiles --no-notfound --no-nojekyll
      const userOptions = {
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true
      };

      const result = await engine.prepareOptions(userOptions, logger);

      // All negated
      expect(result.dotfiles).toBe(false);
      expect(result.notfound).toBe(false);
      expect(result.nojekyll).toBe(false);
    });
  });

  /**
   * Regression tests: Ensure existing deployments continue to work
   *
   * Most users rely on default behavior (creating .nojekyll and 404.html).
   * These tests document critical default behavior that must never break:
   * - no .nojekyll = Jekyll processing breaks Angular app
   * - no 404.html = broken SPA routing on GitHub Pages
   */
  describe('Regression prevention', () => {
    it('should maintain default behavior for typical GitHub Pages deployment', async () => {
      // Typical user: ng deploy (no options)
      const userOptions = {};

      const result = await engine.prepareOptions(userOptions, logger);

      // CRITICAL: These MUST be true for typical GitHub Pages deployment
      // Prevents Jekyll processing that breaks Angular apps with _underscored files
      expect(result.nojekyll).toBe(true);
      // Enables SPA routing by copying index.html to 404.html
      expect(result.notfound).toBe(true);
      // Includes dotfiles like .htaccess if present
      expect(result.dotfiles).toBe(true);
    });

    it('should maintain default behavior for Cloudflare Pages deployment', async () => {
      // Cloudflare Pages user: ng deploy --no-notfound
      // (Cloudflare handles 404 routing differently, doesn't need 404.html)
      const userOptions = {
        noNotfound: true
      };

      const result = await engine.prepareOptions(userOptions, logger);

      expect(result.notfound).toBe(false); // User's explicit choice
      expect(result.nojekyll).toBe(true); // Still needed
      expect(result.dotfiles).toBe(true); // Still needed
    });
  });
});
