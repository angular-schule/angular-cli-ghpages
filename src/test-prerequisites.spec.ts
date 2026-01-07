import { execSync } from 'child_process';

/**
 * TEST PREREQUISITES VALIDATION
 *
 * This test suite validates that the required development environment
 * is correctly set up. These tests intentionally FAIL LOUDLY with clear
 * instructions rather than skipping silently.
 *
 * angular-cli-ghpages is built on top of git. Without git, nothing works.
 */

describe('Test Prerequisites', () => {
  const projectRoot = process.cwd();

  describe('Git availability', () => {
    let gitVersion: string;

    it('must have git executable available on PATH', () => {
      try {
        gitVersion = execSync('git --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
      } catch (error) {
        throw new Error(
          '\n\n' +
            '====================================================================\n' +
            '  PREREQUISITE FAILURE: Git is not installed or not on PATH\n' +
            '====================================================================\n' +
            '\n' +
            'angular-cli-ghpages is built on top of git.\n' +
            'Tests cannot run without git being available.\n' +
            '\n' +
            'To fix this:\n' +
            '\n' +
            '  macOS:\n' +
            '    brew install git\n' +
            '    # or install Xcode Command Line Tools:\n' +
            '    xcode-select --install\n' +
            '\n' +
            '  Ubuntu/Debian:\n' +
            '    sudo apt-get update\n' +
            '    sudo apt-get install git\n' +
            '\n' +
            '  Windows:\n' +
            '    Download from https://git-scm.com/download/win\n' +
            '    # or use winget:\n' +
            '    winget install Git.Git\n' +
            '\n' +
            '  Verify installation:\n' +
            '    git --version\n' +
            '\n' +
            '====================================================================\n'
        );
      }

      // If we got here, git is available
      expect(gitVersion).toMatch(/^git version/);
    });

    it('must be running in a git repository', () => {
      // Only run if git is available (previous test passed)
      let gitDir: string;

      try {
        gitDir = execSync('git rev-parse --git-dir', {
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: projectRoot
        }).trim();
      } catch (error) {
        throw new Error(
          '\n\n' +
            '====================================================================\n' +
            '  PREREQUISITE FAILURE: Not running in a git repository\n' +
            '====================================================================\n' +
            '\n' +
            'angular-cli-ghpages tests must run within a git repository.\n' +
            '\n' +
            'Current directory:\n' +
            `  ${projectRoot}\n` +
            '\n' +
            'To fix this:\n' +
            '\n' +
            '  If you cloned this repository:\n' +
            '    # Ensure you are in the correct directory\n' +
            `    cd ${projectRoot}\n` +
            '    git status\n' +
            '\n' +
            '  If you downloaded as ZIP:\n' +
            '    # Clone the repository instead:\n' +
            '    git clone https://github.com/angular-schule/angular-cli-ghpages.git\n' +
            '    cd angular-cli-ghpages\n' +
            '\n' +
            '  If git was initialized but corrupted:\n' +
            '    # Check if .git directory exists:\n' +
            '    ls -la .git\n' +
            '    # If corrupted, re-clone the repository\n' +
            '\n' +
            '====================================================================\n'
        );
      }

      // If we got here, we are in a git repository
      expect(gitDir.length).toBeGreaterThan(0);
    });

    it('must have origin remote configured', () => {
      // Only run if git is available and we are in a repo (previous tests passed)
      let remoteUrl: string;

      try {
        remoteUrl = execSync('git config --get remote.origin.url', {
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: projectRoot
        }).trim();
      } catch (error) {
        throw new Error(
          '\n\n' +
            '====================================================================\n' +
            '  PREREQUISITE FAILURE: No origin remote configured\n' +
            '====================================================================\n' +
            '\n' +
            'angular-cli-ghpages tests expect a git origin remote to be configured.\n' +
            '\n' +
            'To fix this:\n' +
            '\n' +
            '  Add the origin remote:\n' +
            '    git remote add origin https://github.com/angular-schule/angular-cli-ghpages.git\n' +
            '\n' +
            '  Verify it was added:\n' +
            '    git remote -v\n' +
            '\n' +
            '  If origin exists but is misconfigured:\n' +
            '    # View current remotes:\n' +
            '    git remote -v\n' +
            '\n' +
            '    # Update origin URL:\n' +
            '    git remote set-url origin https://github.com/angular-schule/angular-cli-ghpages.git\n' +
            '\n' +
            '  Expected origin:\n' +
            '    https://github.com/angular-schule/angular-cli-ghpages.git\n' +
            '    or\n' +
            '    git@github.com:angular-schule/angular-cli-ghpages.git\n' +
            '\n' +
            '====================================================================\n'
        );
      }

      // If we got here, origin is configured
      expect(remoteUrl.length).toBeGreaterThan(0);
      // Verify it looks like a valid git URL (either HTTPS or SSH)
      expect(remoteUrl).toMatch(/^(https?:\/\/|git@)/);
    });
  });

});
