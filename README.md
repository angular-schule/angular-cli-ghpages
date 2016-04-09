# angular-cli-ghpages

Angular CLI addon. Publish to any gh-pages branch on GitHub (or any other branch on any other remote).  
This is __NOT__ [IgorMinar/angular-cli-github-pages](https://github.com/IgorMinar/angular-cli-github-pages) - but inspired by it.

## WHY?

[IgorMinar/angular-cli-github-pages](https://github.com/IgorMinar/angular-cli-github-pages) is fixed to the `gh-pages` branch of the same repository. In my oponion it is also trying to do too much.
In contrast to this, the [Angular2Buch/angular-cli-ghpages](https://github.com/Angular2Buch/angular-cli-ghpages) addon is much more simple. It pushes to any branch on any repository, by utilizing [tschaub/gh-pages](https://github.com/tschaub/gh-pages). Nothing more.
This addon works perfectly on Travis-CI.

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
ng build --environment=production
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





## License
Code released under the [MIT license](https://opensource.org/licenses/MIT).