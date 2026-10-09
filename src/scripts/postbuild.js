// Copies the non-TypeScript files of the package into dist/.
// Paths are relative to src/ and keep their directory structure in dist/.
const fs = require('fs');
const path = require('path');

const files = [
  'builders.json',
  'collection.json',
  'ng-add-schema.json',
  'package.json',
  'angular-cli-ghpages',
  'deploy/schema.json',
  'commander-fork/index.js'
];

for (const file of files) {
  copy(file, path.join('dist', file));
}
copy('../README.md', 'dist/README.md');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
