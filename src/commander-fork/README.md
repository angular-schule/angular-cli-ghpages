# Commander Fork

**Minimal subset fork of commander v3.0.2 for angular-cli-ghpages.**

## 🚨 INTERNAL USE ONLY

**This fork exists SOLELY for angular-cli-ghpages and will NEVER be a general-purpose library.**

- ❌ NOT for public adoption or use by other projects
- ❌ NOT a community fork
- ❌ NO migration support or guidance
- ❌ NO feature requests accepted
- ✅ ONLY maintained for angular-cli-ghpages internal needs

**If you need commander.js, use the official upstream library:** https://github.com/tj/commander.js

---

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

- ❌ `program.command(name, description?)` - Not implemented
- ❌ `program.action(fn)` - Not implemented
- ❌ `program.arguments(desc)` - Not implemented
- ❌ Custom EventEmitter listeners beyond version/help - Not implemented
- ❌ `prog help` subcommand pattern - Not implemented (use `-h` or `--help` flags instead)

## Maintenance

**This fork is maintained EXCLUSIVELY for angular-cli-ghpages.**

This fork is **FROZEN** - we will NOT update it unless:
1. A critical security vulnerability is found that affects angular-cli-ghpages
2. A bug is discovered that affects angular-cli-ghpages functionality
3. Node.js changes break angular-cli-ghpages compatibility

**We do NOT accept:**
- Feature requests from other projects
- Pull requests for general commander features
- Issues from external users

For internal fixes (angular-cli-ghpages team only):
1. Update `commander-fork/index.js`
2. Add test in `commander-fork/test/`
3. Bump version to `3.0.2-fork.2`, etc.

## Original Project

This is a stripped-down fork of:
- **Repository**: https://github.com/tj/commander.js
- **Version**: v3.0.2
- **License**: MIT
- **Original Author**: TJ Holowaychuk

We are grateful for the original commander.js project and this fork exists only to preserve specific v3 behavior for our use case.
