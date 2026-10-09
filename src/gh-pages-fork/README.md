# gh-pages Fork

**Minimal TypeScript fork of [gh-pages](https://github.com/tschaub/gh-pages) for angular-cli-ghpages.**

## 🚨 INTERNAL USE ONLY

**This fork exists SOLELY for angular-cli-ghpages and will NEVER be a general-purpose library.**

- ❌ NOT for public adoption or use by other projects
- ❌ NOT a community fork
- ❌ NO migration support or guidance
- ❌ NO feature requests accepted
- ✅ ONLY maintained for angular-cli-ghpages internal needs

**If you need gh-pages, use the official upstream library:** https://github.com/tschaub/gh-pages

---

⚠️ **This is NOT a drop-in replacement for gh-pages**

This fork keeps only the publish flow that angular-cli-ghpages uses. It has no CLI, no callback API and no third-party dependencies (only Node.js built-ins).

## Structure

The file structure and function names follow upstream, so upstream changes can be compared and ported file by file:

| Upstream       | Fork           | Contents                                                               |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| `lib/index.js` | `lib/index.ts` | `publish()`, `clean()`, `getCacheDir()`, `getRepo()`, `defaults`       |
| `lib/git.js`   | `lib/git.ts`   | `Git` class, `ProcessError`, `spawn()`                                 |
| `lib/util.js`  | `lib/util.ts`  | `copy()`, `getUser()`, plus `listFiles()` instead of a glob library  |

## What This Fork Contains

### Features Kept ✅

- `publish(basePath, options, log?)` — async, rejects on any error
- `clean()` and `getCacheDir()`
- Options: `repo`, `branch`, `remote`, `message`, `git`, `depth`, `add`, `dotfiles`, `nojekyll`, `cname`, `user`
- `Git`: `clone`, `exec`, `clean`, `reset`, `fetch`, `checkout`, `rm`, `add`, `commit`, `push`, `getRemoteUrl`

### Features Removed ❌

- The `gh-pages` / `gh-pages-clean` CLI
- The callback API of `publish()`
- Options `src`, `remove`, `only`, `dest`, `tag`, `history`, `push`, `silent`, `beforeAdd`
- `Git`: `init`, `tag`, `deleteRef`
- All dependencies: `async`, `commander`, `email-addresses`, `filenamify`, `find-cache-dir`, `fs-extra`, `globby`/`tinyglobby`

## Deviations from Upstream

| Topic             | Upstream                                                        | Fork                                                                                           |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Logging           | `util.debuglog('gh-pages')`                                     | `log` callback parameter of `publish()`                                                         |
| Removing files    | glob `remove` pattern, then `git rm` in batches                 | `git rm -r -f --ignore-unmatch -- .` (all tracked files, including dotfiles and submodules)     |
| File list         | glob `src` pattern via tinyglobby                                | `listFiles()`: all files below `basePath`, follows symlinks, honors `dotfiles`                  |
| Cache directory   | `find-cache-dir` + `filenamify(repo)`                           | Same lookup (`$CACHE_DIR`, closest `package.json`) plus an os temp dir fallback; clone directory named after a hash of the repo URL, so tokens never end up in a path |
| `checkout()`      | `main` only runs `ls-remote` for an existing branch              | `checkout`, `clean -f -d`, `reset --hard remote/branch` (the behavior of v6.3.0)                |
| Log messages      | full repository URL                                              | credentials in the repository URL are replaced with `***`                                      |
| Empty `basePath`  | `The pattern in the "src" property didn't match any files.`     | `The directory "<basePath>" doesn't contain any files to publish.`                              |

## Maintenance

**This fork is maintained EXCLUSIVELY for angular-cli-ghpages.**

We update it only when:
1. A critical security vulnerability is found that affects angular-cli-ghpages
2. A bug is discovered that affects angular-cli-ghpages functionality
3. An upstream change is relevant for angular-cli-ghpages
4. Node.js or git changes break angular-cli-ghpages compatibility

**We do NOT accept:**
- Feature requests from other projects
- Pull requests for general gh-pages features
- Issues from external users

For internal changes (angular-cli-ghpages team only):
1. Update the matching file in `gh-pages-fork/lib/`
2. Add or adjust a test in `gh-pages-fork/test/`
3. When porting an upstream change, update the base commit below

## Original Project

This is a stripped-down fork of:
- **Repository**: https://github.com/tschaub/gh-pages
- **Base**: `main` at [`48f62a7`](https://github.com/tschaub/gh-pages/commit/48f62a750216e72c5e89058bb61dffdb8450949d) (2026-01-11, after v6.3.0)
- **License**: MIT (see [LICENSE](LICENSE))
- **Original Author**: Tim Schaub

We are grateful for the original gh-pages project; this fork exists only to keep angular-cli-ghpages free of third-party dependencies for publishing.
