# ngx-deploy-starter

**Deploy your Angular app to the file system directly from the Angular CLI! 🚀**


## Usage

Add `ngx-deploy-starter` to your project.

```bash
ng add ngx-deploy-starter
```

Deploy your project to the file system.

```
ng deploy [options]
```


## Options

The following options are also available.

#### --target-dir
 * __optional__
 * Default: `~/example-folder` (string)
 * Example:
    * `ng deploy` -- App is "deployed" to the example folder (if existing)
    * `ng deploy --target-/var/www/html` -- App is "deployed" to another folder


#### --configuration
 * __optional__
 * Default: `production` (string)
 * Example:
    * `ng deploy` -- Angular project is build in production mode
    * `ng deploy --configuration=qs` -- Angular project is using the configuration `qs` (this configuration must exist in the `angular.json` file)

A named build target, as specified in the `configurations` section of `angular.json`.
Each named target is accompanied by a configuration of option defaults for that target.
Same as `ng build --configuration=XXX`.

