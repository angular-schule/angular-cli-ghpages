# Commander Fork

Minimal fork of commander v3.0.2 for angular-cli-ghpages.

## Why Fork?

Commander v4+ introduced breaking changes that would break user scripts:
- v9: Boolean option default values changed (breaks `--no-dotfiles` behavior)
- v9: Option casing enforcement (breaks mixed-case scripts)
- v9: Excess arguments now error by default (breaks flexible scripts)
- v12: Default export removed (breaks `require('commander')`)

Rather than adapt to this ever-changing dependency and potentially break user workflows, we decided to fork commander v3.0.2 and freeze its behavior permanently.

## What This Fork Contains

### Features Kept ✅

- `.version(str, flags?, description?)` - Set version and auto-register `-V, --version`
- `.description(str)` - Set command description
- `.option(flags, description, fn?, defaultValue?)` - Define options with `--no-` prefix support
- `.parse(argv)` - Parse command-line arguments
- `.opts()` - Get parsed options as object
- Property access (e.g., `program.dir`, `program.repo`)
- Basic `--help` output
- Error handling for unknown options and missing arguments

### Features Removed ❌

- Subcommands (`.command()` with action handlers)
- Git-style executable subcommands
- Action handlers (`.action()`)
- Argument definitions (`.arguments()`)
- Advanced help customization
- Custom event listeners
- Most EventEmitter functionality

### What Was Stripped

Original commander v3.0.2:
- **1332 lines** of code
- **~32KB** file size

Commander-fork:
- **~600-700 lines** of code (estimated)
- **~15-20KB** file size (estimated)
- **Removed ~50%** of the codebase

## Usage

```javascript
// In angular-cli-ghpages
const commander = require('./commander-fork');

commander
  .version('2.0.0')
  .description('Deploy Angular app to GitHub Pages')
  .option('-d, --dir <dir>', 'Base directory', 'dist/browser')
  .option('-r, --repo <repo>', 'Repository URL')
  .option('--no-dotfiles', 'Exclude dotfiles')
  .parse(process.argv);

console.log(commander.dir);      // Access parsed option
console.log(commander.repo);     // Access parsed option
console.log(commander.dotfiles); // false if --no-dotfiles was used
```

## Key Behavior Preserved

### `--no-` Prefix Handling

This is the CRITICAL behavior we're preserving from v3:

```javascript
.option('--no-dotfiles', 'Exclude dotfiles')

// Without flag:    commander.dotfiles === true  (implicit default)
// With --no-dotfiles:  commander.dotfiles === false
```

In commander v9+, this behavior changed to require explicit defaults, which would break our CLI.

### Implicit Defaults for Boolean Flags

When you define `--no-foo`, commander v3 automatically sets the default to `true`. This is the behavior we're freezing.

## Maintenance

This fork is **FROZEN** - we will NOT update it unless:
1. A critical security vulnerability is found
2. A bug is discovered that affects angular-cli-ghpages
3. Node.js changes break compatibility

For any fixes:
1. Update `commander-fork/index.js`
2. Add test in `commander-fork/__tests__/`
3. Bump version to `3.0.2-fork.2`, etc.
4. Document in `FORK_NOTICE.md`

## License

MIT License

Original work Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
Modified work Copyright (c) 2025 angular-cli-ghpages contributors

See LICENSE file for full text.

## Original Project

This is a stripped-down fork of:
- **Repository**: https://github.com/tj/commander.js
- **Version**: v3.0.2
- **License**: MIT
- **Original Author**: TJ Holowaychuk

We are grateful for the original commander.js project and this fork exists only to preserve specific v3 behavior for our use case.
