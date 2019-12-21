# angular-cli-ghpages: README for the standalone program

In the past this project was a standalone program.
This is still possible.

## Installation & Setup

To install the command as a standalone program run the following:

```bash
npm i angular-cli-ghpages --save-dev
```

Note: you can skip the permanent installation, too.
The command `npx` is also able to install `angular-cli-ghpages` on the first usage, if you want. 


## Usage

Execute `npx angular-cli-ghpages` in order to deploy the project with a build from `dist` folder.  
__Note: you have to create the  `dist` folder in before (e.g. `ng build --prod`)__

Usage:

```bash
ng build --prod --base-href "https://USERNAME.github.io/REPOSITORY_NAME/"
npx angular-cli-ghpages [OPTIONS]
```

or

```bash
ng build --prod --base-href "/REPOSITORY_NAME/"
npx angular-cli-ghpages [OPTIONS]
```

or (`<base href="/">` stays untouched)

```bash
ng build --prod
npx angular-cli-ghpages [OPTIONS]
```

If you want to push to `gh-pages` on the same repository with your default credentials, then just enter `npx angular-cli-ghpages` without any options.


### Usage with Angular CLI 6 or higher

With Angular CLI 6 the build artifacts will be put in a subfolder under `dist`.
Please take a look at the `dist` folder to see whether there is a subfolder with your project's name or not.
If yes, you need to specify the deploy directory manually then when using this tool:

```bash
npx angular-cli-ghpages --dir=dist/[PROJECTNAME]
```

I most cases, the `[PROJECTNAME]` can be found in the `angular.json` file at `defaultProject`.


### Usage with Ionic

You can use the tool with Angular based Ionic projects, too. Instead of the ` dist` folder, the Ionic CLI will create a `www` folder you have to point the tool to. Just use the following commands:

```bash
ionic build --prod -- --base-href=https://USERNAME.github.io/REPOSITORY_NAME/`
```

```bash
npx angular-cli-ghpages --dir=www
```



## Extra

For your convenience, the command will recognize the [environment variable](https://docs.travis-ci.com/user/environment-variables/#Defining-Variables-in-Repository-Settings) `GH_TOKEN` and will replace this pattern in the `--repo` string. Please __do NOT disable the silent mode__ if you have any credentials in the repository URL! Read more about [Github tokens here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/).

In example, the following command runs [on our Travis-CI](https://travis-ci.org/angular-buch/book-monkey2):

```bash
npx angular-cli-ghpages --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git --name="Displayed Username" --email=mail@example.org
```
> You have to treat the GH_TOKEN as secure as a password!



## Options

#### --help <a name="help"></a>
 * Example: `npx angular-cli-ghpages --help`

Output usage information.


#### --version <a name="version"></a>
 * Example: `npx angular-cli-ghpages --version`

Output the version number. Please provide the version number on any bug report!


#### --repo <a name="repo"></a>
 * __optional__
 * Default: url of the origin remote of the current dir (assumes a git repository)
 * Example: `npx angular-cli-ghpages --repo=https://GH_TOKEN@github.com/<username>/<repositoryname>.git`

By default, __gh-pages__ assumes that the current working directory is a git repository,
and that you want to push changes to the `origin` remote.
If instead your files are not in a git repository, or if you want to push to another repository,
you can provide the repository URL in the `repo` option.


#### --message <a name="message"></a>
 * __optional__
 * Default: `Auto-generated commit`
 * Example: `npx angular-cli-ghpages --message="What could possibly go wrong?"`

The commit message, __must be wrapped in quotes__.  
Some handy additional text is always added,
if the environment variable `process.env.TRAVIS` exists (for Travis CI).


#### --branch <a name="branch"></a>
 * __optional__
 * Default: `gh-pages`
 * Example: `npx angular-cli-ghpages --branch=other-branch`
 
The name of the branch you'll be pushing to.
The default uses GitHub's `gh-pages` branch,
but this can be configured to push to any branch on any remote.


#### --name & --email <a name="name"></a>
 * __optional__
 * Default: value of `git config user.name` and `git config user.email`
 * Example: `npx angular-cli-ghpages --name="Displayed Username" --email=mail@example.org`

If you are running the command in a repository without a `user.name` or `user.email` git config properties
(or on a machine without these global config properties),
you must provide user info before git allows you to commit.
In this case provide both `name` and `email` string values to identify the committer.


#### --no-silent <a name="no-silent"></a>
 * __optional__
 * Default: silent `true` (boolean)
 * Example:
    * `npx angular-cli-ghpages` -- Logging is in silent mode by default.
    * `npx angular-cli-ghpages --no-silent` -- Logging shows extended information.

Logging is in silent mode by default.
In silent mode, the error messages for git operations are always sanitized.
(The message is always: `'Unspecified error (run without silent option for detail)'`)

The `--no-silent` option enables detailed error messages and extended console logging.
Keep this untouched if the repository URL or other information passed to git commands is sensitive!

> ⚠️ WARNING: This option should be kept as it is if the repository URL or other information passed to Git commands is sensitive and should not be logged (== you have a public build server and you are using the `GH_TOKEN` feature).
> By default the silent mode is enabled to avoid sensitive data exposure.


#### --dir <a name="dir"></a>
 * __optional__
 * Default: `dist`

Directory for all published sources, relative to the project-root.  
__Starting with Angular CLI 6 the build artifacts will be put in a subfolder under `dist`.
Please take a look at the `dist` folder to see whether there is a subfolder with your project's name or not.__

This option can be used to deploy completely different folders,
which are not related at all to angular.



#### --no-dotfiles <a name="no-dotfiles"></a>
 * __optional__
 * Default: dotfiles `true` (boolean)
 * Example:
    * `npx angular-cli-ghpages` -- Dotfiles are included by default.
    * `npx angular-cli-ghpages --no-dotfiles` -- Dotfiles are ignored.

The command includes dotfiles by default (e.g `.htaccess` will be committed)
With `--no-dotfiles` files starting with `.` are ignored.



#### --dry-run <a name="dry-run"></a>
 * __optional__
 * Default: `undefined`
 * Example:
    * `npx angular-cli-ghpages` -- Normal behaviour: Changes are applied.
    * `npx angular-cli-ghpages --dry-run` -- No changes are applied at all.

Run through without making any changes. This can be very usefull, because it outputs what would happend without doing anything.

#### --cname <a name="cname"></a>
 * __optional__
 * Default: `No CNAME file is generated`
 * Example:
    * `npx angular-cli-ghpages --cname=example.com`

A CNAME file will be created enabling you to use a custom domain. [More information on Github Pages using a custom domain](https://help.github.com/articles/using-a-custom-domain-with-github-pages/). 


## FAQ

Before posting any issue, [please read the FAQ first](https://github.com/angular-schule/angular-cli-ghpages/wiki/FAQ).
