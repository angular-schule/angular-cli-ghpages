# Angular CLI Deployment to GitHub Pages

Deploy your Angular app to GitHub pages directly from the Angular CLI! 🚀

## How to use?

```
ng add ngx-gh
ng run [PROJECT_NAME]:deploy
```

## Options

If you're deploying your application to `https://[USERNAME].github.io/[PROJECT_NAME]`, you'd have to set the following options:

- `--deployUrl` - specifies the URL you're deploying your application to. For example `https://mgechev.github.io/codelyzer/`.
- `--baseHref` - specifies the `baseHref` and used by the Angular router. For the example above, the `baseHref` would be `/codelyzer/`.

Sample invocation:

```
ng run codelyzer:deploy --baseHref /codelyzer/
```

In Angular CLI 8.2.0, the command would be:

```
ng deploy --baseHref /codelyzer/
```

Deployment to the root of a custom domain may not require any of the listed flags below.

## Configuring the build

Since `ng deploy` will automatically invoke the production build of your app, you can configure it using the workspace configuration file `angular.json`. You can find the build config under: `projects.[PROJECT_NAME].architect.build.configuration.production`.

## License

MIT

