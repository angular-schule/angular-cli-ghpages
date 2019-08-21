# ngx-deploy-starter

## About

This is a sample project that helps you to implement your own __deployment builder__ for the Angular CLI.
The groundwork of this starter was provided by Minko Gechev's [ngx-gh project](https://github.com/mgechev/ngx-gh).

This project has the following purposes:

1. To promote the adoption of `ng deploy`.
2. To clarify various questions and to standardise the experience of the various builders.

## Essential considerations

These rules are open for discussion, of course.

### 1. A deployment builder should always compile the project before the deployment

To reduce the chances to deploy corrupted assets, it's important to build the app right before deploying it. ([source](https://github.com/angular-schule/website-articles/pull/3#discussion_r315802100))

Currently there are existing deployment builders that only build in production mode.
This might be not enough.
There is also the approach not to perform the build step at all.

**Our suggestion:**
By default, a deployment builder compiles in `production` mode, but you can configure an other coniguration using the option `--configuration`.

### 2. A deployment builder should have an interactive wizard after the "ng add".

This wizard should ask all necessary questions and should persist the answers in the `angular.json` file.
This feature is not implemented yet, but we are looking forward to your feedback.

### 2. More to come

What's bothers you about this example? We appreciate your feedback!


## How to make your own deploy builder

1. fork this repository
2. adjust the `package.json`
3. search and replace for the string `ngx-deploy-starter` and choose your own name.
4. search and replace for the string `to the file system` and name your deploy target.
5. add your deployment code to `src/engine/engine.ts`x


You are free to customise this project according to your needs.
Please keep the spirit of Open Source alive and use the MIT or a compatible license.

## License
Code released under the [MIT license](LICENSE).
