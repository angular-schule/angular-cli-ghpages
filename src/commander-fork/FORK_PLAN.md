# Commander v3 Fork Plan

## Executive Summary
Fork commander v3.0.2 into `commander-fork/` directory with minimal feature set (only what we use). Reduce from 1332 lines to ~500-700 lines, maintain zero dependencies, keep as JavaScript (not TypeScript).

## 1. Files to Copy (Minimal Set)

**COPY these files:**
- ✅ `LICENSE` → `commander-fork/LICENSE` (MIT license - REQUIRED)
- ✅ `index.js` → `commander-fork/index.js` (STRIPPED - see section 3)
- ✅ `package.json` → `commander-fork/package.json` (MODIFIED - see below)
- ✅ `typings/index.d.ts` → `commander-fork/index.d.ts` (STRIPPED to match our usage)

**SKIP these files:**
- ❌ `README.md` - create our own minimal one
- ❌ `CHANGELOG.md` - not needed, we're freezing behavior
- ❌ `examples/` - not needed
- ❌ `test/` - write our own minimal tests (see section 3)

**New package.json for fork:**
```json
{
  "name": "commander-fork",
  "version": "3.0.2-fork.1",
  "description": "Minimal commander v3.0.2 fork for angular-cli-ghpages",
  "main": "index.js",
  "typings": "index.d.ts",
  "license": "MIT",
  "dependencies": {},
  "private": true
}
```

## 2. JavaScript vs TypeScript Decision

**RECOMMENDATION: Keep as JavaScript (DO NOT convert to TypeScript)**

**Reasoning:**
- Original is JS (1332 lines) - less conversion work
- We're freezing behavior - no future development needed
- Smaller attack surface for bugs during conversion
- TypeScript typings (`.d.ts`) provide type safety anyway
- Faster to implement - just strip features vs convert entire codebase

## 3. Code Stripping Strategy

**Features to REMOVE from index.js (~800 lines):**

1. **Executable subcommands** (lines 510-600, ~500+ lines total)
   - `executeSubCommand()` method
   - `incrementNodeInspectorPort()` helper
   - spawn/child_process handling
   - **Impact**: Remove `child_process` import entirely

2. **Sub-command support** (lines 138-167, 186-229, ~200 lines)
   - `.command()` method (keep only for error if called)
   - `.arguments()` method
   - Action handlers (`.action()`)
   - Command hierarchy

3. **Advanced help customization** (lines 186-188, ~50 lines)
   - `.addImplicitHelpCommand()`
   - Custom help option configuration
   - **Keep**: Basic help output, `.helpInformation()`, `.outputHelp()`

4. **Event listener system** (lines 293-297, ~50 lines)
   - `.on('command:*')` handling
   - Custom command events
   - **Keep**: Basic option events for parsing

**Features to KEEP (~500-700 lines):**
- ✅ `.version()` - we use this
- ✅ `.description()` - we use this
- ✅ `.option()` - WE HEAVILY USE THIS
- ✅ `.parse()` - we use this
- ✅ `.opts()` - we may use this
- ✅ Option parsing (flags, defaults, --no- prefix)
- ✅ Property access (`commander.dir`, etc.)
- ✅ Basic help output (`--help`)
- ✅ Error handling (unknown options, missing arguments)

**Minimal index.js structure:**
```javascript
// Imports (remove child_process)
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var fs = require('fs');

// Option class (KEEP)
function Option(flags, description) { ... }

// Command class (STRIPPED)
function Command(name) {
  // Remove: commands array, _execs, sub-command support
  // Keep: options array, version, description, parsing
}

// Methods to KEEP:
Command.prototype.version = function(str, flags, description) { ... }
Command.prototype.description = function(str, argsDescription) { ... }
Command.prototype.option = function(flags, description, fn, defaultValue) { ... }
Command.prototype.parse = function(argv) { ... }
Command.prototype.parseOptions = function(argv) { ... }
Command.prototype.opts = function() { ... }
Command.prototype.help = function(cb) { ... }
Command.prototype.outputHelp = function(cb) { ... }
Command.prototype.helpInformation = function() { ... }

// Methods to REMOVE/STUB:
Command.prototype.command = function() {
  throw new Error('Subcommands not supported in fork');
}
Command.prototype.action = function() {
  throw new Error('Action handlers not supported in fork');
}

// Helpers (keep minimal set)
function camelcase(flag) { ... }
function pad(str, width) { ... }
```

## 4. Test Coverage Strategy

**RECOMMENDATION: Write our own minimal tests (NOT copy theirs)**

**Reasoning:**
- Their 62 test files use `should` framework (we use Jest)
- Most tests are for features we removed
- Better to test exactly our usage patterns
- Estimated: 5-10 test files vs their 62

**Test files to create:**
```
commander-fork/
  __tests__/
    option-parsing.spec.ts      # Test .option() with all our patterns
    boolean-flags.spec.ts       # Test --no- prefix behavior
    version-description.spec.ts # Test .version() and .description()
    parse.spec.ts               # Test .parse() and .opts()
    help.spec.ts                # Test --help output
    property-access.spec.ts     # Test commander.dir, etc.
```

**Test coverage for our usage:**
- ✅ Boolean options (`--no-dotfiles`)
- ✅ Required options (`--dir <dir>`)
- ✅ Optional options with defaults
- ✅ Short flags (`-d`, `-r`, etc.)
- ✅ Version output
- ✅ Help output
- ✅ Property access after parse
- ✅ Unknown option errors

## 5. Critical Bugs to Fix

**GOOD NEWS: No critical bugs in v3.0.2 affecting our usage!**

Commander v3.0.x bug fixes:
- v3.0.1: Fix help for sub commands (#1018) - **WE DON'T USE**
- v3.0.1: Add TypeScript definition for executableFile (#1028) - **WE DON'T USE**
- v3.0.2: Improve tracking of executable subcommands - **WE DON'T USE**

**Bugs to INTENTIONALLY preserve:**
- **--no- option default behavior** - This is the v3 behavior we want to keep!
- Any quirks with option parsing - these are the behaviors we're freezing

**No fixes needed! ✅**

## 6. Dependencies Analysis

**Runtime Dependencies:**
- ✅ **ZERO** - commander v3.0.2 has no runtime dependencies
- ✅ After stripping: STILL ZERO
- ✅ Node.js built-ins needed:
  - `events` (EventEmitter) - KEEP
  - `path` (basename, dirname) - KEEP for help
  - `fs` (existsSync) - REMOVE (only for executable subcommands)
  - `util` (inherits) - KEEP

**Dev Dependencies (our choice):**
```json
{
  "devDependencies": {
    "@types/node": "^20.11.7",
    "jest": "^29.7.0",
    "typescript": "~5.2.2"
  }
}
```

## 7. License Compliance

**✅ MIT License allows:**
- Forking
- Modification
- Distribution
- Commercial use
- Private use

**REQUIRED actions:**
1. ✅ Copy `LICENSE` file to `commander-fork/LICENSE`
2. ✅ Keep copyright notice intact
3. ✅ Add notice in our code:
   ```javascript
   /**
    * commander-fork
    * Minimal fork of commander v3.0.2 for angular-cli-ghpages
    * Original: https://github.com/tj/commander.js (MIT License)
    * Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
    * Forked and stripped to minimal feature set
    */
   ```

**Optional but recommended:**
- Add `FORK_NOTICE.md` explaining why we forked and what was changed

## 8. What You Missed - Additional Considerations

### 8.1 Import Path Migration
**Before:**
```javascript
var commander = require('commander');
```

**After:**
```javascript
var commander = require('../commander-fork');
```

**Files to update:**
- `src/angular-cli-ghpages` (line 9)

### 8.2 Version Naming
Use semantic versioning with fork suffix:
- `3.0.2-fork.1` (first fork release)
- `3.0.2-fork.2` (if we fix something)

### 8.3 Code Comments
Add extensive comments explaining:
- Why we forked
- What features were removed
- What features were kept
- How to maintain

### 8.4 TypeScript Typings
Strip `index.d.ts` to match our minimal API:
- Remove Command, Option exports (keep as internal)
- Keep only: version(), description(), option(), parse(), opts()
- Remove command(), action(), arguments()

### 8.5 Testing Against Original
Before removing features:
1. Run our existing tests with commander v3.0.2
2. Run our existing tests with commander-fork
3. Verify identical behavior

### 8.6 Documentation
Create `commander-fork/README.md`:
```markdown
# Commander Fork

Minimal fork of commander v3.0.2 for angular-cli-ghpages.

## Why Fork?

Commander v4+ introduced breaking changes that would break user scripts.
Rather than adapt to ever-changing dependency, we froze v3.0.2 behavior.

## Features Kept

- `.version()`
- `.description()`
- `.option()` with --no- prefix
- `.parse()`
- `.opts()`
- Basic --help

## Features Removed

- Subcommands
- Action handlers
- Git-style executables
- Advanced help customization

## License

MIT (original copyright: TJ Holowaychuk)
```

### 8.7 Build System
- No build step needed (it's plain JS)
- Just copy files to dist during `npm run build`
- Update postbuild script to include commander-fork

### 8.8 Future Maintenance
**If we find a bug:**
1. Fix it in `commander-fork/index.js`
2. Add test for the fix
3. Bump version to `3.0.2-fork.2`
4. Document in FORK_NOTICE.md

**If commander releases security fix:**
1. Evaluate if it affects our stripped version
2. Backport if necessary
3. Bump version

### 8.9 npm Package Considerations
- Mark as `"private": true` in package.json
- NOT published to npm
- Lives inside our monorepo only

### 8.10 Performance Impact
**Expected improvements:**
- Smaller file size: 32KB → ~15-20KB
- Faster parse time: less code to execute
- Smaller bundle size for users

## Summary of Answers to Your 7 Questions

1. **Files to copy:** LICENSE, index.js (stripped), package.json (modified), index.d.ts (stripped)
2. **JS or TS:** Keep as JavaScript (less risk, faster)
3. **Test coverage:** Write our own ~5-10 test files in Jest (not copy their 62)
4. **Critical bugs:** NONE affecting our usage! v3.0.2 is solid for what we use
5. **Dependencies:** ZERO runtime deps (before and after stripping)
6. **License:** MIT - OK to fork, MUST include LICENSE file
7. **What you missed:** Import path migration, version naming, TypeScript typings cleanup, build system integration, documentation

## Estimated Effort

- Stripping index.js: 2-3 hours
- Stripping index.d.ts: 30 minutes
- Writing tests: 2-3 hours
- Integration + verification: 1-2 hours
- Documentation: 1 hour

**Total: 6-9 hours** (1-2 days)

**This is WAY less effort than dealing with commander breaking changes forever! 🎯**
