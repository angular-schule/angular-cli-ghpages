# Commander Fork

**Minimal subset fork of commander v3.0.2 for angular-cli-ghpages.**

⚠️ **This is NOT a drop-in replacement for commander v3.0.2**
This fork intentionally removes features (subcommands, actions, etc.) and preserves only the option parsing functionality needed by angular-cli-ghpages.

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
- Custom event listeners (except version and help)
- Most EventEmitter functionality

## Compatibility Matrix

| Capability                  | Commander v3.0.2 | commander-fork |
| --------------------------- | ---------------: | -------------: |
| Options parsing             |                ✅ |             ✅ |
| Negated booleans (`--no-`)  |                ✅ |             ✅ |
| Version flag (`-V`)         |                ✅ |             ✅ |
| Help flag (`-h, --help`)    |                ✅ |             ✅ |
| Option coercion functions   |                ✅ |             ✅ |
| Regex validation            |                ✅ |             ✅ |
| `.opts()` method            |                ✅ |             ✅ |
| Subcommands (`.command()`)  |                ✅ |             ❌ |
| `.action()` handlers        |                ✅ |             ❌ |
| `.arguments()` definition   |                ✅ |             ❌ |
| Custom EventEmitter events  |                ✅ |             ❌ |

## Supported API Surface

### Methods You Can Use

- ✅ `program.version(str, flags?, description?)` - Set version
- ✅ `program.description(str)` - Set description
- ✅ `program.option(flags, description, fn?, defaultValue?)` - Define option
- ✅ `program.parse(argv)` - Parse arguments
- ✅ `program.opts()` - Get options object
- ✅ `program.name(str?)` - Get/set name
- ✅ `program.usage(str?)` - Get/set usage
- ✅ `program.help()` - Output help and exit
- ✅ `program.helpInformation()` - Get help text
- ✅ `program.helpOption(flags?, description?)` - Customize help
- ✅ `program.allowUnknownOption()` - Allow unknown options
- ✅ Property access: `program.foo`, `program.bar`

### Methods NOT Supported

- ❌ `program.command(name, description?)` - Use full commander for this
- ❌ `program.action(fn)` - Use full commander for this
- ❌ `program.arguments(desc)` - Use full commander for this
- ❌ Custom EventEmitter listeners beyond version/help

## Maintenance

This fork is **FROZEN** - we will NOT update it unless:
1. A critical security vulnerability is found
2. A bug is discovered that affects angular-cli-ghpages
3. Node.js changes break compatibility

For any fixes:
1. Update `commander-fork/index.js`
2. Add test in `commander-fork/__tests__/`
3. Bump version to `3.0.2-fork.2`, etc.

## Original Project

This is a stripped-down fork of:
- **Repository**: https://github.com/tj/commander.js
- **Version**: v3.0.2
- **License**: MIT
- **Original Author**: TJ Holowaychuk

We are grateful for the original commander.js project and this fork exists only to preserve specific v3 behavior for our use case.
