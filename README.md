# angular-cli-ghpages

[![NPM version][npm-image]][npm-url]
[![GitHub Actions](https://github.com/angular-schule/angular-cli-ghpages/actions/workflows/main.yml/badge.svg)](https://github.com/angular-schule/angular-cli-ghpages/actions/workflows/main.yml)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)

**Deploy your Angular app to GitHub Pages, Cloudflare Pages or any other Git repo directly from the Angular CLI! 🚀**

![Screenshot](docs/img/angular-cli-ghpages-deploy.gif)

**Table of contents:**

1. [📖 Changelog](#changelog)
2. [⚠️ Prerequisites](#prerequisites)
3. [🚀 Quick Start](#quickstart)
4. [⚙️ Installation](#installation)
5. [🚀 Continuous Delivery](#continuous-delivery)
6. [📦 Deployment Options](#options)
   - [--base-href](#base-href)
   - [--build-target](#build-target)
   - [--prerender-target](#prerender-target)
   - [--no-build](#no-build)
   - [--repo](#repo)
   - [--message](#message)
   - [--branch](#branch)
   - [--name & --email](#name)
   - [--no-dotfiles](#no-dotfiles)
   - [--no-notfound](#no-notfound)
   - [--no-nojekyll](#no-nojekyll)
   - [--cname](#cname)
   - [--add](#add)
   - [--dir](#dir)
   - [--dry-run](#dry-run)
7. [📁 Configuration File](#configuration-file)
8. [🅰️ About](#about)

<hr>

## 📖 Changelog <a name="changelog"></a>

A detailed changelog is available in the [releases](https://github.com/angular-schule/angular-cli-ghpages/releases) section.

`angular-cli-ghpages` v3 supports Angular 18 to 21.
For previous versions of Angular, use v1 or v2.

## ⚠️ Prerequisites <a name="prerequisites"></a>

This command has the following prerequisites:

- Git 1.9 or higher (execute `git --version` to check your version)
- Angular project created via [Angular CLI](https://github.com/angular/angular-cli) v18 or greater
- Older Angular projects can still use a v1.x version or use the standalone program. See the documentation at [README_standalone](https://github.com/angular-schule/angular-cli-ghpages/blob/master/docs/README_standalone.md).

## 🚀 Quick Start <a name="quickstart"></a>

`angular-cli-ghpages` compiles your app, then pushes the build output to a dedicated branch (default: `gh-pages`) – all with a single command: `ng deploy`. This branch serves as the source for your web host and works out of the box with GitHub Pages and Cloudflare Pages.

This quick start assumes that you are starting from scratch.
If you already have an existing Angular project on GitHub, skip steps 1 and 2.

1. Install the latest version of the Angular CLI globally
   and create a new Angular project.

   ```sh
   npm install --location=global @angular/cli
   ng new your-angular-project
   cd your-angular-project
   ```

2. By default, the Angular CLI initializes a Git repository for you.  
   To add a new remote for GitHub, use the `git remote add` command:

   ```sh
   git remote add origin https://github.com/<username>/<repositoryname>.git
   ```

   Hints:

   - Create a new empty GitHub repository first.
   - Replace `<username>` and `<repositoryname>` with your username from GitHub and the name of your new repository.
   - Please enter the URL `https://github.com/<username>/<repositoryname>.git` into your browser – you should see your existing repository on GitHub.
   - Please double-check that you have the necessary rights to make changes to the given project!

3. Add `angular-cli-ghpages` to your project. When you run `ng deploy` for the first time, the Angular CLI will prompt you to choose a deployment target – select **GitHub Pages**:

   ```sh
   ng deploy
   ```

   ```
   Would you like to add a package with "deploy" capabilities now?
     No
     Amazon S3
     Firebase
     Netlify
   ❯ GitHub Pages

   ↑↓ navigate • ⏎ select
   ```

   Alternatively, you can install it directly via `ng add angular-cli-ghpages`. See the [installation section](#installation) for details.

4. After the installation, the same `ng deploy` command will build and deploy your project. Your project will be automatically built in production mode.

   ```sh
   ng deploy --base-href=/<repositoryname>/
   ```

   Please be aware of the `--base-href` option. It is necessary when your project will be deployed to a non-root folder. See more details below.

5. Your project should be available at `https://<username>.github.io/<repositoryname>`.  
   Learn more about GitHub pages on the [official website](https://pages.github.com/).

## ⚙️ Installation <a name="installation"></a>

`angular-cli-ghpages` can be installed via `ng add`.
This will install the NPM package and add the necessary `deploy` configuration to your `angular.json` file.

```sh
ng add angular-cli-ghpages
```

If you have multiple projects in one workspace, you should manually define the project name:

```sh
ng add angular-cli-ghpages --project MYPROJECTNAME
```

## 🚀 Continuous Delivery <a name="continuous-delivery"></a>

If you run this command from a CI/CD environment, the deployment will most likely not work out of the box.
For security reasons, those environments usually have read-only privileges, or you haven't set up Git correctly.
Therefore, you should take a look at ["personal access tokens" `GH_TOKEN`](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) (which works everywhere) and the ["installation access token" `GITHUB_TOKEN`](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token) (which is exclusively provided by GitHub actions).
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

> **ℹ️ Note for GitHub Actions**
>
> The `GITHUB_TOKEN` (installation access token) will only trigger a release of a new website if the action runs in a private repository. In a public repo, a commit is generated, but the site does not change. If your repo is public, you must still use the `GH_TOKEN` (personal access token).

## 📦 Deployment Options <a name="options"></a>

#### --base-href <a name="base-href"></a>

- **optional**
- Default: `undefined` (string)
- Example:
  - `ng deploy` – The tag `<base href="/">` remains unchanged in your `index.html`
  - `ng deploy --base-href=/the-repositoryname/` – The tag `<base href="/the-repositoryname/">` is added to your `index.html`

Specify the base URL for the application being built.
Same as `ng build --base-href=/XXX/`

**ℹ️ Please read the next lines carefully, or you will get 404 errors in case of a wrong configuration!**

##### A) You don't want to use a custom domain

If you don't want to use your own domain, the URL of your hosted Angular project will look like this:
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

#### --build-target <a name="build-target"></a>

- **optional**
- Default: `undefined` (string)
- Example:
  - `ng deploy` – Angular project is built in `production` mode
  - `ng deploy --build-target=test` – Angular project is using the build configuration `test` (this configuration must exist in the `angular.json` file)

If no `buildTarget` is set, the `production` build of the default project will be chosen.
The `buildTarget` simply points to an existing build configuration for your project, as specified in the `configurations` section of `angular.json`.
Most projects have a default configuration and a production configuration (commonly activated by using the `--configuration production` option) but it is possible to specify as many build configurations as needed.

This is equivalent to calling the command `ng build --configuration=XXX`.
This command has no effect if the option `--no-build` is active.

**⚠️ BREAKING CHANGE (v1)**

This option was called `--configuration` in previous versions.

BEFORE (_does not work_):

```
ng deploy --configuration=test
```

NOW:

```
ng deploy --build-target=test
```

#### --prerender-target <a name="prerender-target"></a>

- **optional**
- Default: `undefined`

Specifies the Angular architect target to use for prerendering instead of buildTarget.

**Target Precedence:** If `prerenderTarget` is specified, it takes precedence over `buildTarget`. This option has no effect if `--no-build` is active.

#### --no-build <a name="no-build"></a>

- **optional**
- Default: `false` (boolean)
- Example:
  - `ng deploy` – Angular project is built in production mode before the deployment
  - `ng deploy --no-build` – Angular project is NOT built

Skip the build process during deployment.
This can be used when you are sure that you haven't changed anything and want to deploy with the latest artifact.
This command causes the `--build-target` setting to have no effect.

#### --repo <a name="repo"></a>

- **optional**
- Default: URL of the origin remote of the current dir (assumes a Git repository)
- Example: `ng deploy --repo=https://github.com/<username>/<repositoryname>.git`

This specifies the target repository. If none is given as an option, the repository is discovered from the current working directory.

By default, this command assumes that the current working directory is a Git repository,
and that you want to push changes to the `origin` remote.
If instead, your files are not in a git repository, or if you want to push to another repository,
you can provide the repository URL in the `repo` option.

> **ℹ️ Hint**
>
> Set an environment variable with the name `GH_TOKEN` / `PERSONAL_TOKEN` or `GITHUB_TOKEN` and it will be automatically added to the URL, if it uses the HTTPS schema (it must start with `https://github.com`).
> Tokens are generally not supported for Git over SSH (starts with `git@github.com`).

Learn more about ["personal access tokens" here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) (`GH_TOKEN`) and about the ["installation access token" here](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token) (`GITHUB_TOKEN`). `PERSONAL_TOKEN` is an alias for `GH_TOKEN`.

#### --message <a name="message"></a>

- **optional**
- Default: `Auto-generated commit` (string)
- Example: `ng deploy --message="What could possibly go wrong?"`

The commit message **must be wrapped in quotes** if there are any spaces in the text.  
Some additional text is always added to the message, if the command runs on Travis CI, CircleCI or GitHub Actions.

#### --branch <a name="branch"></a>

- **optional**
- Default: `gh-pages` (string)
- Example: `ng deploy --branch=master`

The name of the branch you'll be pushing to.
The default uses GitHub's `gh-pages` branch,
but this can be configured to push to any branch on any remote.
You may need to change this to `main` (or `master` for older repositories) if you are pushing to a GitHub organization page (instead of a GitHub user page).

#### --name & --email <a name="name"></a>

- **optional**
- Default: value of `git config user.name` and `git config user.email`
- Example: `ng deploy --name="Displayed Username" --email=mail@example.org`

If you run the command in a repository without `user.name` or `user.email` Git config properties
(or on a machine without these global config properties),
you must provide user info before Git allows you to commit.
In this case, provide **both** `name` and `email` string values to identify the committer.

#### --no-dotfiles <a name="no-dotfiles"></a>

- **optional**
- Default: Dotfiles are created (boolean `true`)
- Example:
  - `ng deploy` – Dotfiles are included by default.
  - `ng deploy --no-dotfiles` – Dotfiles are ignored.

The command includes dotfiles by default (e.g. `.htaccess` will be committed).
With `--no-dotfiles` files starting with `.` are ignored.

#### --no-notfound <a name="no-notfound"></a>

- **optional**
- Default: `404.html` file is created (boolean `true`)
- Example:
  - `ng deploy` – A `404.html` file is created by default.
  - `ng deploy --no-notfound` – No `404.html` file is created.

By default, a `404.html` file is created, because this is the only known workaround for SPA routing on GitHub Pages (note: GitHub still returns HTTP 404 status, which may affect Brave browser and social previews).

> [!IMPORTANT]
> **Cloudflare Pages users:** You **must** use `--no-notfound` to enable native SPA routing. Cloudflare Pages only activates SPA mode when no `404.html` file exists. See [#178](https://github.com/angular-schule/angular-cli-ghpages/issues/178)
>
> We plan to change the default behavior in a future release to better support Cloudflare Pages.

#### --no-nojekyll <a name="no-nojekyll"></a>

- **optional**
- Default: `.nojekyll` file is created (boolean `true`)
- Example:
  - `ng deploy` – A `.nojekyll` file is created by default.
  - `ng deploy --no-nojekyll` – No `.nojekyll` file is created.

By default, a `.nojekyll` file is created, because we assume you don't want to compile the build again with Jekyll.

**Explanation:**
By creating such a file in the root of your pages repo, you will bypass the Jekyll static site generator on GitHub Pages.
Static content is still delivered – even without Jekyll.
But now the deployment will be a bit faster.
This is also necessary if your site uses files or directories that start with **\_underscores** since Jekyll considers these to be special resources and does not copy them to the final site.
The same applies to `.txt` files in your assets folder: They will just disappear if Jekyll processes the build. see [#160](https://github.com/angular-schule/angular-cli-ghpages/issues/160)

#### --cname <a name="cname"></a>

- **optional**
- Default: `undefined` (string) – No CNAME file is generated
- Example:
  - `ng deploy --cname=example.com`

A CNAME file will be created enabling you to use a custom domain.
[More information on GitHub Pages using a custom domain](https://help.github.com/articles/using-a-custom-domain-with-github-pages/).

#### --add <a name="add"></a>

- **optional**
- Default: `false` (boolean) – The existing files will be removed from the branch you'll be pushing to as expected.
- Example:
  - `ng deploy --add=true`

If it is set to `true`, it will only add, and never remove existing files.
By default, existing files in the target branch are removed before adding new ones.
[More information](https://www.npmjs.com/package/gh-pages#optionsadd).

#### --dir <a name="dir"></a>

- **optional**
- Default: `undefined` (string) – Conventions will be used to guess the correct directory in your `dist` folder.
- Example:
  - `ng deploy --dir=dist/completely-different-folder/en`

Overrides the directory for all published sources, relative to the current working directory.

#### --dry-run <a name="dry-run"></a>

- **optional**
- Default: `false` (boolean)
- Example:
  - `ng deploy` – Normal behavior: Changes are applied.
  - `ng deploy --dry-run` – No changes are applied at all.

Run through without making any changes.
This can be very useful because it outputs what would happen without doing anything.

## 📁 Configuration File <a name="configuration-file"></a>

To avoid repeating command-line options, you can configure them in your `angular.json` file under the `options` key of your deploy configuration. Use camelCase instead of kebab-case. Available options:

<!-- deprecated options (noSilent) hidden per deprecation policy -->
- baseHref
- buildTarget
- prerenderTarget
- noBuild
- remote
- repo
- message
- branch
- name
- email
- noDotfiles
- noNotfound
- noNojekyll
- cname
- add
- dir
- dryRun

A list of all available options is also available [here](https://github.com/angular-schule/angular-cli-ghpages/blob/master/src/deploy/schema.json).

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

Now you can just run `ng deploy` without all the options in the command line!

> **ℹ️ Hint**
>
> You can always use the [--dry-run](#dry-run) option to verify if your configuration is right.
> The project will build but not deploy.

## 🅰️ About <a name="about"></a>

![Angular.Schule](https://assets.angular.schule/header-only-logo.png)

🇬🇧 `angular-cli-ghpages` is brought to you by the **Angular.Schule** team – two Google Developer Experts (GDE) from Germany. We get you and your team up to speed with Angular through remote trainings in English! Visit [angular.schule](https://angular.schule) to learn more.

🇩🇪 `angular-cli-ghpages` wurde für Sie entwickelt von der **Angular.Schule**! Wir machen Sie und Ihr Team fit für das Webframework Angular – in [offenen Gruppen](https://angular.schule/schulungen/online) oder [individuellen Inhouse-Schulungen](https://angular.schule/schulungen/online-teams). Von den Buchautoren und Google Developer Experts (GDE) Johannes Hoppe und Ferdinand Malcher.

<img src="https://assets.angular.schule/logo-angular-schule.png" height="60">

© 2017-2026

[npm-url]: https://www.npmjs.com/package/angular-cli-ghpages
[npm-image]: https://img.shields.io/npm/v/angular-cli-ghpages.svg
