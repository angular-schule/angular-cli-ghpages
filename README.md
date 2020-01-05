# angular-cli-ghpages

[![NPM version][npm-image]][npm-url]
[![CircleCI](https://circleci.com/gh/angular-schule/angular-cli-ghpages.svg?style=svg)](https://circleci.com/gh/angular-schule/angular-cli-ghpages)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)

**Deploy your Angular app to GitHub pages directly from the Angular CLI! 🚀**

![Screenshot](docs/img/angular-cli-ghpages-deploy.gif)

**Table of contents:**

1. [📖 Changelog](#changelog)
2. [⚠️ Prerequisites](#prerequisites)
3. [🚀 Quick Start (local development)](#quickstart-local)
4. [🚀 Continuous Delivery](#continuous-delivery)
5. [📦 Options](#options)
   - [--base-href](#base-href)
   - [--configuration](#configuration)
   - [--no-build](#no-build)
   - [--repo](#repo)
   - [--message](#message)
   - [--branch](#branch)
   - [--name & --email](#name)
   - [--no-silent](#no-silent)
   - [--no-dotfiles](#no-dotfiles)
   - [--cname](#cname)
   - [--dry-run](#dry-run)
6. [📁 Configuration File](#configuration-file)
7. [🌍 Environments](#environments)
8. [⁉️ FAQ](#faq)

<hr>

## 📖 Changelog <a name="changelog"></a>

A detailed changelog is available in the [releases](https://github.com/angular-schule/angular-cli-ghpages/releases) section.

The latest version comes with enhanced error handling and a progress report:

![Screenshot](docs/img/angular-cli-ghpages-deploy2.gif)

## ⚠️ Prerequisites <a name="prerequisites"></a>

This command has the following prerequisites:

- Git 1.9 or higher (execute `git --version` to check your version)
- Angular project created via [Angular CLI](https://github.com/angular/angular-cli) v8.3.0 or greater (execute `ng update @angular/cli @angular/core` to upgrade your project if necessary)
- older Angular projects can still use the standalone program. See the documentation at [README_standalone](https://github.com/angular-schule/angular-cli-ghpages/blob/master/docs/README_standalone.md).

## 🚀 Quick Start (local development) <a name="quickstart-local"></a>

This quick start assumes that you are starting from scratch.
If you already have an existing Angular project on GitHub, skip step 1 and 2.

1. Install the latest version of the Angular CLI (v8.3.0 or greater) globally
   and create a new Angular project.

   ```sh
   npm install -g @angular/cli
   ng new your-angular-project --defaults
   cd your-angular-project
   ```

2. By default the Angular CLI initializes a Git repository for you.  
   To add a new remote for GitHub, use the `git remote add` command:

   ```sh
   git remote add origin https://github.com/<username>/<repositoryname>.git
   ```

   Hints:

   - Create a new empty GitHub repository first.
   - Replace `<username>` and `<repositoryname>` with your username from GitHub and the name of your new repository.
   - Please enter the URL `https://github.com/<username>/<repositoryname>.git` into your browser – you should see your existing repository on GitHub.
   - Please double-check that you have the necessary rights to make changes to the given project!

3. Add `angular-cli-ghpages` to your project.

   ```sh
   ng add angular-cli-ghpages
   ```

4. Deploy your project to GitHub pages with all default settings.
   Your project will be automatically built in production mode.

   ```sh
   ng deploy
   ```

   Which is the same as:

   ```sh
   ng deploy your-angular-project
   ```

5. Your project should be available at `https://<username>.github.io/<repositoryname>`.  
   Learn more about GitHub pages on the [official website](https://pages.github.com/).

## 🚀 Continuous Delivery <a name="continuous-delivery"></a>

If you run this command from a CI/CD environment, the deployment will most likely not work out of the box.
For security reasons, those environments usually have read-only privileges or you haven't set up Git correctly.
Therefore you should take a look at ["personal access tokens" `GH_TOKEN`](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) (which works everywhere) and the ["installation access token" `GITHUB_TOKEN`](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token) (which is exclusively provided by GitHub actions).
In short: a token replaces username and password and is a safer choice because a token can be revoked at any time.

All you need to do is to set an environment variable called `GH_TOKEN` (or `PERSONAL_TOKEN`) in your CI/CD environment.
For GitHub Actions, you can also use the `GITHUB_TOKEN` which provides more security and requires no additional setup.
All the tokens only work if the remote repository uses the HTTPS scheme.
Tokens are generally not supported for Git over SSH.

If the current working directory is already a git repository, you don't need to specify the repository again. The current remote repository with the name `origin` will be used in this case.
You can also override the repository setting using the `--repo` option.

If you specify all the three options (`--repo`, `--name` and `--email`), then angular-cli-ghpages will also work in directories that are not under version control at all.

```sh
ng deploy --repo=https://github.com/<username>/<repositoryname>.git --name="Your Git Username" --email=your.mail@example.org
```

(replace `<username>` and `<repositoryname>` with your username from GitHub and the name of your repository)

> Please **do not disable the silent mode** if you use tokens, otherwise people could read them in the output logs.
> If you are sure that your CI/CD provider does not display secrets on the console (this applies to CircleCI / Travis CI and Github Actions), you are welcome to disable silent mode.

## 📦 Options <a name="options"></a>

#### --base-href <a name="base-href"></a>

- **optional**
- Default: `undefined` (string)
- Example:
  - `ng deploy` – The tag `<base href="/">` remains unchanged in your `index.html`
  - `ng deploy --base-href=/the-repositoryname/` – The tag `<base href="/the-repositoryname/">` is added to your `index.html`

Specifies the base URL for the application being built.
Same as `ng build --base-href=/XXX/`

**ℹ️ Please read the next lines carefully, or you will get 404 errors in case of a wrong configuration!**

##### A) You don't want to use a custom domain

If you don't want to use an own domain, then your later URL of your hosted Angular project should look like this:
`https://your-username.github.io/the-repositoryname`.
In this case you have to adjust the `--base-href` accordingly:

```sh
ng deploy --base-href=/the-repositoryname/
```

##### B) You want to use a custom domain

If you want to use your own domain, then you don't have to adjust `--base-href`.
However, it is now necessary to set the `--cname` parameter!

```sh
ng deploy --cname=example.org
```

See the option [--cname](#cname) for more information!

#### --configuration <a name="configuration"></a>

- **optional**
- Alias: `-c`
- Default: `production` (string)
- Example:
  - `ng deploy` – Angular project is build in production mode
  - `ng deploy --configuration=test` – Angular project is using the configuration `test` (this configuration must exist in the `angular.json` file)

A named build target, as specified in the `configurations` section of `angular.json`.
Each named target is accompanied by a configuration of option defaults for that target.
Same as `ng build --configuration=XXX`.
This command has no effect if the option `--no-build` option is active.

#### --no-build <a name="no-build"></a>

- **optional**
- Default: `false` (string)
- Example:
  - `ng deploy` – Angular project is build in production mode before the deployment
  - `ng deploy --no-build` – Angular project is NOT build

Skip build process during deployment.
This can be used when you are sure that you haven't changed anything and want to deploy with the latest artifact.
This command causes the `--configuration` setting to have no effect.

#### --repo <a name="repo"></a>

- **optional**
- Default: URL of the origin remote of the current dir (assumes a Git repository)
- Example: `ng deploy --repo=https://github.com/<username>/<repositoryname>.git`

This specifies the target repository. If none is given as an option, the repository is discovered from the current working directory.

By default, this command assumes that the current working directory is a Git repository,
and that you want to push changes to the `origin` remote.
If instead your files are not in a git repository, or if you want to push to another repository,
you can provide the repository URL in the `repo` option.

> **ℹ️ Hint:** Set an environment variable with the name `GH_TOKEN` / `PERSONAL_TOKEN` or `GITHUB_TOKEN` and it will be automatically added to the URL, if it uses the HTTPS shema (it must start with `https://github.com`).
> Tokens are generally not supported for Git over SSH (starts with `git@github.com`).

Learn more about ["personal access tokens" here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) (`GH_TOKEN`) and about the ["installation access token" here](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token) (`GITHUB_TOKEN`). `PERSONAL_TOKEN` is an alias for `GH_TOKEN`.

#### --message <a name="message"></a>

- **optional**
- Default: `Auto-generated commit` (string)
- Example: `ng deploy --message="What could possibly go wrong?"`

The commit message **must be wrapped in quotes** if there are any spaces in the text.  
Some additional text is always added to the message, if the command runs on Travis CI, Circle CI or GitHub Actions.

#### --branch <a name="branch"></a>

- **optional**
- Default: `gh-pages` (string)
- Example: `ng deploy --branch=master`

The name of the branch you'll be pushing to.
The default uses GitHub's `gh-pages` branch,
but this can be configured to push to any branch on any remote.
You have to change this to `master` if you are pushing to a GitHub organization page (instead of a GitHub user page).

#### --name & --email <a name="name"></a>

- **optional**
- Default: value of `git config user.name` and `git config user.email`
- Example: `ng deploy --name="Displayed Username" --email=mail@example.org`

If you run the command in a repository without `user.name` or `user.email` Git config properties
(or on a machine without these global config properties),
you must provide user info before Git allows you to commit.
In this case, provide **both** `name` and `email` string values to identify the committer.

#### --no-silent <a name="no-silent"></a>

- **optional**
- Default: silent `true` (boolean)
- Example:
  - `ng deploy` – Logging is in silent mode by default.
  - `ng deploy --no-silent` – Logging shows extended information.

Logging is in silent mode by default.
In silent mode, the error messages for git operations are always sanitized.
(The message is always: `'Unspecified error (run without silent option for detail)'`)

The `--no-silent` option enables detailed error messages and extended console logging.
Keep this untouched if the repository URL or other information passed to git commands is sensitive!

> **⚠️ WARNING:** This option should be kept as it is if the repository URL or other information passed to Git commands is sensitive and should not be logged (== you have a public build server and you are using the token feature).
> By default the silent mode is enabled to avoid sensitive data exposure.

#### --no-dotfiles <a name="no-dotfiles"></a>

- **optional**
- Default: dotfiles `true` (boolean)
- Example:
  - `ng deploy` – Dotfiles are included by default.
  - `ng deploy --no-dotfiles` – Dotfiles are ignored.

The command includes dotfiles by default (e.g. `.htaccess` will be committed).
With `--no-dotfiles` files starting with `.` are ignored.

**Hint:**
This is super useful if you want to publish a `.nojekyll` file.
Create such a file in the root of your pages repo to bypass the Jekyll static site generator on GitHub Pages.
Static content is still delivered – even without Jekyll.
This should only be necessary if your site uses files or directories that start with **\_underscores** since Jekyll considers these to be special resources and does not copy them to the final site.
→ Or just don't use underscores!

#### --cname <a name="cname"></a>

- **optional**
- Default: `undefined` (string) – No CNAME file is generated
- Example:
  - `ng deploy --cname=example.com`

A CNAME file will be created enabling you to use a custom domain.
[More information on GitHub Pages using a custom domain](https://help.github.com/articles/using-a-custom-domain-with-github-pages/).

#### --dry-run <a name="dry-run"></a>

- **optional**
- Default: `false` (boolean)
- Example:
  - `ng deploy` – Normal behavior: Changes are applied.
  - `ng deploy --dry-run` – No changes are applied at all.

Run through without making any changes.
This can be very useful because it outputs what would happen without doing anything.

## 📁 Configuration File <a name="configuration-file"></a>

To avoid all these command-line cmd options, you can write down your configuration in the `angular.json` file in the `options` attribute of your deploy project's architect. Just change the kebab-case to lower camel case. This is the notation of all options in lower camel case:

- baseHref
- configuration
- noBuild
- repo
- message
- branch
- name
- email
- noSilent
- noDotfiles
- cname
- dryRun

A list of all avaiable options is also available [here](https://github.com/angular-schule/angular-cli-ghpages/blob/master/src/deploy/schema.json).

Example:

```sh
ng deploy --base-href=https://angular-schule.github.io/angular-cli-ghpages/ --name="Angular Schule Team" --email=team@angular.schule
```

becomes

```json
"deploy": {
  "builder": "angular-cli-ghpages:deploy",
  "options": {
    "baseHref": "https://angular-schule.github.io/angular-cli-ghpages/",
    "name": "Angular Schule Team",
    "email": "team@angular.schule"
  }
}
```

And just run `ng deploy` 😄.

> **ℹ️ Hint:** You can always use the [--dry-run](#dry-run) option to verify if your configuration is right.

## 🌍 Environments <a name="environments"></a>

We have seen `angular-cli-ghpages` running on various environments, like Travis CI, CircleCi or Github Actions.
Please share your knowledge by writing an article about how to set up the deployment.

1. [GitHub Actions](https://github.com/angular-schule/angular-cli-ghpages/blob/master/docs/README_environment_github_actions.md) by [Dharmen Shah](https://github.com/shhdharmen)
2. TODO: Travis CI
3. TODO: CircleCI

## ⁉️ FAQ <a name="faq"></a>

Before posting any issue, [please read the FAQ first](https://github.com/angular-schule/angular-cli-ghpages/wiki/FAQ).
See the contributors documentation at [README_contributors](https://github.com/angular-schule/angular-cli-ghpages/blob/master/docs/README_contributors.md) if you want to debug and test this project.

## License <a name="license"></a>

Code released under the [MIT license](LICENSE).

<hr>

## 🚀 Powered by [ngx-deploy-starter](https://github.com/angular-schule/ngx-deploy-starter)

<img src="https://assets.angular.schule/logo-angular-schule.png" height="60">

### &copy; 2019 https://angular.schule

This project is made on top of [tschaub/gh-pages](https://github.com/tschaub/gh-pages).  
Thank you very much for this great foundation!

[npm-url]: https://www.npmjs.com/package/angular-cli-ghpages
[npm-image]: https://badge.fury.io/js/angular-cli-ghpages.svg
