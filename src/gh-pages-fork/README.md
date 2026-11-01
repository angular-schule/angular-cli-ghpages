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

| Upstream       | Fork           | Contents                                                                                     |
| -------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `lib/index.js` | `lib/index.ts` | `publish()`, `getCacheDir()`, `getRepo()`, `defaults`                                        |
| `lib/git.js`   | `lib/git.ts`   | `Git` class, `ProcessError`, `spawn()`, `redact()`                                           |
| `lib/util.js`  | `lib/util.ts`  | `copy()`, `getUser()`, plus `listFiles()` instead of a glob library and `isEnvFile()`        |
| —              | `lib/repository-variables.ts` | the list of git's repository variables (also used by the test setup)          |

## What This Fork Contains

### Features Kept ✅

- `publish(basePath, options, log?)` — async, rejects on any error
- `getCacheDir(cwd?)` and `getRepo()`
- Options: `repo`, `branch`, `remote`, `message`, `git`, `depth`, `add`, `dotfiles`, `nojekyll`, `cname`, `user`
- `Git`: `clone`, `exec`, `commit`, `push`, `getRemoteUrl`

### Added 🆕

- Option `notfound`: 404.html as a copy of index.html, written after `basePath` is copied (replaces a 404.html of `basePath`)
- Env files are never published (see the table below)
- `Git.keepExistingFiles()`, `Git.addAll()`, `Git.setIdentity()`
- `redact()` for logging repository URLs

### Features Removed ❌

- The `gh-pages` / `gh-pages-clean` CLI and `clean()`
- The callback API of `publish()`
- Options `src`, `remove`, `only`, `dest`, `tag`, `history`, `push`, `silent`, `beforeAdd`
- `Git`: `init`, `clean`, `reset`, `fetch`, `checkout`, `rm`, `add`, `tag`, `deleteRef`, the `output` field
- All dependencies: `async`, `commander`, `email-addresses`, `filenamify`, `find-cache-dir`, `fs-extra`, `globby`/`tinyglobby`

## Deviations from Upstream

| Topic                | Upstream                                                                  | Fork                                                                                              |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Clone                | one cached clone per repository URL, reused across runs; full checkout of the branch | `git ls-remote` (in the private directory, so it doesn't read the project's git config) decides: an existing branch is cloned alone, without checkout (shallow; on a shallow-related error in full; on other errors one more shallow attempt, then in full); the temporary directory is removed when `publish()` finishes |
| Directory layout     | `.git` inside the work tree                                               | `<private dir>/git` and `<private dir>/work`, so no copied file can reach the git directory       |
| New branch           | full clone of the default branch, `checkout --orphan` keeps its files     | an empty repository in the object format of the remote (`git init`, `remote add`, `symbolic-ref`); an empty remote is cloned, which takes over its format |
| Staging              | `git rm` of the `remove` glob, copy, `git add .`                          | copy into the empty work tree, `git add --force --all` (the index starts empty); with `add`: `read-tree HEAD`, then `git add --force --ignore-removal`. Ignore rules, `.gitmodules` and symlinks on the branch don't affect the result |
| Env files            | published like other files                                                | `.env`, `.env.*`, `*.env` (any case, any folder, also folders with such a name) are skipped by `listFiles()` and removed from the index before the commit, also with `add`; no option turns this off |
| Project root         | —                                                                         | with `dotfiles`, a `basePath` with a `.git` entry is refused                                      |
| Cache directory      | `find-cache-dir` (`$CACHE_DIR`, closest `package.json`); `getCacheDir(optPath)` returns a per-repository subdirectory | same lookup, `getCacheDir(cwd)` returns the directory for temporary clones or `undefined`; then (and when it isn't writable) clones go to a private `angular-cli-ghpages-clone-*` directory in the os temp dir; the path is made absolute |
| Stale clones         | `gh-pages-clean`                                                          | before each deploy, temporary clones older than 6 hours, all other entries of the cache directory and `<os tmpdir>/angular-cli-ghpages-cache` are removed |
| Repository check     | "Remote url mismatch" check against the cached clone                      | none (every clone is fresh); relative local paths are resolved before cloning                     |
| Git environment      | inherited                                                                 | commands on the clone have `GIT_DIR`/`GIT_WORK_TREE` pinned; inherited repository variables are removed for all commands; no git maintenance |
| Identity             | `git config user.*`                                                       | the same; a `user` option also overrides `GIT_AUTHOR_*`/`GIT_COMMITTER_*` from the environment    |
| Credentials          | the URL with the token stays in the clone's `.git/config`                 | `-c credential.helper=` for a URL with a password. An http(s) URL with userinfo is written to `.git/config` by clone/remote add inside the private directory, replaced without userinfo right after that, and passed to `push` on the command line (visible in the process list while git runs, like upstream) |
| Process results      | resolves on a falsy exit code (also for a process killed by a signal); stdout and stderr in one buffer; crashes on a missing git executable | rejects unless the exit code is 0 (the signal is added to the message); `exec()` resolves with stdout only (no `output` field); a missing executable rejects with ENOENT |
| `getRemoteUrl()`     | every failure becomes "Failed to get remote.X.url (...)"                  | that message for a missing key (exit code 1); other git errors are added to the message           |
| `commit()`           | `git diff-index --quiet HEAD`                                             | `git diff-index --cached --quiet HEAD`: the work tree only holds the new files                    |
| Logging              | `util.debuglog('gh-pages')`                                               | `log` callback parameter of `publish()`; credentials in the repository URL are replaced with `***`; removed files are listed |
| File list            | glob `src` pattern via tinyglobby                                         | `listFiles()`: all files below `basePath`, follows symlinks, skips broken links, cycles, `.git` (any case) and env files, honors `dotfiles` |
| Copying              | `fs-extra` copy (keeps the file mode), one file after another             | streams into new files (mode 0666 minus umask, git records 100644); directories once; limited concurrency |
| Cleanup errors       | —                                                                         | a failing removal of the temporary clone is logged, it never changes the result                   |
| `getUser()`          | always runs `git`                                                         | uses the configured `git` executable                                                              |
| `defaults`           | `dotfiles: false`, `message: 'Updates'`, no `nojekyll`/`notfound`         | same values as angular-cli-ghpages (`dotfiles: true`, `nojekyll: true`, `notfound: true`, `message: 'Auto-generated commit'`) |
| Empty `basePath`     | `The pattern in the "src" property didn't match any files.`               | `The directory "<basePath>" doesn't contain any files to publish.`                                |

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
