# angular-cli-ghpages: README for contributors

- [How to start](#how-to-start)
- [Local development](#local-development)
  - [1. Angular CLI](#1-angular-cli)
  - [2. npm link](#2-npm-link)
  - [3. Adding to an Angular project -- ng add](#3-adding-to-an-angular-project----ng-add)
  - [4. Testing](#4-testing)
- [Testing the standalone CLI](#testing-the-standalone-cli)
- [Publish to NPM](#publish-to-npm)
- [Usage of Prettier Formatter](#usage-of-prettier-formatter)

## How to start

tl;dr – execute this:

```
cd src
npm i
npm run build
npm test
```

## Local development

If you want to try the latest package locally without installing it from NPM, use the following instructions.
This may be useful when you want to try the latest non-published version of this library or you want to make a contribution.

Follow the instructions for [checking and updating the Angular CLI version](#angular-cli) and then link the package.

### 1. Angular CLI

1. Install the next version of the Angular CLI.

   ```sh
   npm install -g @angular/cli
   ```

2. Run `ng version`, make sure you have installed Angular CLI v8.3.0 or greater.

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

## Testing the standalone CLI

To quickly test the file `engine.ts` directly, the standalone mode is the best option.
Use VSCode and debug the task `Launch Standalone Program`.

## Publish to NPM

```
cd angular-cli-ghpages/src
npm run build
npm run test
npm publish dist
npm dist-tag add angular-cli-ghpages@0.6.0-rc.0 next
```

## Usage of Prettier Formatter

Just execute `npx prettier --write '**/*'` and the code is formated automatically.
Please ignore the errors for now. ([error] No parser could be inferred for file)

We are still working on this, see https://github.com/angular-schule/ngx-deploy-starter/issues/10 .
