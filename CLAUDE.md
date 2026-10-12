# CLAUDE.md

This file provides guidance when working with code in this repository.

## Overview

`angular-cli-ghpages` is an Angular CLI builder/schematic that deploys Angular applications to GitHub Pages, Cloudflare Pages, or any Git repository. It publishes via `src/gh-pages-fork/`, a minimal TypeScript fork of the `gh-pages` npm package, and integrates with Angular CLI's deployment infrastructure via `ng deploy`.

## Development Commands

All development commands must be run from the `src` directory:

```bash
cd src
```

**IMPORTANT:** The `src/.npmrc` file contains `ignore-scripts=false` to override global npm settings. **DO NOT DELETE OR MODIFY this file** - it's required for build scripts to run.

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

Publishing uses [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) with OIDC – no tokens stored in CI!

1. Go to **Actions** → **Publish to npm**
2. Click **Run workflow** → select branch
3. Leave "Dry-run" checked to test, or uncheck for real publish
4. Wait for approval (5 min timer + required reviewer)

Publishes with provenance attestation for supply chain security.

For pre-release versions, after publishing:
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
   - Node.js script for non-Angular CLI usage (`npx angular-cli-ghpages`)
   - Parses options with `src/commander-fork` (frozen subset of commander v3.0.2, see its `README.md`)
   - Rejects positional arguments; boolean flags accept `=true` / `=false`

4. **Core Engine** (`src/engine/`):
   - `engine.ts` - Core deployment logic (publishes via gh-pages-fork)
   - `defaults.ts` - Default configuration values

5. **gh-pages fork** (`src/gh-pages-fork/`):
   - Minimal TypeScript fork of `gh-pages`, internal use only (see its `README.md`)
   - Same file structure and function names as upstream (`lib/index.ts`, `lib/git.ts`, `lib/util.ts`)

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
      └─→ gh-pages-fork publish() (never modifies dist)
          ├─→ Remove stale temporary clones of interrupted deploys
          ├─→ git ls-remote: does the target branch exist?
          │   yes → clone only that branch without checkout into a fresh temporary directory
          │   no  → empty repository with HEAD on the new branch
          ├─→ --add: index = tree of the branch (read-tree HEAD)
          ├─→ Write .nojekyll (bypasses Jekyll on GitHub), CNAME (if custom domain) and
          │   404.html (copy of index.html for SPAs), then copy dist (its own 404.html wins)
          ├─→ git add --force (--all, or --ignore-removal with --add), commit if something changed
          ├─→ Push
          └─→ Remove the temporary clone

All git commands for the clone run with GIT_DIR/GIT_WORK_TREE pinned to it,
without repository variables inherited from a surrounding git process.
```

### Build Target Resolution

**Precedence:**
1. `prerenderTarget` - For SSG/prerendering builds (if specified, overrides all others)
2. `buildTarget` - Standard build target (if specified)
3. Default - `${project}:build:production`

**Implementation details:**
- Static build target: `buildTarget || default` (see `src/deploy/builder.ts`)
- Final target: `prerenderTarget || staticBuildTarget` (see `src/deploy/builder.ts`)

Output directory resolution:
- Checks `angular.json` for `outputPath` (resolved against the workspace root)
- If undefined: `dist/<project>/browser` (Angular 20+ default)
- If string: appends `/browser` (modern Angular convention)
- If object: uses `${base}/${browser}` properties
- Can be overridden with `--dir` option (relative to the current working directory, or absolute)

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

0. **Maximum compatibility for end users**: One release of angular-cli-ghpages must work for as many users as possible, including old Angular versions (enterprises often run very old ones). Keep the supported Angular range, the runtime `dependencies` ranges, the `@angular/cli` peer range and `engines.node` as wide as possible. Never narrow them as a side effect; drop an old Angular version only when keeping it actually costs logic or workarounds. `devDependencies` are free to change, since they never reach users.

1. **No Server-Side Rendering**: GitHub Pages only supports static files. SSR/Universal build targets are not supported.

2. **404.html Handling** (written by gh-pages-fork into the deployment, a `404.html` of the build wins):
   - **GitHub Pages**: Requires `404.html` workaround (only way to get SPA routing, but returns HTTP 404 status)
   - **Cloudflare Pages**: MUST NOT have `404.html` - its presence disables native SPA mode
   - **Future**: Consider changing default or auto-detecting deployment target

3. **Jekyll Bypass**: Creates `.nojekyll` to prevent GitHub Pages from processing files through Jekyll (which would break files starting with `_` or `.txt` in assets).

4. **Breaking Changes in v2**: Changed from guessing build conventions in Angular 17+. Projects may need explicit `--build-target` specification.

## Deprecated Options (Maintainers Only)

**Current deprecated options:**
- `noSilent` - Ignored with warning

**Rejected options (v2.1+):**
- `browserTarget` - Actively rejected with clear error message ("Use buildTarget instead"). Not silently ignored - users get explicit feedback.

## Testing

- Uses Vitest (`npm test`, also type-checks all sources including specs), tests in `*.spec.ts` files
- Shared helpers for specs that run real git or mock child processes: `src/test-helpers/git.ts` (not part of the package)
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

For `src/gh-pages-fork`, monitor upstream https://github.com/tschaub/gh-pages (releases, security advisories, `lib/`). npm audit and Dependabot can't report problems in forked code; port relevant fixes file by file and update the base commit in `src/gh-pages-fork/README.md`.

## GitHub CLI Usage

When performing GitHub operations (creating issues, PRs, etc.), use the `gh` CLI tool instead of web requests to avoid rate limiting and authentication issues.
