import { logging } from '@angular-devkit/core';

import * as engine from './engine';

describe('engine', () => {
  describe('prepareOptions', () => {
    const logger = new logging.NullLogger();

    beforeEach(() => {
      process.env = {};
    });

    it('should replace the string GH_TOKEN in the repo url (for backwards compatibility)', async () => {
      const options = {
        repo: 'https://GH_TOKEN@github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://XXX@github.com/organisation/your-repo.git'
      );
    });

    // see https://github.com/EdricChan03/rss-reader/commit/837dc10c18bfa453c586bb564a662e7dad1e68ab#r36665276 as an example
    it('should be possible to use GH_TOKEN in repo url as a workaround for other tokens (for backwards compatibility)', async () => {
      const options = {
        repo:
          'https://x-access-token:GH_TOKEN@github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    // ----

    it('should also add a personal access token (GH_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    it('should also add a personal access token (PERSONAL_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.PERSONAL_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    it('should also add a installation access token (GITHUB_TOKEN) to the repo url', async () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      };
      process.env.GITHUB_TOKEN = 'XXX';
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toBe(
        'https://x-access-token:XXX@github.com/organisation/your-repo.git'
      );
    });

    // NEW in 0.6.2: always discover remote URL (if not set)
    // this allows us to inject tokens from environment even if --repo is not set manually
    // it uses gh-pages lib directly for this
    it('should discover the remote url, if no --repo is set', async () => {
      const options = {};
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.repo).toMatch(/angular-schule\/angular-cli-ghpages/);
    });

    describe('remote', () => {
      it('should use the provided remote if --remote is set', async () => {
        const options = { remote: 'foobar', repo: 'xxx' };
        const finalOptions = await engine.prepareOptions(options, logger);

        expect(finalOptions.remote).toBe('foobar');
      });

      it('should use the origin remote if --remote is not set', async () => {
        const options = { repo: 'xxx' };
        const finalOptions = await engine.prepareOptions(options, logger);

        expect(finalOptions.remote).toBe('origin');
      });
    });
  });

  describe('prepareOptions - handling dotfiles, notfound, and nojekyll', () => {
    const logger = new logging.NullLogger();

    it('should set dotfiles, notfound, and nojekyll to false when no- flags are given', async () => {
      const options = {
        noDotfiles: true,
        noNotfound: true,
        noNojekyll: true
      };
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(false);
      expect(finalOptions.notfound).toBe(false);
      expect(finalOptions.nojekyll).toBe(false);
    });

    it('should set dotfiles, notfound, and nojekyll to true when no- flags are not given', async () => {
      const options = {};
      const finalOptions = await engine.prepareOptions(options, logger);

      expect(finalOptions.dotfiles).toBe(true);
      expect(finalOptions.notfound).toBe(true);
      expect(finalOptions.nojekyll).toBe(true);
    });
  });
});
