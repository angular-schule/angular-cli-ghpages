# angular-cli-ghpages: README for contributors

- [How to start](#how-to-start)
- [Local development](#local-development)
  - [1. Angular CLI](#1-angular-cli)
  - [2. npm link](#2-npm-link)
  - [3. Adding to an Angular project -- ng add](#3-adding-to-an-angular-project----ng-add)
  - [4. Testing](#4-testing)
  - [5. Debugging](#5-debugging)
- [Testing the standalone CLI](#testing-the-standalone-cli)
- [Publish to NPM](#publish-to-npm)

## How to start

tl;dr – execute this:

```
cd src
npm i
npm run build
npm test
```

**Test Prerequisites**: Tests must run from a git clone with `origin` remote configured. See `src/test-prerequisites.spec.ts` for validation details.

## Local development

If you want to try the latest package locally without installing it from NPM, use the following instructions.
This may be useful when you want to try the latest non-published version of this library or you want to make a contribution.

Follow the instructions for [checking and updating the Angular CLI version](#angular-cli) and then link the package.

### 1. Optional: Latest Angular version

This builder requires the method `getTargetOptions()` from the Angular DevKit which was introduced [here](https://github.com/angular/angular-cli/pull/13825/files).

**Version compatibility:**
- **v2.x:** Supports Angular 17 and higher (current version)
- **v1.x:** Supported Angular 9-16 (now deprecated for new projects)

Execute the next three steps to update your test project to the latest Angular version.

1. Install the latest version of the Angular CLI.

   ```sh
   npm install -g @angular/cli
   ```

2. Run `ng version`, to make sure you have installed Angular v17 or greater.

3. Update your existing project using the command:

   ```sh
   ng update @angular/cli @angular/core
   ```

### 2. npm link

Use the following instructions to make `angular-cli-ghpages` available locally via `npm link`.

1. Clone the project

   ```sh
   git clone https://github.com/angular-schule/angular-cli-ghpages.git
   cd angular-cli-ghpages
   ```

2. Install the dependencies

   ```sh
   cd src
   npm install
   ```

3. Build the project:

   ```sh
   npm run build
   ```

4. Create a local npm link:

   ```sh
   cd dist
   npm link
   ```

Read more about the `link` feature in the [official NPM documentation](https://docs.npmjs.com/cli/link).

### 3. Adding to an Angular project -- ng add

Once you have completed the previous steps to `npm link` the local copy of `angular-cli-ghpages`, follow these steps to use it in a local Angular project.

1. Enter the project directory

   ```sh
   cd your-angular-project
   ```

2. Add the local version of `angular-cli-ghpages`.

   ```sh
   npm link angular-cli-ghpages
   ```

3. Now execute the `ng-add` schematic.

   ```sh
   ng add angular-cli-ghpages
   # OR alternatively
   ng generate angular-cli-ghpages:ng-add
   ```

4. You can now deploy your angular app to GitHub pages.

   ```sh
   ng deploy
   ```

   Or with the old builder syntax:

   ```sh
   ng run your-angular-project:deploy
   ```

5. You can remove the link later by running `npm unlink`

6. We can debug the deployment with VSCode within `your-angular-project`, too.
   Go to `your-angular-project/node_modules/angular-cli-ghpages/deploy/actions.js` and place a breakpoint there.
   Now you can debug with the following `launch.json` file:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
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
     ]
   }
   ```

### 4. Testing

Testing is done with [Jest](https://jestjs.io/).
To run the tests:

```sh
cd angular-cli-ghpages/src
npm test
```

**Environment Requirements:**

Some tests (remote URL discovery and `getRemoteUrl` integration tests) expect to run inside a real git clone of this repository with an `origin` remote configured. Running tests from a zip file or bare copy without `.git` is not supported and will cause test failures.

### 5. Debugging

To debug angular-cli-ghpages you need to:

1. Place `debugger` statement, where you want your deployer stops.
2. Follow the steps of [npm link](#2-npm-link) described here. compile, link and install linked in a local project
3. Now, on the project that you linked the deployer, run it on debug mode using:

   - | Normal Command               | Command on Debug Mode                                                           |
     | :--------------------------- | :------------------------------------------------------------------------------ |
     | `ng deploy`                  | `node --inspect-brk ./node_modules/@angular/cli/bin/ng deploy`                  |
     | `ng add angular-cli-ghpages` | `node --inspect-brk ./node_modules/@angular/cli/bin/ng add angular-cli-ghpages` |

4. Use your favorite [Inspector Client](https://nodejs.org/de/docs/guides/debugging-getting-started/#inspector-clients) to debug

> This is the standard procedure to debug a NodeJs project. If you need more information you can read the official Docs of NodeJs to learn more about it.
>
> _https://nodejs.org/de/docs/guides/debugging-getting-started/_

## Testing the standalone CLI

To quickly test the file `engine.ts` directly, the standalone mode is the best option.
Use VSCode and debug the task `Launch Standalone Program`.

## Publish to NPM

```
cd angular-cli-ghpages/src
npm run build
npm run test
npm run publish-to-npm
npm dist-tag add angular-cli-ghpages@0.6.0-rc.0 next
```

## Programmatic Usage

For advanced use cases, `angular-cli-ghpages` can be used programmatically in Node.js scripts:

```typescript
import { deployToGHPages, defaults, Schema } from 'angular-cli-ghpages';

// Deploy with custom options
const options: Schema = {
  ...defaults,
  dir: 'dist/my-app/browser',
  repo: 'https://github.com/user/repo.git',
  message: 'Custom deploy message',
  branch: 'gh-pages',
  name: 'Deploy Bot',
  email: 'bot@example.com'
};

// Simple logger implementation
const logger = {
  info: (msg: string) => console.log(msg),
  warn: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
  debug: (msg: string) => console.debug(msg),
  fatal: (msg: string) => console.error(msg)
};

try {
  await deployToGHPages('dist/my-app/browser', options, logger);
  console.log('Deployment successful!');
} catch (error) {
  console.error('Deployment failed:', error);
}
```

### Available Types

The package exports these TypeScript types for programmatic usage:

- `Schema` - Complete options interface
- `PreparedOptions` - Internal options after processing
- `DeployUser` - User credentials type
- `GHPages` - gh-pages library wrapper interface
- `defaults` - Default configuration object

### Advanced: Angular Builder Integration

For custom Angular builders:

```typescript
import { angularDeploy } from 'angular-cli-ghpages';

// Inside your custom builder
const result = await angularDeploy(context, builderConfig, 'your-project-name');
```

**Note:** The CLI (`ng deploy`) remains the primary and recommended way to use this tool. Programmatic usage is considered advanced/experimental and may change between versions.

## Dependency on gh-pages Internal API

### Remote URL Discovery

The `getRemoteUrl` function in `src/engine/engine.prepare-options-helpers.ts` calls into `gh-pages/lib/git`, which is an **internal API** not documented in gh-pages' public interface. This dependency carries upgrade risk.

**What we depend on:**
- `new Git(process.cwd(), options.git).getRemoteUrl(options.remote)` from `gh-pages/lib/git`
- The exact error message format when remote doesn't exist or not in a git repository

**Upgrade process for gh-pages v6+:**

1. Check test failures in `src/engine/engine.prepare-options-helpers.spec.ts` first, specifically the `getRemoteUrl` test block
2. If those tests fail, it likely indicates a breaking change in gh-pages' internal Git API
3. Options:
   - If `gh-pages/lib/git` still exists with same interface: update our error message assertions
   - If the internal API changed significantly: implement our own git remote discovery using `child_process.execSync('git config --get remote.{remote}.url')`
   - If gh-pages added a public API for this: switch to the public API

**Current baseline:** Tests are pinned to gh-pages v3.2.3 behavior and error messages.

## Keeping track of all the forks

[ngx-deploy-starter](https://github.com/angular-schule/ngx-deploy-starter/) and
[angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages/) (both developed by Johannes Hoppe) are follow-up projects of the deprecated [ngx-gh demo](https://github.com/mgechev/ngx-gh).
This project was a follow-up of the deploy schematics from the [angularfire](https://github.com/angular/angularfire/) project.

To stay in sync with the stuff the Angular team is doing, you might want to keep an eye on the following files:

- [builder.ts](https://github.com/angular/angularfire/blob/master/src/schematics/deploy/builder.ts)
- [actions.ts](https://github.com/angular/angularfire/blob/master/src/schematics/deploy/actions.ts)
