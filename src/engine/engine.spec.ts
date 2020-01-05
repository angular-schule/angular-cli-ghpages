import { NullLogger } from '@angular-devkit/core/src/logger';

import * as engine from './engine';

describe('engine', () => {
  describe('prepareOptions', () => {
    const logger = new NullLogger();

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

    /*
    // i was not able to somehow catch an error... :-(
    it('should should throw an exception, if remote url could not be discovered', async () => {

      expect.assertions(1);

      const options = { git: 'xxx' };

      try {
        await engine.prepareOptions(options, logger);
      } catch (e) {
        expect(e).toBeTruthy();
      }
    })*/
  });
});
