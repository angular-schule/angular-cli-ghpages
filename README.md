# angular-cli-ghpages
[![NPM version][npm-image]][npm-url]
[![CircleCI](https://circleci.com/gh/angular-schule/angular-cli-ghpages.svg?style=svg)](https://circleci.com/gh/angular-schule/angular-cli-ghpages)

<!--
TODO: cool screenshot with animated gif
<hr>
 ![Screenshot](screenshotgif)
 -->

<hr>

Deploy your Angular app to GitHub pages directly from the Angular CLI! 🚀


## 📖 Changelog <a name="changelog"></a>

A detailed changelog is available in the [releases](https://github.com/angular-schule/angular-cli-ghpages/releases) section.

In the past this project was a standalone program.
This is still possible.
See the documentation at (https://github.com/angular-schule/angular-cli-ghpages/blob/master/README_standalone.md)[README_standalone].


## ⚠️ Prerequisites <a name="prerequisites"></a>

This action has the following prerequisites:

- Git 1.9 or higher (execute `git --version` to check your version)
- Angular project created via [Angular CLI](https://github.com/angular/angular-cli)


## 🚀 Quick-start <a name="quickstart"></a>

1. Install the next version of the Angular CLI (v8.3.0-next.0 or greater)
   and create a new Angular project.

   ```sh
   npm install -g @angular/cli@next
   ng new hello-world --defaults
   cd hello-world
   ```

2. Add `angular-cli-ghpages` to your project.

   ```sh
   ng add angular-cli-ghpages
   ```

3. Deploy your project to Github pages with all default settings.
   Your project will be automatically build in production mode.

   ```sh
   ng run hello-world:deploy
   ```

## 🏁 Next milestones <a name="milestones"></a>

We are glad that we have an integration into the CLI again.
But we are looking forward to the following features:

* an interactive command-line prompt that guides you through the available options and outputs a `angular-cli-ghpages.json` file 

We look forward to any help. PRs are welcome!

## ⁉️ FAQ <a name="faq"></a>

Before posting any issue, [please read the FAQ first](https://github.com/angular-schule/angular-cli-ghpages/wiki/FAQ).

## License
Code released under the [MIT license](LICENSE).

<hr>

<img src="http://assets.angular.schule/logo-angular-schule.png" height="60">  

### &copy; 2019 https://angular.schule

[npm-url]: https://www.npmjs.com/package/angular-cli-ghpages
[npm-image]: https://badge.fury.io/js/angular-cli-ghpages.svg
