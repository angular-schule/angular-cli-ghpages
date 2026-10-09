// Removes dist/ so every build starts from a clean output directory.
const fs = require('fs');

fs.rmSync('dist', { recursive: true, force: true });
