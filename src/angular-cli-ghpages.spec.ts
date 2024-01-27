import path from 'path';
import fs from 'fs';

import { execSync } from 'child_process';


function runCliWithArgs(args) {

  const distFolder = path.resolve(__dirname, 'dist');

  if (!fs.existsSync(distFolder)) {
    throw new Error(`Dist directory ${distFolder} not found. Can't execute test! The directory must exist from the last build.`);
  }
  const program = path.resolve(__dirname, 'dist/angular-cli-ghpages');
  return execSync(`node ${program} --dry-run ${args}`).toString();
}

describe('Commander CLI options', () => {

  test('should set dotfiles, notfound, and nojekyll to `true` by default', () => {
    const output = runCliWithArgs('');
    expect(output).toContain(`"dotfiles": "files starting with dot ('.') will be included"`);
    expect(output).toContain('"notfound": "a 404.html file will be created"');
    expect(output).toContain('"nojekyll": "a .nojekyll file will be created"');
  });

  test('should set dotfiles, notfound, and nojekyll to `false` with no- flags', () => {
    const output = runCliWithArgs('--no-dotfiles --no-notfound --no-nojekyll');
    expect(output).toMatch(`"dotfiles": "files starting with dot ('.') will be ignored"`);
    expect(output).toMatch('"notfound": "a 404.html file will NOT be created"');
    expect(output).toMatch('"nojekyll": "a .nojekyll file will NOT be created"');
  });
});
