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
Build process: `prebuild` (clean + regenerate schema.d.ts) → `build` (tsc) → `postbuild` (copy metadata to dist/).

`schema.json` is source of truth for deployment options. Editing it requires rebuild.

### Test
```bash
npm test
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
- Static build target: `browserTarget || buildTarget || default` (see `src/deploy/builder.ts`)
- Final target: `prerenderTarget || staticBuildTarget` (see `src/deploy/builder.ts`)

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

### Option Name Mapping

**CRITICAL:** Angular CLI passes `--no-X` flags as `noX: true`, NOT as `X: false`. The engine must manually invert these:

- `--no-dotfiles` → Angular passes `{ noDotfiles: true }` → Engine converts to `{ dotfiles: false }`
- `--no-notfound` → Angular passes `{ noNotfound: true }` → Engine converts to `{ notfound: false }`
- `--no-nojekyll` → Angular passes `{ noNojekyll: true }` → Engine converts to `{ nojekyll: false }`

## Important Conventions

1. **No Server-Side Rendering**: GitHub Pages only supports static files. SSR/Universal build targets are not supported.

2. **404.html Handling**:
   - **GitHub Pages**: Requires `404.html` workaround (only way to get SPA routing, but returns HTTP 404 status)
   - **Cloudflare Pages**: MUST NOT have `404.html` - its presence disables native SPA mode
   - **Future**: Consider changing default or auto-detecting deployment target

3. **Jekyll Bypass**: Creates `.nojekyll` to prevent GitHub Pages from processing files through Jekyll (which would break files starting with `_` or `.txt` in assets).

4. **Breaking Changes in v2**: Changed from guessing build conventions in Angular 17+. Projects may need explicit `--build-target` specification.

## Deprecated Options (Maintainers Only)

**Current deprecated options:**
- `browserTarget` - Replaced by `buildTarget`, still works for compatibility
- `noSilent` - Ignored with warning

**Policy:** DO NOT promote deprecated options in user-facing docs (README.md). Hide `browserTarget` from precedence explanations and configuration examples.

**Schema deprecation format:**
```json
"browserTarget": {
  "type": "string",
  "deprecated": true,
  "x-deprecated": "Use buildTarget instead. Kept for backwards compatibility.",
  "description": "DEPRECATED: Use buildTarget instead. Legacy alias kept for backwards compatibility only."
}
```

## Testing

- Uses Jest (`npm test`), tests in `*.spec.ts` files
- Requires git clone with `origin` remote (see `test-prerequisites.spec.ts`)
- All tests preserve/restore `process.env` using `originalEnv` pattern
- **No test counts in documentation** - they become stale quickly and are bragging

### Testing Rules

1. Use `.toBe()` for scalar equality (strings, numbers, booleans)
2. Use `.toContain()` for array membership or substring checks in long messages
3. Variable reuse for passthrough (same var = no transformation)
4. Separate variables for transformations (input != expected)

**Avoid:**
- `.toContain('partial')` when you could use `.toBe(fullExpectedValue)`
- Reusing literals instead of variables to show intent

### TypeScript: No `any` Type

Use proper types, `unknown`, or `Partial<T>` instead. For mocks: `Partial<ComplexType>` cast to `CompleteType`.

## Related Projects

For sync considerations with AngularFire, monitor:
- https://github.com/angular/angularfire/blob/master/src/schematics/deploy/builder.ts
- https://github.com/angular/angularfire/blob/master/src/schematics/deploy/actions.ts

## GitHub CLI Usage

When performing GitHub operations (creating issues, PRs, etc.), use the `gh` CLI tool instead of web requests to avoid rate limiting and authentication issues.
