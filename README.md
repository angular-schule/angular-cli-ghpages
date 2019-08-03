# angular-cli-ghpages
[![NPM version][npm-image]][npm-url]
[![CircleCI](https://circleci.com/gh/angular-schule/angular-cli-ghpages.svg?style=svg)](https://circleci.com/gh/angular-schule/angular-cli-ghpages)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)

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
See the documentation at [README_standalone](README_standalone).


## ⚠️ Prerequisites <a name="prerequisites"></a>

This command has the following prerequisites:

- Git 1.9 or higher (execute `git --version` to check your version)
- Angular project created via [Angular CLI](https://github.com/angular/angular-cli)


## 🚀 Quick-start <a name="quickstart"></a>

This quickstart assumes that you are starting from scratch.
If you alreay have an existing Angular project on GitHub, skip step 1 and 2.

1. Install the next version of the Angular CLI (v8.3.0-next.0 or greater)
   and create a new Angular project.

   ```sh
   npm install -g @angular/cli@next
   ng new hello-world --defaults
   cd hello-world
   ```

2. By default the Angular CLI initializes a git repository for you.  
   To add a new remote for GitHub, use the `git remote add` command:

   ```sh
   git remote add origin https://github.com/<username>/<repositoryname>.git
   ```

   Hints:  
   * Create a new empty GithHub repository first.
   * Replace `<username>` and `<repositoryname>` with your username from GitHub and the name of your new repository. 
   * Please enter the URL `https://github.com/<username>/<repositoryname>.git` into your browser – you should see your existing repository on GitHub. 
   * Please double-check that you have the necessary rights to make changes to the given project!  

3. Add `angular-cli-ghpages` to your project.

   ```sh
   ng add angular-cli-ghpages
   ```

4. Deploy your project to Github pages with all default settings.
   Your project will be automatically build in production mode.

   ```sh
   ng run hello-world:deploy
   ```

5. Your project should be available at `http(s)://<username>.github.io/<projectname>`.
   Learn more about GitHub pages on the [official website](https://pages.github.com/).


## Options

- `--base-href` - specifies the base url for the application being built. Same as `ng build --base-href=XXX`.
- `--configuration`
- TODO: document all the other options! 


## 🏁 Next milestones <a name="milestones"></a>

We are glad that we have an integration into the CLI again.
But we are looking forward to the following features:

* an interactive command-line prompt that guides you through the available options 
* a configuration file (`angular-cli-ghpages.json`) to avoid all these command-line cmd options

We look forward to any help. PRs are welcome! 😃

## ⁉️ FAQ <a name="faq"></a>

Before posting any issue, [please read the FAQ first](https://github.com/angular-schule/angular-cli-ghpages/wiki/FAQ).
See the contributors documentation at [README_contributors](README_contributors) if you want to debug and test this project.


## License
Code released under the [MIT license](LICENSE).

<hr>

<img src="https://assets.angular.schule/logo-angular-schule.png" height="60">  

### &copy; 2019 https://angular.schule

[npm-url]: https://www.npmjs.com/package/angular-cli-ghpages
[npm-image]: https://badge.fury.io/js/angular-cli-ghpages.svg
