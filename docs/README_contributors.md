# @angular-schule/ngx-deploy-starter: README for contributors

## How to start <a name="start"></a>

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

Use the following instructions to make `@angular-schule/ngx-deploy-starter` available locally via `npm link`.

1. Clone the project

   ```sh
   git clone https://github.com/angular-schule/ngx-deploy-starter.git
   cd ngx-deploy-starter
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

Once you have completed the previous steps to `npm link` the local copy of `@angular-schule/ngx-deploy-starter`, follow these steps to use it in a local Angular project.

1. Enter the project directory

   ```sh
   cd your-angular-project
   ```

2. Add the local version of `@angular-schule/ngx-deploy-starter`.

   ```sh
   npm link @angular-schule/ngx-deploy-starter
   ```

3. Now execute the `ng-add` schematic.

   ```sh
   ng add @angular-schule/ngx-deploy-starter
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


### 4. Testing

Testing is done with [Jest](https://jestjs.io/).
To run the tests:

```sh
cd ngx-deploy-starter/src
npm test
```



## Publish to NPM

```
cd ngx-deploy-starter/src
npm run build
npm run test
npm publish dist --access public
```
