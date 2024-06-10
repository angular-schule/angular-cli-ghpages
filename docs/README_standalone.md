# angular-cli-ghpages: README for the standalone program

In the past, this project was a standalone program.
This is still possible.

## Installation & Setup

To install the command as a standalone program run the following:

```bash
npm i angular-cli-ghpages --save-dev
```

Note: you can skip the permanent installation, too.
The command `npx` is also able to install `angular-cli-ghpages` on the first usage, if you want.

## Usage

Execute `npx angular-cli-ghpages` in order to deploy the project with a build from `dist` folder. (`dist` is the default)
**Note: You have to create the `dist` folder first (e.g. by running `ng build`).**

Since Angular CLI 6 the build artifacts will be put in a subfolder, e.g. `dist/PROJECTNAME`.
Since Angular CLI 17 the build artifacts will be put in a subfolder, followed by the folder `browser`, e.g. `dist/PROJECTNAME/browser`.

Please take a look at the `dist` folder to see whether there is a subfolder with your project's name or not.
If yes, you need to specify the deploy directory manually then when using this tool:

Usage:

```bash
ng build --base-href "/REPOSITORY_NAME/"
npx angular-cli-ghpages --dir=dist/[PROJECTNAME]/browser
```

or (`<base href="/">` stays untouched)

```bash
ng build
npx angular-cli-ghpages [OPTIONS]  --dir=dist/[PROJECTNAME]/browser
```

### Usage with Ionic

You can use the tool with Angular based Ionic projects, too. Instead of the ` dist` folder, the Ionic CLI will create a `www` folder you have to point the tool to. Just use the following commands:

```bash
ionic build --prod -- --base-href=https://USERNAME.github.io/REPOSITORY_NAME/`
```

```bash
npx angular-cli-ghpages --dir=www
```

## Extra

For your convenience, the command will recognize the [environment variable](https://docs.travis-ci.com/user/environment-variables/#Defining-Variables-in-Repository-Settings) `GH_TOKEN` and will replace this pattern in the `--repo` string.

In example, the following command runs [on our Travis-CI](https://travis-ci.org/angular-buch/book-monkey2):

```bash
npx angular-cli-ghpages --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git --name="Displayed Username" --email=mail@example.org
```

> Don't share the GH_TOKEN with anyone! It is essentially a password to your GitHub account.

## Options

#### --help <a name="help"></a>

- Example: `npx angular-cli-ghpages --help`

Output usage information.

#### --version <a name="version"></a>

- Example: `npx angular-cli-ghpages --version`

Output the version number. Please provide the version number on any bug report!

#### --repo <a name="repo"></a>

- **optional**
- Default: URL of the origin remote of the current dir (assumes a git repository)
- Example: `npx angular-cli-ghpages --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git`

By default, **gh-pages** assumes that the current working directory is a git repository,
and that you want to push changes to the `origin` remote.
If instead, your files are not in a git repository, or if you want to push to another repository,
you can provide the repository URL in the `repo` option.

#### --remote <a name="remote"></a>

- **optional**
- Default: `origin`
- Example: `npx angular-cli-ghpages --remote=github`

By default, **gh-pages** assumes that the current working directory is a git repository,
and that you want to push changes to the `origin` remote.
If you want to push to another remote, you can provide the remote name in the `remote` option.

#### --message <a name="message"></a>

- **optional**
- Default: `Auto-generated commit`
- Example: `npx angular-cli-ghpages --message="What could possibly go wrong?"`

The commit message **must be wrapped in quotes**.  
Some handy additional text is always added,
if the environment variable `process.env.TRAVIS` exists (for Travis CI).

#### --branch <a name="branch"></a>

- **optional**
- Default: `gh-pages`
- Example: `npx angular-cli-ghpages --branch=other-branch`

The name of the branch you'll be pushing to.
The default uses GitHub's `gh-pages` branch,
but this can be configured to push to any branch on any remote.

#### --name & --email <a name="name"></a>

- **optional**
- Default: value of `git config user.name` and `git config user.email`
- Example: `npx angular-cli-ghpages --name="Displayed Username" --email=mail@example.org`

If you are running the command in a repository without a `user.name` or `user.email` git config properties
(or on a machine without these global config properties),
you must provide user info before git allows you to commit.
In this case provide both `name` and `email` string values to identify the committer.

#### --dir <a name="dir"></a>

- **optional**
- Default: `dist`

Directory for all published sources, relative to the current working directory.  
**Starting with Angular CLI 6, the build artifacts will be put in a subfolder under `dist`.
Please take a look at the `dist` folder to see whether there is a subfolder with your project's name or not.**

This option can be used to deploy completely different folders,
which are not related at all to angular.

#### --no-dotfiles <a name="no-dotfiles"></a>

- **optional**
- Default: dotfiles `true` (boolean)
- Example:
  - `npx angular-cli-ghpages` -- Dotfiles are included by default.
  - `npx angular-cli-ghpages --no-dotfiles` -- Dotfiles are ignored.

The command includes dotfiles by default (e.g. `.htaccess` will be committed)
With `--no-dotfiles` files starting with `.` are ignored.

#### --dry-run <a name="dry-run"></a>

- **optional**
- Default: `undefined`
- Example:
  - `npx angular-cli-ghpages` -- Normal behaviour: Changes are applied.
  - `npx angular-cli-ghpages --dry-run` -- No changes are applied at all.

Run through without making any changes. This can be very usefull, because it outputs what would happend without doing anything.

#### --cname <a name="cname"></a>

- **optional**
- Default: `No CNAME file is generated`
- Example:
  - `npx angular-cli-ghpages --cname=example.com`

A CNAME file will be created enabling you to use a custom domain. [More information on Github Pages using a custom domain](https://help.github.com/articles/using-a-custom-domain-with-github-pages/).

#### --add <a name="add"></a>

- **optional**
- Default: `false` (boolean) – The existing files will be removed from the branch you'll be pushing to as expected.
- Example:
  - `npx angular-cli-ghpages --add=true`

If is set to `true`, it will only add, and never remove existing files.
By default, existing files in the target branch are removed before adding the ones.
[More information](https://www.npmjs.com/package/gh-pages#optionsadd).

## FAQ

Before posting any issue, [please read the FAQ first](https://github.com/angular-schule/angular-cli-ghpages/wiki/FAQ).
