# angular-cli-ghpages

<hr>

![Screenshot](screenshot-travis.png)

<hr>

Angular CLI addon. Publish to any gh-pages branch on GitHub (or any other branch on any other remote).  
Made for Travis-CI. Brought to you by the [angular2buch.de](https://angular2buch.de/) team! 

## WHY?

This is __NOT__ [IgorMinar/angular-cli-github-pages](https://github.com/IgorMinar/angular-cli-github-pages). That addon is limited to the `gh-pages` branch of the same repository.

In contrast to this, the [Angular2Buch/angular-cli-ghpages](https://github.com/Angular2Buch/angular-cli-ghpages) addon is able to push to any branch on any repository. It's build on top of [tschaub/gh-pages](https://github.com/tschaub/gh-pages).
__This addon works great on [Travis-CI](https://travis-ci.org/).__ No git credentials must be set up in before. Specific environment variables of Travis-CI are evaluated, too.

## Installation & Setup

This addon has the following prerequisites:

- Node.js 4.x
- Git 1.7.6 or higher
- Angular project created via [angular-cli](https://github.com/angular/angular-cli)

To install this addon all you need to do is install `angular-cli-github-pages` via npm:

```sh
npm i angular-cli-ghpages --saveDev
```

## Usage

Run `ng build` to fill the `dist` folder.
Then execute `ng ghpages` in order to deploy it.

Usage:

```sh
ng build
ng ghpages [OPTIONS]
```

## Options

#### <a id="repo">--repo</a>
 * optional
 * default: url of the origin remote of the current dir (assumes a git repository)

By default, [tschaub/gh-pages](https://github.com/tschaub/gh-pages) assumes that the current working directory is a git repository, and that you want to push changes to the `origin` remote. If instead your script is not in a git repository, or if you want to push to another repository, you can provide the repository URL in the `repo` option.

#### <a id="message">--message</a>
 * optional
 * default: `Auto-generated commit`

The commit message, __must be wrapped in quotes__.  
Hardcoded additional text is always added, if the environment variable `process.env.TRAVIS` exists (for Travis CI). 

Example:
```sh
ng ghpages --message "What could possibly go wrong?"
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

> This option should be used if the repository URL or other information passed to git commands is sensitive and should not be logged. By default the silent mode is enabled to avoid sensitive data exposure.


## Extra

For your convenience, the addon will recognize the [environment variable](https://docs.travis-ci.com/user/environment-variables/#Defining-Variables-in-Repository-Settings) `REPO_USER_AND_PASS` and will replace this pattern in the `--repo` string. Please __do NOT disable the silent mode__ if you have credentials in the repository URL!

In example, the following command runs [on our Travis-CI](https://travis-ci.org/Angular2Buch/book-monkey2):

```sh
ng build --environment=production
ng ghpages --repo=https://REPO_USER_AND_PASS@github.com/Angular2Buch/book-monkey2-public.git --name="The Buildbot" --email=buildbot@angular2buch.de
```
> REPO_USER_AND_PASS stores credentials in the format `username:password`. Special charcaters must be [percent-encoded](https://en.wikipedia.org/wiki/Percent-encoding).

### A hint for angular-cli

Your build can break if `angular-cli` from package.json and the global `ng` command have different versions.  
You might want to define a run-script like this: 

```js
  "scripts": {
    "start": "ng server",
    "ng": "ng"
  }
```

Now you can avoid a gloabl `ng` like this:

```npm run ng -- ghpages --repo=https://XXX```

The special extra option `--` is used to delimit the end of the command. npm will pass all the arguments after the -- directly to your script. __Happy building!__



## License
Code released under the [MIT license](https://opensource.org/licenses/MIT).