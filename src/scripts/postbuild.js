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
  'deploy/schema.d.ts',
  'commander-fork/index.js',
  'commander-fork/LICENSE',
  'gh-pages-fork/LICENSE'
];

for (const file of files) {
  copy(file, path.join('dist', file));
}

// These live in the repository root, outside src/
copy('../README.md', 'dist/README.md');
copy('../LICENSE', 'dist/LICENSE');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
