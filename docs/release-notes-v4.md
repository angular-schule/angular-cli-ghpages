# angular-cli-ghpages 4.0.0 – release notes (draft)

Compared with **3.1.2**. Collected while 4.0.0 is prepared (PR #218, first prerelease `4.0.0-rc.0`); every user-visible difference goes into this file, so it can become the GitHub release text.

Supported versions are unchanged: Angular 18 to 22, Node.js >= 18.19.1.

## Why a major version

The publish step is rewritten: angular-cli-ghpages publishes with its own minimal TypeScript fork of `gh-pages` (`src/gh-pages-fork/`) and has no third-party dependencies for publishing any more. Setups that worked with 3.1.2 keep working, except for the deliberate behavior changes below. Each of them changes what ends up on the branch in some situations, so they get a major version.

## Upgrade checklist

Check these points; everything else works as before or is a bug fix.

1. **Every file of the build is published, ignore rules don't apply.** 3.1.2 silently left out files that matched the deploying machine's global gitignore (`core.excludesFile`, `~/.config/git/ignore`) or a `.gitignore` inside the build, e.g. `*.map`, `.env`, `.npmrc`, `.DS_Store`. 4.0.0 publishes them and prints a warning that lists them. *Action:* if the warning lists files you don't want online, remove them from the build (e.g. turn off source maps).
2. **The build folder is never modified.** 3.1.2 wrote `404.html` into `dist`; 4.0.0 adds it to the deployment only. *Action:* if a later pipeline step uploads `dist` somewhere else and needs the `404.html`, create it there yourself.
3. **`--cname` replaces a `CNAME` file of the build.** 3.1.2 wrote the CNAME first and then copied the build over it, so a `public/CNAME` won, while the log said "Creating CNAME for …". Now the option wins; without `--cname`, a `CNAME` file of the build is published as before.
4. **Files are published byte for byte.** 3.1.2 let git convert content on commit: `core.autocrlf` (on by default with Git for Windows and on Windows runners of GitHub Actions) turned CRLF into LF, a `.gitattributes` (in the build, global, or on the branch) could normalize line endings or run filters such as Git LFS. 4.0.0 unsets all these conversions in its temporary clone. The site gets exactly the bytes that the build produced, the same on every machine, so hashes that the build computed over the files (e.g. `ngsw.json` of the Angular service worker, `subresourceIntegrity`) match what is served. *Effect:* the first deploy after the upgrade from Windows can create one extra commit that only changes line endings of text files from `public/`.
5. **`--name` and `--email` win over `GIT_AUTHOR_*`/`GIT_COMMITTER_*`** from the environment (git hooks and some CI systems export them). 3.1.2 let the environment win.
6. **Project roots are refused.** An empty `--dir` is an error, and a directory with a `.git` entry and a `package.json` is refused while dotfiles are published (`--no-dotfiles` allows it). This protects against publishing the sources, including a local `.env`. A build folder that is itself a clone (`.git`, no `package.json`) is still accepted.
7. **`--dry-run` fails where the deploy would fail.** It runs the checks of a deploy that need no clone: the directory exists and isn't a file, it contains files, it isn't a project root, `--branch` and `--message` aren't empty. 3.1.2 reported success for all of these. A dry run still doesn't contact the remote repository.
8. **Standalone CLI: `--flag=false` leaves a boolean flag unset** (also `0`, `no`, `off`). In 3.1.2, `--add=false` turned add mode on and `--dry-run=false` still ran a dry run.
9. **The `gh-pages` package is no longer installed** with angular-cli-ghpages (together with about 40 transitive packages such as `fs-extra`, `globby`, `commander@13`), and neither are its bins `gh-pages` and `gh-pages-clean`. *Action:* if your scripts call them, add `gh-pages` to your own `devDependencies`.
10. **Programmatic use** (importing from `angular-cli-ghpages`): `Schema` and `PreparedOptions` are real types now (`deploy/schema.d.ts` was missing from the 3.x package, so they resolved to `any`); stricter TypeScript can flag code that compiled before. Internal deep exports are gone: `setupMonkeypatch`, `cleanupMonkeypatch`, the `GHPages`/`PublishOptions`/`GhPagesGit` types, `getRemoteUrl`, `ensureGhPagesCacheDir`, `collectDistFiles`, `createCleanupBeforeAddHook`.
11. **Browser builders with a string `outputPath`** (`@angular-devkit/build-angular:browser`, `:browser-esbuild`, and builders named after them, e.g. `@angular-builders/custom-webpack:browser`, `@nx/angular:webpack-browser`): `ng deploy` publishes `<outputPath>` itself, where these builders write the files. 3.1.2 looked for `<outputPath>/browser` and failed with "Dist folder does not exist". Setups with `--dir` are unaffected.

## Bug fixes

3.1.2 failed or did something unintended in these cases.

**Git and the user's repository**

- Concurrent deploys (e.g. `nx run-many -t deploy`) deleted or shared each other's clone; in the worst case, git commands ran in the user's project repository.
- A deploy started by git (hooks, `!` aliases, worktrees) inherited `GIT_DIR`/`GIT_INDEX_FILE` and acted on the user's repository.
- A git process killed by a signal (out of memory, watchdog) counted as success.
- stderr output of git (e.g. with `GIT_TRACE`) was read as repository URL or commit user.
- A missing git binary and real git config errors were reported as a missing remote.
- Relative repository paths (`--repo=../pages.git`, or a relative URL in the git config) failed.
- The token stayed in the cached clone's `.git/config` (and in the directory name of the clone).

**Branch content**

- The first deploy with `--add` to a new branch published the source tree of the default branch.
- One transient error on the first clone turned an existing branch into an orphan, and the push was rejected.
- A submodule gitlink on the branch sorting before `.gitmodules` (e.g. `.github/actions/x`) made every deploy fail.
- Tracked dotfiles on the branch that matched an ignore rule were deleted from the site.
- A second deploy with `--no-notfound` still published the `404.html` that an earlier deploy had written into a reused `dist`.
- An unchanged redeploy of a build with a top-level `HEAD` (or `head`) folder failed ("nothing to commit").
- A tag with the name of the target branch made the deploy fail (the push names `refs/heads/<branch>`).
- `--add` with a name conflict between a file and a folder (build vs. branch) failed with `EEXIST`/`EISDIR`; the build wins now, and the log names the replaced files.
- A nested repository inside the build was published as an empty gitlink instead of its files.

**Symlinks**

- A dangling `.nojekyll` symlink on the branch made `--add` create its target outside the clone; a symlinked `dist/404.html` overwrote its target outside the build.
- A symlink pointing to its own folder was published as 32 nested copies; two symlink cycles ran out of memory and crashed the deploy.
- Dot-named symlinks (`.htaccess` → …, `.well-known` → …) were dropped on every second deploy.

**Environment**

- A read-only `node_modules` made every deploy fail; the temporary clone goes to the system temp directory then.
- A build folder that is a clone of the pages branch failed to deploy.

**`ng deploy` and `ng add`**

- `ng deploy` from a subdirectory looked for the build output relative to the current working directory instead of the workspace root.
- The `--no-silent` deprecation warning appeared on every `ng deploy`.
- `ng deploy --help` described the `noX` options with the opposite meaning of the flag it shows (`--dotfiles  Exclude dotfiles … [default: false]`).
- `--cname` lost against a `CNAME` file of the build (see the upgrade checklist).
- A string `outputPath` of the browser builders got a `/browser` suffix (see the upgrade checklist).
- `--dir=missing` outside a git repository reported a missing remote instead of the missing directory.
- Re-running `ng add` failed with "Target name already exists".
- GitHub Enterprise Server: the commit link in the commit message pointed to github.com.
- `deploy/schema.d.ts` was missing from the package (the published typings import it).

**`--dry-run`**

- It passed setups that the deploy then refused (see the upgrade checklist).
- It promised a `404.html` without an `index.html`, and a commit author for `--name` without `--email`.

**Standalone CLI**

- `--add=false` turned add mode on, `--dry-run=false` still ran a dry run.
- Absolute `--dir` paths didn't work.
- `npx angular-cli-ghpages` crashed on Node.js 18 with a fresh install (`ERR_REQUIRE_ESM`).

## New warnings and messages

The published result is the same; there is more information.

- A warning lists env files in the deployment (`.env`, `.env.*`, `*.env`, any case, any folder), also in `--dry-run`, also those that `--add` keeps from the branch. They are published as before: someone who puts one into the build may intend it.
- A warning lists files that match an ignore rule (see the upgrade checklist), also in `--dry-run`.
- `--base-href` with `--no-build` warns that it has no effect.
- A push rejected because of a concurrent deploy says so and suggests running the deploy again.
- The log lists removed files (at most 10 names). The gh-pages lines `Cleaning`, `Fetching origin`, `Checking out …` are gone.
- Error messages name the options (`--dir`, `--repo`, `--branch`, `--message`).
- `ng add` explains an existing deploy target of another builder and keeps its own one.
- Standalone CLI: warnings in bold yellow on a terminal (following Node.js for `FORCE_COLOR`, `NO_COLOR`, `TERM=dumb`); positional arguments are ignored with a warning; `-S`/`--no-silent` prints its deprecation warning on stderr (a CI step that fails on any stderr output fails there).

## Other differences

The served site is the same.

- File modes: files are written as 100644. An executable file on the branch that the build overwrites becomes 100644, a non-empty `.nojekyll` becomes empty, a symlink on the branch overwritten with `--add` becomes a file. The first deploy after the upgrade can create one extra commit.
- Every deploy uses a fresh temporary clone that is removed at the end; there is no reused cache clone. Clones of interrupted deploys are removed by the next deploy (after 6 hours).
- `ng add` takes the project of the current directory in a workspace with several projects.
- The `noX` options of the schema have no `default` any more (it only fed the misleading `--help` text; the behavior is unchanged).

## Documentation corrections

The behavior didn't change; the docs described it wrongly.

- `--build-target` takes a full target string `project:target[:configuration]` (e.g. `my-app:build:staging`); a configuration name alone fails with `Invalid target string`.
- With `--no-build`, the build target (or `--prerender-target`) still determines the published directory.
- The default build target needs a `production` configuration.
- Tokens: `GH_TOKEN`, `PERSONAL_TOKEN` and `GITHUB_TOKEN` are injected into repository URLs starting with `https://github.com/`. The placeholder `GH_TOKEN` in `--repo` is only replaced by the variable `GH_TOKEN`.
- Unknown options in the deploy options of `angular.json` are ignored without an error.
- The commit message gets CI details on Travis CI, CircleCI and GitHub Actions.
- New sections: `--remote`, short flags of the standalone CLI, the `ngh` alias, git configuration (`includeIf`) of the temporary clone. The Ionic example is removed.
