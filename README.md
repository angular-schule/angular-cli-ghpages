# @angular-schule/ngx-deploy-starter 🚀

## About

This is a sample project that helps you to implement your own __deployment builder__ (`ng deploy`) for the Angular CLI.
The groundwork of this starter was provided by Minko Gechev's [ngx-gh project](https://github.com/mgechev/ngx-gh).

This project has the following purposes:

1. To promote the adoption of `ng deploy`.
2. To clarify various questions and to standardise the experience of the various builders.  

**We hope for an inspiring discussion, pull requests and questions.**

## Essential considerations

These rules are open for discussion, of course.

### 1. A deployment builder must always compile the project before the deployment

To reduce the chances to deploy corrupted assets, it's important to build the app right before deploying it. ([source](https://github.com/angular-schule/website-articles/pull/3#discussion_r315802100))

**Current state:**  
Currently there are existing deployment builders that only build in production mode.
This might be not enough.
There is also the approach not to perform the build step at all.

**Our suggestion:**  
By default, a deployment builder **shall** compile in `production` mode, but it **should** be possible to override the default coniguration using the option `--configuration`.

Discussion: https://github.com/angular-schule/ngx-deploy-starter/issues/1

### 2. A deployment builder should have an interactive prompt after the "ng add".

To make it easier for the end user to get started, a deployment builder **should** ask for all the mandatory questions immediately after the `ng add`.
The data should be persisted in the `angular.json` file.

**Note:**  
This feature is not implemented for this starter yet, but we are looking forward to your support.

Discussion: https://github.com/angular-schule/ngx-deploy-starter/issues/2

### 3. More to come

What's bothers you about this example?
We appreciate your [feedback](https://github.com/angular-schule/ngx-deploy-starter/issues)!


## How to make your own deploy builder

1. fork this repository
2. adjust the `package.json`
3. search and replace for the string `@angular-schule/ngx-deploy-starter` and `ngx-deploy-starter` and choose your own name.
4. search and replace for the string `to the file system` and name your deploy target.
5. add your deployment code to `src/engine/engine.ts`, take care of the tests
6. follow the instructions from the [contributors README](docs/README_contributors.md) for build, test and publishing.


You are free to customise this project according to your needs.
Please keep the spirit of Open Source alive and use the MIT or a compatible license.

## License
Code released under the [MIT license](LICENSE).
