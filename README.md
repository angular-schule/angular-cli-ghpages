# angular-cli-ghpages

Angular CLI addon. Publish to any gh-pages branch on GitHub (or any other branch on any other remote).  
This is __NOT__ [angular-cli-github-pages](https://github.com/IgorMinar/angular-cli-github-pages).

## WHY?

angular-cli-github-pages is fixed to the `gh-pages` branch of the same repository.
We don't like this. So this addon pushes to any branch on any repository. It also does not require SSH to be set up. This works perfectly for Travis-CI.

## Installation & Setup

This addon has the following prerequisites:

- Node.js 4.x
- Angular project created via [angular-cli](https://github.com/angular/angular-cli)

To install this addon all you need to do is install angular-cli-github-pages via npm:

```sh
npm install --save-dev angular-cli-ghpages
```

## Usage

Once that's done, you can checkout the branch you want to create the gh-page
from (likely master) and run the command to build and commit it.

Then run `ng ghpages` in order to deploy it.

```sh
ng build
ng ghpages XXX
```

## License
Code released under the [MIT license](https://opensource.org/licenses/MIT).