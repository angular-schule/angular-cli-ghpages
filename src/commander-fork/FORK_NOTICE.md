# Commander Fork Notice

## What We Did

We forked commander v3.0.2 and stripped it down from **1332 lines** to **744 lines** (~44% reduction).

### Removed Features (~588 lines)

1. **Subcommands** - `.command()` with action handlers
2. **Git-style executable subcommands** - `executeSubCommand()`, child_process.spawn
3. **Action handlers** - `.action()` method
4. **Argument parsing** - `.arguments()`, `.parseExpectedArgs()`
5. **Complex command hierarchy** - parent/child commands, aliases
6. **Inspector port incrementing** - `incrementNodeInspectorPort()`
7. **File existence checks** - `exists()` helper (only used for executables)
8. **Command help** - `.commandHelp()`, `.prepareCommands()`
9. **Variadic arguments** - `.variadicArgNotLast()`
10. **Missing argument errors** - `.missingArgument()` (we don't use positional args)

### Removed Dependencies

- ❌ `child_process` (spawn) - only needed for executable subcommands
- ❌ `fs` - only needed for checking executable file existence
- ❌ `path.dirname` - only needed for finding executable paths

### Kept Dependencies (Built-ins)

- ✅ `events.EventEmitter` - needed for option parsing event system
- ✅ `util.inherits` - needed to extend EventEmitter
- ✅ `path.basename` - needed for guessing command name from argv[1]

## What We Kept

### Core Methods

- `.version(str, flags?, description?)` - Auto-register version flag
- `.description(str)` - Set command description
- `.option(flags, description, fn?, defaultValue?)` - **THE MOST IMPORTANT METHOD**
- `.parse(argv)` - Parse command-line arguments
- `.opts()` - Get parsed options as object
- `.usage(str?)` - Get/set usage string
- `.name(str?)` - Get/set command name
- `.allowUnknownOption(arg?)` - Allow unknown flags
- `.help(cb?)` - Output help and exit
- `.outputHelp(cb?)` - Output help without exiting
- `.helpOption(flags, description)` - Customize help flags

### Critical Behavior Preserved

**The `--no-` prefix handling** - This is why we forked!

```javascript
.option('--no-dotfiles', 'Exclude dotfiles')

// Without flag:    program.dotfiles === true  (implicit default!)
// With --no-dotfiles:  program.dotfiles === false
```

In commander v9+, this requires explicit defaults. We're freezing v3 behavior.

### Option Parsing Features

- ✅ Short flags (`-d`)
- ✅ Long flags (`--dir`)
- ✅ Required arguments (`--dir <path>`)
- ✅ Optional arguments (`--file [path]`)
- ✅ Boolean flags (`--verbose`)
- ✅ Negatable flags (`--no-dotfiles`)
- ✅ Default values
- ✅ Custom coercion functions
- ✅ Argument normalization (`-abc` → `-a -b -c`)
- ✅ Equal sign support (`--foo=bar` → `--foo bar`)
- ✅ Concatenated short options (`-d80` → `-d 80`)
- ✅ Argument terminator (`--`)
- ✅ Property access (`program.dir` after parse)

### Help System

- ✅ Auto-generated `--help` output
- ✅ Option listing with descriptions
- ✅ Default value display
- ✅ Custom help callback support

## File Size Comparison

| Version | Lines | Size | Change |
|---------|-------|------|--------|
| Original v3.0.2 | 1332 | 32KB | - |
| Commander-fork | 744 | 17KB | **-47% lines, -47% size** |

## Why We Forked

Commander v4-v14 introduced many breaking changes:

1. **v9.0.0** - Boolean option default values behavior changed
2. **v9.0.0** - Option property names now match flag casing exactly
3. **v9.0.0** - Excess arguments now error by default
4. **v12.0.0** - Default export removed (must use named import)

Each of these would break existing user scripts. Rather than force users to adapt, we froze v3.0.2 behavior permanently.

## Maintenance Plan

This fork is **FROZEN**. We will only update for:

1. **Critical security vulnerabilities**
2. **Bugs that affect angular-cli-ghpages**
3. **Node.js compatibility issues**

For any fixes:
- Update `commander-fork/index.js`
- Add test in `commander-fork/__tests__/`
- Bump version: `3.0.2-fork.1` → `3.0.2-fork.2`
- Document the fix here

## Testing

We maintain test coverage for our usage patterns:

- ✅ All option types (boolean, required, optional, negatable)
- ✅ Short and long flags
- ✅ Default value handling
- ✅ `--no-` prefix behavior (critical!)
- ✅ Version flag
- ✅ Help output
- ✅ Property access after parsing
- ✅ Unknown option errors

## License

MIT License - same as original commander.js

Original work Copyright (c) 2011 TJ Holowaychuk
Modified work Copyright (c) 2025 angular-cli-ghpages contributors

See LICENSE file for full text.

## Credits

Huge thanks to TJ Holowaychuk and all commander.js contributors for creating this excellent library. This fork exists only to preserve specific v3 behavior for our narrow use case.

Original project: https://github.com/tj/commander.js
