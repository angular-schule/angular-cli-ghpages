# CLAUDE.md

This file provides guidance when working with code in this repository.

## Overview

`angular-cli-ghpages` is an Angular CLI builder/schematic that deploys Angular applications to GitHub Pages, Cloudflare Pages, or any Git repository. It wraps the `gh-pages` npm package and integrates with Angular CLI's deployment infrastructure via `ng deploy`.

## Development Commands

All development commands must be run from the `src` directory:

```bash
cd src
```

### Build
```bash
npm run build
```
Compiles TypeScript to JavaScript and copies necessary files to `dist/`. The build process:
1. **`prebuild`**: Cleans the `dist` directory and regenerates `deploy/schema.d.ts` from `deploy/schema.json`
2. **`build`**: Compiles TypeScript using `tsconfig.build.json`
3. **`postbuild`**: Copies metadata files (builders.json, collection.json, schema.json, etc.) to `dist/`

**Important:** After editing `deploy/schema.json`, you MUST run `npm run build` to regenerate `schema.d.ts` and sync `dist/deploy/schema.json`. The build artifacts are gitignored (as they should be), so they won't be committed.

**Schema Artifact Sync:**
- `src/deploy/schema.json` - Source of truth (edit this)
- `src/deploy/schema.d.ts` - Generated TypeScript types (auto-generated via `json-schema-to-typescript`)
- `src/dist/deploy/schema.json` - Distributed schema (copied during build)

**npm scripts compatibility:** This project does NOT use lifecycle hooks (`prepare`, `postinstall`, etc.). All build steps are manual via `npm run <script>`. Safe to use with `ignore-scripts=true` in global `.npmrc` for security.

### Test
```bash
npm test
```
Runs Jest test suite. Uses `jest.config.js` in the `src` directory.

To run tests in watch mode:
```bash
npm test -- --watch
```

### Local Development with npm link

For testing changes locally with an Angular project:

1. Build and link from `src/dist`:
   ```bash
   cd src
   npm run build
   cd dist
   npm link
   ```

2. In your Angular test project:
   ```bash
   npm link angular-cli-ghpages
   ng add angular-cli-ghpages
   ng deploy --dry-run  # Test without deploying
   ```

### Debugging

To debug the deploy builder in VSCode, use this `launch.json` configuration in your Angular project:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug ng deploy",
  "skipFiles": ["<node_internals>/**"],
  "program": "${workspaceFolder}/node_modules/@angular/cli/bin/ng",
  "cwd": "${workspaceFolder}",
  "sourceMaps": true,
  "args": ["deploy", "--no-build"]
}
```

Alternatively, debug from command line:
```bash
node --inspect-brk ./node_modules/@angular/cli/bin/ng deploy
```

For debugging the standalone engine directly, use the "Launch Standalone Program" task in VSCode (configured in `.vscode/launch.json`).

### Publishing

```bash
cd src
npm run build
npm run test
npm run publish-to-npm
```

For pre-release versions:
```bash
npm dist-tag add angular-cli-ghpages@X.X.X-rc.X next
```

## Architecture

### Entry Points

1. **Angular CLI Integration** (`src/deploy/`):
   - `builder.ts` - Angular builder entry point, called by `ng deploy`
   - `actions.ts` - Orchestrates build and deployment process
   - `schema.json` - Defines CLI options/arguments

2. **Schematic** (`src/ng-add.ts`):
   - Implements `ng add angular-cli-ghpages`
   - Adds deploy target to `angular.json`

3. **Standalone CLI** (`src/angular-cli-ghpages`):
   - Bash script for non-Angular CLI usage
   - Uses `commander` for CLI parsing

4. **Core Engine** (`src/engine/`):
   - `engine.ts` - Core deployment logic (wraps gh-pages)
   - `defaults.ts` - Default configuration values

### Deployment Flow

```
ng deploy
  ↓
builder.ts (createBuilder)
  ↓
actions.ts (deploy function)
  ├─→ Build Angular app (if not --no-build)
  │   Uses BuilderContext.scheduleTarget()
  └─→ engine.run()
      ├─→ Prepare options (tokens, CI env vars)
      ├─→ Create .nojekyll file (bypasses Jekyll on GitHub)
      ├─→ Create 404.html (copy of index.html for SPAs)
      ├─→ Create CNAME file (if custom domain)
      └─→ Publish via gh-pages package
```

### Build Target Resolution

**Important:** With Angular 17+, the build target resolution follows a strict precedence order. The builder evaluates targets in this order and uses the first one found:

**Internal Implementation Precedence (what the code actually does):**
1. `prerenderTarget` - For SSG/prerendering builds (if specified, overrides all others)
2. `browserTarget` - **DEPRECATED** legacy option (if specified, takes precedence over buildTarget for backward compatibility)
3. `buildTarget` - Standard build target (if specified)
4. Default - `${project}:build:production`

**User-Facing Precedence (what we tell users in README.md):**
1. `prerenderTarget` (if specified) — highest priority
2. `buildTarget`
3. Default: `${project}:build:production` if none specified

**Note:** `browserTarget` is deliberately HIDDEN from user-facing documentation per deprecation policy, even though it still works internally for backward compatibility.

**Implementation details:**
- Static build target: `browserTarget || buildTarget || default` (see `src/deploy/builder.ts:23-26`)
- Final target: `prerenderTarget || staticBuildTarget` (see `src/deploy/builder.ts:45-50`)
- If `prerenderTarget` is set, it takes absolute precedence regardless of other targets

Output directory resolution:
- Checks `angular.json` for `outputPath`
- If string: appends `/browser` (modern Angular convention)
- If object: uses `${base}/${browser}` properties
- Can be overridden with `--dir` option

### Token Injection

The engine automatically injects authentication tokens into HTTPS repository URLs:

1. Discovers remote URL from current git repo (if `--repo` not specified)
2. Checks environment variables in order: `GH_TOKEN`, `PERSONAL_TOKEN`, `GITHUB_TOKEN`
3. Transforms: `https://github.com/...` → `https://x-access-token:TOKEN@github.com/...`

**Note:** Tokens only work with HTTPS, not SSH URLs (git@github.com).

### CI Environment Detection

The engine appends CI metadata to commit messages when running on:
- Travis CI (`TRAVIS` env var)
- CircleCI (`CIRCLECI` env var)
- GitHub Actions (`GITHUB_ACTIONS` env var)

Includes commit SHA and build URL in the commit message.

### Option Name Mapping

Angular CLI does NOT rename kebab-case to camelCase for boolean flags with "no" prefix. The engine handles this mapping:

- CLI: `--no-dotfiles` → Code: `noDotfiles` → Internal: `dotfiles: false`
- CLI: `--no-notfound` → Code: `noNotfound` → Internal: `notfound: false`
- CLI: `--no-nojekyll` → Code: `noNojekyll` → Internal: `nojekyll: false`

## Key Files

- `src/deploy/schema.json` - Source of truth for all deployment options
- `src/interfaces.ts` - TypeScript interfaces for the project
- `src/builders.json` - Registers the deploy builder with Angular CLI
- `src/collection.json` - Registers the ng-add schematic
- `src/utils.ts` - Utilities for working with Angular workspace files

## Important Conventions

1. **No Server-Side Rendering**: GitHub Pages only supports static files. SSR/Universal build targets are not supported.

2. **404.html Handling**: By default creates `404.html` as copy of `index.html` to handle SPA routing on GitHub Pages. For Cloudflare Pages, disable with `--no-notfound`.

3. **Jekyll Bypass**: Creates `.nojekyll` to prevent GitHub Pages from processing files through Jekyll (which would break files starting with `_` or `.txt` in assets).

4. **Breaking Changes in v2**: Changed from guessing build conventions in Angular 17+. Projects may need explicit `--build-target` specification.

## Documentation Philosophy

### Deprecation Handling

**User-Facing Documentation (README.md)**:
- **DO NOT promote deprecated options** in examples or main sections
- Hide compatibility-only options from users: `browserTarget`, `noSilent`
- Only show options users should actually use
- When documenting target precedence, omit deprecated options entirely

**Where Deprecated Options Belong**:
- ✅ `schema.json` with `"deprecated": true` and `"x-deprecated": "message"` fields
- ✅ CLAUDE.md (for contributors)
- ✅ BREAKING CHANGES sections (when explaining migrations)
- ✅ Code comments explaining backward compatibility
- ❌ Configuration File examples in README
- ❌ Main Deployment Options sections in README
- ❌ Precedence explanations in user-facing docs

**Schema Deprecation Flags:**
- `"deprecated": true` - JSON Schema Draft 2019-09 standard flag (Angular CLI recognizes this)
- `"x-deprecated": "message"` - Angular CLI custom extension for deprecation messages
- `"description": "DEPRECATED: ..."` - Human-readable description prefix

**Example:**
```json
"browserTarget": {
  "type": "string",
  "deprecated": true,
  "x-deprecated": "Use buildTarget instead. Kept for backwards compatibility.",
  "description": "DEPRECATED: Use buildTarget instead. Legacy alias kept for backwards compatibility only."
}
```

**Auditing for Deprecated Option Mentions:**

Run these checks before releases:
```bash
# Check README for browserTarget mentions (should be zero in user-facing sections)
grep -n "browserTarget" README.md

# Check README for noSilent mentions (should be zero)
grep -n "noSilent" README.md

# Verify schema.json has deprecation flags
grep -A3 "browserTarget" src/deploy/schema.json
```

**Current deprecated options:**
- `browserTarget` - Replaced by `buildTarget`, still works for compatibility
- `noSilent` - No longer needed, parameter is ignored with warning

**Avoid Test Count Bragging**:
- Don't include specific test counts in documentation
- Numbers go stale immediately and provide no value
- Let `npm test` output speak for itself

## Testing Strategy

Tests use Jest and are located alongside source files with `.spec.ts` extension:

**Deployment & Integration:**
- `deploy/actions.spec.ts` - Deployment action tests
- `deploy/builder.spec.ts` - Builder integration tests
- `ng-add.spec.ts` - Schematic tests

**Core Engine:**
- `engine/engine.spec.ts` - Core engine tests (includes prepareOptions, monkeypatch, error handling)
- `engine/engine.prepare-options-helpers.spec.ts` - Intensive tests for option preparation helpers (getRemoteUrl, token injection, CI metadata)
- `engine/engine-filesystem.spec.ts` - Real filesystem tests (.nojekyll, CNAME, 404.html creation)
- `engine/engine.gh-pages-behavior.spec.ts` - gh-pages v3.2.3 behavioral baseline (dotfiles, file lists)
- `engine/engine.gh-pages-integration.spec.ts` - gh-pages option pass-through and API integration

**Parameter Testing:**
- `parameter-tests/parameter-passthrough.spec.ts` - Parameter transformation tests
- `parameter-tests/edge-cases.spec.ts` - Edge case and boundary tests
- `parameter-tests/cli-e2e.spec.ts` - End-to-end standalone CLI testing
- `parameter-tests/builder-integration.spec.ts` - Angular Builder integration tests
- `parameter-tests/build-target.spec.ts` - Build target resolution matrix (buildTarget/browserTarget/prerenderTarget/noBuild)
- `parameter-tests/builder-passthrough.spec.ts` - Builder option pass-through tests
- `parameter-tests/pr-186-commander-defaults.spec.ts` - Commander v3 compatibility and default behavior

**Environment & Prerequisites:**
- `test-prerequisites.spec.ts` - Environment validation (git availability, repository setup, origin remote)

**Public API:**
- `public-api.spec.ts` - Public API exports validation

**Commander Fork (CLI parsing):**
- `commander-fork/test/*.spec.ts` - Tests for commander v3 compatibility fork

Snapshot tests are stored in `__snapshots__/` directory.

**Test Environment Requirements:**
- Tests must run from a git clone with `origin` remote configured
- See `test-prerequisites.spec.ts` for validation details
- All tests use `originalEnv` pattern to preserve and restore `process.env`

### Testing Philosophy: Explicit Assertions

**Prefer precise assertions with `.toBe()` for scalar values, but allow `.toContain()` where appropriate.**

**Rules:**
1. **Explicit expected values** - Always write out the exact expected value
2. **Use `.toBe()` for exact equality of scalars** - Strings, numbers, booleans
3. **Allow `.toContain()` for:**
   - **Array membership checks** - Verifying an item is in an array
   - **Substring assertions in long messages** - Where full string equality would be brittle or unmaintainable
4. **Variable reuse for passthrough** - If input should equal output unchanged, use the same variable for both
5. **Separate variables for transformations** - If input is transformed, use distinct `input` and `expected` variables

**Good examples:**
```typescript
// ✅ Scalar equality - use .toBe()
const repoUrl = 'https://github.com/test/repo.git';
const result = await prepareOptions({ repo: repoUrl }, logger);
expect(result.repo).toBe(repoUrl);

// ✅ Array membership - .toContain() is appropriate
const files = ['index.html', 'main.js', '.htaccess'];
expect(files).toContain('.htaccess');

// ✅ Substring in long CI message - .toContain() is appropriate
expect(options.message).toContain('Travis CI build: https://travis-ci.org/');

// ✅ Exact message for simple case - use .toBe()
const expected = 'Deploy to gh-pages';
expect(options.message).toBe(expected);
```

**Bad examples:**
```typescript
// ❌ Weak - doesn't verify exact value when you could
expect(result.repo).toContain('github.com'); // Could use .toBe() with full URL

// ❌ Unclear - is this supposed to change or not?
const options = { branch: 'main' };
expect(result.branch).toBe('main'); // Should use same variable!
```

**Guideline:** Use `.toBe()` for exact equality when the full value is known and reasonable to assert. Use `.toContain()` for array membership or when asserting the full value would make tests brittle (e.g., long autogenerated messages).

### TypeScript: NEVER Use `any`

**HARD RULE: The `any` type is FORBIDDEN in all code.**

- Never use `any` type
- Use proper types, `unknown`, or `Partial<T>` instead
- If mocking complex types, use `Partial<T>` and cast: `mockObject as CompleteType`
- If type is truly unknown, use `unknown` and add type guards

**Bad:**
```typescript
const result: any = getValue();
const mock = {} as any;
```

**Good:**
```typescript
const result: string | number = getValue();
const mock: Partial<ComplexType> = { ...props };
const typedMock = mock as ComplexType;
```

This explicit style makes tests serve as precise documentation of behavior and catches subtle regressions.

## Related Projects

This project builds upon:
- `gh-pages` npm package (core git operations)
- Angular DevKit (builder/schematic infrastructure)
- Originated from AngularFire deploy schematics

For sync considerations, monitor:
- https://github.com/angular/angularfire/blob/master/src/schematics/deploy/builder.ts
- https://github.com/angular/angularfire/blob/master/src/schematics/deploy/actions.ts

## GitHub CLI Usage

When performing GitHub operations (creating issues, PRs, etc.), use the `gh` CLI tool instead of web requests to avoid rate limiting and authentication issues.