# angular-cli-ghpages
[![NPM version][npm-image]][npm-url]

<hr>

![Screenshot](screenshot-travis.png)

<hr>

This __was__ an angular CLI addon (until they [removed addon support](https://github.com/angular/angular-cli/pull/3695)).
Now it's just a wrapper around [tschaub/gh-pages](https://github.com/tschaub/gh-pages).

Publish to any gh-pages branch on GitHub (or any other branch on any other remote).  
Made for Travis-CI. Brought to you by the [angular-buch.com](https://angular-buch.com/) team! 

## About

This script is similar to the normal `github-pages:deploy` command.
But by design, the command is limited to the `gh-pages` branch of the same repository.  
__New: The deploy command is being removed from the core of the CLI very soon! [#4385](https://github.com/angular/angular-cli/pull/4385)__


In contrast to this, the [angular-buch/angular-cli-ghpages](https://github.com/angular-buch/angular-cli-ghpages) script is able to push to any branch on any repository. It's made on top of [tschaub/gh-pages](https://github.com/tschaub/gh-pages).
__This script works great on [Travis-CI](https://travis-ci.org/).__ No git credentials must be set up in before. Specific environment variables of Travis-CI are evaluated, too. You will like it!


## Installation & Setup

This addon has the following prerequisites:

- Node.js 4.x
- Git 1.7.6 or higher
- Optional: Angular project created via [angular-cli](https://github.com/angular/angular-cli)

To install this addon run the following command:

```sh
npm i -g angular-cli-ghpages
```

## Usage

Execute `angular-cli-ghpages` in order to deploy the project with a build from `dist` folder.  
__Note: you have to create the  `dist` folder in before (e.g. `ng build --prod`)__

Usage:

```sh
ng build
angular-cli-ghpages [OPTIONS]
```

there is also a shorter `ngh` command available

```sh
ng build
ngh [OPTIONS]
```

If you want to push to `gh-pages` on the same repository with your default credentials, then just enter `ngh` without any options.

## Options

#### <a id="repo">--repo</a>
 * optional
 * default: url of the origin remote of the current dir (assumes a git repository)

By default, __gh-pages__ assumes that the current working directory is a git repository, and that you want to push changes to the `origin` remote. If instead your script is not in a git repository, or if you want to push to another repository, you can provide the repository URL in the `repo` option.

#### <a id="message">--message</a>
 * optional
 * default: `Auto-generated commit`

The commit message, __must be wrapped in quotes__.  
Some handy additional text is always added, if the environment variable `process.env.TRAVIS` exists (for Travis CI).

Example:
```sh
angular-cli-ghpages --message="What could possibly go wrong?"
```


#### <a id="branch">--branch</a>
 * optional
 * default: `gh-pages`
 
The name of the branch you'll be pushing to.  The default uses GitHub's `gh-pages` branch, but this can be configured to push to any branch on any remote.


#### <a id="name">--name & --email</a>
 * optional
 * default: value of `git config user.name` and `git config user.email`

If you are running the command in a repository without a `user.name` or `user.email` git config properties (or on a machine without these global config properties), you must provide user info before git allows you to commit. In this case provide both `name` and `email` string values to identify the committer.


#### <a id="silent">--silent</a>
 * optional
 * default: `true` (boolean)

Suppress logging. With silent `true` log messages are suppressed and error messages are sanitized.

> This option should be used if the repository URL or other information passed to git commands is sensitive and should not be logged (== you have a public build server). By default the silent mode is enabled to avoid sensitive data exposure.


#### <a id="dir">--dir</a>
 * optional
 * default: `dist`

Directory for all published sources, relative to the project-root.  
Most probably no change is required here.
This option can be used to deploy completely different folders, which are not related at all to angular.



#### <a id="dotfiles">--dotfiles</a>
 * optional
 * default: `true` (boolean)

Includes dotfiles by default. When set to `false` files starting with `.` are ignored.



## Extra

For your convenience, the addon will recognize the [environment variable](https://docs.travis-ci.com/user/environment-variables/#Defining-Variables-in-Repository-Settings) `GH_TOKEN` and will replace this pattern in the `--repo` string. Please __do NOT disable the silent mode__ if you have any credentials in the repository URL! Read more about [Github tokens here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/).

In example, the following command runs [on our Travis-CI](https://travis-ci.org/angular-buch/book-monkey2):

```sh
angular-cli-ghpages --repo=https://GH_TOKEN@github.com/organisation/your-repo.git --name="Displayed Username" --email=mail@example.orf
```
> You have to treat the GH_TOKEN as secure as a password!


## Known issues

The old `github-pages:deploy` command created a `404.html` in the `dist` folder.
This was required to fully support the router [`PathLocationStrategy`](https://angular.io/docs/ts/latest/api/common/index/PathLocationStrategy-class.html). Right now you have to copy `index.html` to `404.html` on your own. Please submit an [issue](https://github.com/angular-buch/angular-cli-ghpages/issues) if you want this feature back.


## License
Code released under the [MIT license](https://opensource.org/licenses/MIT).

[npm-url]: https://www.npmjs.com/package/angular-cli-ghpages
[npm-image]: https://badge.fury.io/js/angular-cli-ghpages.svg
