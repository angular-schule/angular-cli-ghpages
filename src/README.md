# @angular-schule/ngx-deploy-starter

**Deploy your Angular app to the file system directly from the Angular CLI! 🚀**

> **Warning:**  
> This is a sample project that helps you to implement your own deployment builder (`ng deploy`) for the Angular CLI.
> The actual "deployment" is only a simple copy to another folder in the file system.
>
>**Learn more at
> https://github.com/angular-schule/ngx-deploy-starter**

## Usage

Add `@angular-schule/ngx-deploy-starter` to your project.

```bash
ng add @angular-schule/ngx-deploy-starter
```

Deploy your project to the file system.

```
ng deploy [options]
```


## Options

The following options are also available.


#### --configuration
 * __optional__
 * Default: `production` (string)
 * Example:
    * `ng deploy` – Angular project is build in production mode
    * `ng deploy --configuration=test` – Angular project is using the configuration `test` (this configuration must exist in the `angular.json` file)

A named build target, as specified in the `configurations` section of `angular.json`.
Each named target is accompanied by a configuration of option defaults for that target.
Same as `ng build --configuration=XXX`.
This command has no effect if the option `--no-build` option is active.

> **This is a proposal from [RFC #1](https://github.com/angular-schule/ngx-deploy-starter/issues/1).**


#### --no-build
 * __optional__
 * Default: `false` (string)
 * Example:
    * `ng deploy` – Angular project is build in production mode before the deployment
    * `ng deploy --no-build` – Angular project is NOT build 

Skip build process during deployment.
This can be used when you are sure that you haven't changed anything and want to deploy with the latest artifact.
This command causes the `--configuration` setting to have no effect.

> **This is a proposal from [RFC #1](https://github.com/angular-schule/ngx-deploy-starter/issues/1).**


#### --target-dir
 * __optional__
 * Default: `/example-folder` (string)
 * Example:
    * `ng deploy` -- App is "deployed" to the example folder (if existing)
    * `ng deploy --target=/var/www/html` -- App is "deployed" to another folder

> **This is one of the options you can freely choose according to your needs.**


#### --base-href <a name="base-href"></a>
 * __optional__
 * Default: `undefined` (string)
 * Example:
    * `ng deploy` -- `<base href="/">` remains unchanged in your `index.html`
    * `ng deploy --base-href=/the-repositoryname/` -- `<base href="/the-repositoryname/">` is added to your `index.html`

Specifies the base URL for the application being built.
Same as `ng build --base-href=/XXX/`

> **This is an example how to override the workspace set of options.**
