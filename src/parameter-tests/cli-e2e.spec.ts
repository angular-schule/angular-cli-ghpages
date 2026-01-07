import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

/**
 * END-TO-END CLI TESTS
 *
 * Tests the standalone CLI (angular-cli-ghpages script) to ensure
 * commander.js correctly parses all arguments and passes them to the engine.
 *
 * These tests are CRITICAL for detecting commander.js version regressions.
 */

interface DryRunOutput {
  dir: string;
  repo?: string;
  remote?: string;
  branch?: string;
  message?: string;
  name?: string;
  email?: string;
  dotfiles?: string;
  notfound?: string;
  nojekyll?: string;
  cname?: string;
  add?: string;
}

function runCli(args: string): string {
  const distFolder = path.resolve(__dirname, '../dist');

  if (!fs.existsSync(distFolder)) {
    throw new Error(`Dist directory ${distFolder} not found. Run npm run build first.`);
  }

  const program = path.resolve(__dirname, '../dist/angular-cli-ghpages');
  // Clear CI environment variables to ensure consistent test behavior across environments
  const env = { ...process.env };
  delete env.TRAVIS;
  delete env.CIRCLECI;
  delete env.GITHUB_ACTIONS;

  return execSync(`node ${program} --dry-run ${args}`, { env }).toString();
}

function parseJsonFromCliOutput(output: string): DryRunOutput {
  // Extract the JSON object from the dry-run output
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not find JSON in CLI output. Output was:\n${output.substring(0, 500)}`);
  }
  try {
    return JSON.parse(jsonMatch[0]) as DryRunOutput;
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(`Failed to parse JSON from CLI output: ${errorMessage}\nJSON string: ${jsonMatch[0].substring(0, 200)}`);
  }
}

describe('CLI End-to-End Tests', () => {
  describe('Basic parameter passing', () => {
    it('should pass dir parameter', () => {
      const dir = 'dist';
      const expectedDir = path.resolve(__dirname, '..', dir);
      const output = runCli(`--dir=${dir}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.dir).toBe(expectedDir);
    });

    it('should pass repo parameter', () => {
      const repo = 'https://github.com/test/repo.git';
      const output = runCli(`--repo=${repo}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.repo).toBe(repo);
    });

    it('should pass remote parameter with repo', () => {
      const repo = 'https://github.com/test/repo.git';
      const remote = 'upstream';
      const output = runCli(`--repo=${repo} --remote=${remote}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.remote).toBe(remote);
    });

    it('should pass message parameter with quotes', () => {
      const message = 'Custom deploy message';
      const output = runCli(`--message="${message}"`);
      const json = parseJsonFromCliOutput(output);

      expect(json.message).toBe(message);
    });

    it('should pass branch parameter', () => {
      const branch = 'production';
      const output = runCli(`--branch=${branch}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.branch).toBe(branch);
    });

    // Note: name and email must BOTH be provided together to create user object
    it('should pass name and email parameters together', () => {
      const name = 'Deploy Bot';
      const email = 'bot@example.com';
      const expectedNameMessage = `the name '${name}' will be used for the commit`;
      const expectedEmailMessage = `the email '${email}' will be used for the commit`;

      const output = runCli(`--name="${name}" --email=${email}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.name).toBe(expectedNameMessage);
      expect(json.email).toBe(expectedEmailMessage);
    });

    it('should pass cname parameter', () => {
      const cname = 'example.com';
      const expectedMessage = `a CNAME file with the content '${cname}' will be created`;
      const output = runCli(`--cname=${cname}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.cname).toBe(expectedMessage);
    });

    it('should pass add flag', () => {
      const expectedMessage = 'all files will be added to the branch. Existing files will not be removed';
      const output = runCli('--add');
      const json = parseJsonFromCliOutput(output);

      expect(json.add).toBe(expectedMessage);
    });
  });

  describe('Boolean flags with --no- prefix', () => {
    it('should handle --no-dotfiles flag', () => {
      const expectedDotfiles = "files starting with dot ('.') will be ignored";
      const output = runCli('--no-dotfiles');
      const json = parseJsonFromCliOutput(output);

      expect(json.dotfiles).toBe(expectedDotfiles);
    });

    it('should handle --no-notfound flag', () => {
      const expectedNotfound = 'a 404.html file will NOT be created';
      const output = runCli('--no-notfound');
      const json = parseJsonFromCliOutput(output);

      expect(json.notfound).toBe(expectedNotfound);
    });

    it('should handle --no-nojekyll flag', () => {
      const expectedNojekyll = 'a .nojekyll file will NOT be created';
      const output = runCli('--no-nojekyll');
      const json = parseJsonFromCliOutput(output);

      expect(json.nojekyll).toBe(expectedNojekyll);
    });

    it('should handle all three --no- flags together', () => {
      const expectedDotfiles = "files starting with dot ('.') will be ignored";
      const expectedNotfound = 'a 404.html file will NOT be created';
      const expectedNojekyll = 'a .nojekyll file will NOT be created';

      const output = runCli('--no-dotfiles --no-notfound --no-nojekyll');
      const json = parseJsonFromCliOutput(output);

      expect(json.dotfiles).toBe(expectedDotfiles);
      expect(json.notfound).toBe(expectedNotfound);
      expect(json.nojekyll).toBe(expectedNojekyll);
    });
  });

  describe('Multiple parameters combined', () => {
    it('should handle multiple parameters correctly', () => {
      const dir = 'dist';
      const repo = 'https://github.com/test/repo.git';
      const branch = 'main';
      const message = 'Deploy to main';
      const expectedDir = path.resolve(__dirname, '..', dir);

      const output = runCli(`--dir=${dir} --repo=${repo} --branch=${branch} --message="${message}"`);
      const json = parseJsonFromCliOutput(output);

      expect(json.dir).toBe(expectedDir);
      expect(json.repo).toBe(repo);
      expect(json.branch).toBe(branch);
      expect(json.message).toBe(message);
    });

    it('should handle all parameters at once', () => {
      const dir = 'dist';
      const repo = 'https://github.com/test/repo.git';
      const remote = 'upstream';
      const branch = 'production';
      const message = 'Full deploy';
      const name = 'Bot';
      const email = 'bot@test.com';
      const cname = 'test.com';
      const expectedDir = path.resolve(__dirname, '..', dir);
      const expectedNameMessage = `the name '${name}' will be used for the commit`;
      const expectedEmailMessage = `the email '${email}' will be used for the commit`;
      const expectedCnameMessage = `a CNAME file with the content '${cname}' will be created`;
      const expectedAddMessage = 'all files will be added to the branch. Existing files will not be removed';
      const expectedDotfiles = "files starting with dot ('.') will be ignored";
      const expectedNotfound = 'a 404.html file will NOT be created';
      const expectedNojekyll = 'a .nojekyll file will NOT be created';

      const output = runCli(
        `--dir=${dir} ` +
        `--repo=${repo} ` +
        `--remote=${remote} ` +
        `--branch=${branch} ` +
        `--message="${message}" ` +
        `--name="${name}" ` +
        `--email=${email} ` +
        `--cname=${cname} ` +
        `--add ` +
        `--no-dotfiles ` +
        `--no-notfound ` +
        `--no-nojekyll`
      );
      const json = parseJsonFromCliOutput(output);

      expect(json.dir).toBe(expectedDir);
      expect(json.repo).toBe(repo);
      expect(json.remote).toBe(remote);
      expect(json.branch).toBe(branch);
      expect(json.message).toBe(message);
      expect(json.name).toBe(expectedNameMessage);
      expect(json.email).toBe(expectedEmailMessage);
      expect(json.cname).toBe(expectedCnameMessage);
      expect(json.add).toBe(expectedAddMessage);
      expect(json.dotfiles).toBe(expectedDotfiles);
      expect(json.notfound).toBe(expectedNotfound);
      expect(json.nojekyll).toBe(expectedNojekyll);
    });
  });

  describe('Short flags', () => {
    it('should accept -d short flag for dir', () => {
      const dir = 'dist';
      const expectedDir = path.resolve(__dirname, '..', dir);
      const output = runCli(`-d ${dir}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.dir).toBe(expectedDir);
    });

    it('should accept -r short flag for repo', () => {
      const repo = 'https://github.com/test/short.git';
      const output = runCli(`-r ${repo}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.repo).toBe(repo);
    });

    it('should accept -m short flag for message', () => {
      const message = 'Short message';
      const output = runCli(`-m "${message}"`);
      const json = parseJsonFromCliOutput(output);

      expect(json.message).toBe(message);
    });

    it('should accept -b short flag for branch', () => {
      const branch = 'dev';
      const output = runCli(`-b ${branch}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.branch).toBe(branch);
    });

    // Note: name and email must BOTH be provided together
    it('should accept -n and -e short flags together', () => {
      const name = 'Short Name';
      const email = 'short@test.com';
      const expectedNameMessage = `the name '${name}' will be used for the commit`;
      const expectedEmailMessage = `the email '${email}' will be used for the commit`;

      const output = runCli(`-n "${name}" -e ${email}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.name).toBe(expectedNameMessage);
      expect(json.email).toBe(expectedEmailMessage);
    });

    it('should accept -c short flag for cname', () => {
      const cname = 'short.com';
      const expectedMessage = `a CNAME file with the content '${cname}' will be created`;
      const output = runCli(`-c ${cname}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.cname).toBe(expectedMessage);
    });

    it('should accept -a short flag for add', () => {
      const expectedMessage = 'all files will be added to the branch. Existing files will not be removed';
      const output = runCli('-a');
      const json = parseJsonFromCliOutput(output);

      expect(json.add).toBe(expectedMessage);
    });
  });

  describe('Parameter formats', () => {
    it('should handle --param=value format', () => {
      const branch = 'equals-format';
      const output = runCli(`--branch=${branch}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.branch).toBe(branch);
    });

    it('should handle --param value format', () => {
      const branch = 'space-format';
      const output = runCli(`--branch ${branch}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.branch).toBe(branch);
    });

    it('should handle message with spaces in quotes', () => {
      const message = 'Message with multiple spaces';
      const output = runCli(`--message="${message}"`);
      const json = parseJsonFromCliOutput(output);

      expect(json.message).toBe(message);
    });

    it('should handle message with single quotes', () => {
      const message = 'Single quoted message';
      const output = runCli(`--message='${message}'`);
      const json = parseJsonFromCliOutput(output);

      expect(json.message).toBe(message);
    });
  });

  describe('Special values', () => {
    it('should handle paths with slashes', () => {
      const dir = 'deploy';
      const expectedDir = path.resolve(__dirname, '..', dir);
      const output = runCli(`--dir=${dir}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.dir).toBe(expectedDir);
    });

    it('should handle URLs correctly', () => {
      const repo = 'https://github.com/org/repo-name.git';
      const output = runCli(`--repo=${repo}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.repo).toBe(repo);
    });

    it('should handle branch names with slashes', () => {
      const branch = 'feature/new-feature';
      const output = runCli(`--branch=${branch}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.branch).toBe(branch);
    });

    // Note: email must be provided with name
    it('should handle email with plus addressing', () => {
      const name = 'User';
      const email = 'user+deploy@example.com';
      const expectedNameMessage = `the name '${name}' will be used for the commit`;
      const expectedEmailMessage = `the email '${email}' will be used for the commit`;

      const output = runCli(`--name="${name}" --email=${email}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.name).toBe(expectedNameMessage);
      expect(json.email).toBe(expectedEmailMessage);
    });

    it('should handle subdomain in cname', () => {
      const cname = 'app.subdomain.example.com';
      const expectedMessage = `a CNAME file with the content '${cname}' will be created`;
      const output = runCli(`--cname=${cname}`);
      const json = parseJsonFromCliOutput(output);

      expect(json.cname).toBe(expectedMessage);
    });
  });
});
