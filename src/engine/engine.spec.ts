import * as engine from './engine';
import { NullLogger } from '@angular-devkit/core/src/logger';

describe('engine', () => {
  describe('prepareOptions', () => {

    it('should replace the string GH_TOKEN in the repo url (for backwards compatibility)', () => {
      const options = {
        repo: 'https://GH_TOKEN@github.com/organisation/your-repo.git'
      }
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = engine.prepareOptions(options, new NullLogger())

      expect(finalOptions.repo).toBe('https://XXX@github.com/organisation/your-repo.git');
    });

    it('should add a GH_TOKEN to the repo url', () => {
      const options = {
        repo: 'https://github.com/organisation/your-repo.git'
      }
      process.env.GH_TOKEN = 'XXX';
      const finalOptions = engine.prepareOptions(options, new NullLogger())

      expect(finalOptions.repo).toBe('https://XXX@github.com/organisation/your-repo.git');
    });
  });
});
