// Removes dist/ so every build starts from a clean output directory,
// then generates deploy/schema.d.ts from deploy/schema.json (the source of truth for deploy options).
const fs = require('fs');
const { compileFromFile } = require('json-schema-to-typescript');

fs.rmSync('dist', { recursive: true, force: true });

compileFromFile('deploy/schema.json').then((ts) => {
  fs.writeFileSync('deploy/schema.d.ts', ts);
});
