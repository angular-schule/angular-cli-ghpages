'use strict';

// `require.main.require` so that plugin even works when linked with `npm link`
// see https://github.com/npm/npm/issues/5875 / http://stackoverflow.com/a/25800501
//
// hint:
// this asumes a flat node_modules structure with ember-cli and angular-cli on top
// and does not work in NPM 2 until ember-cli is directly in package.json
var Command = require.main.require('ember-cli/lib/models/command');
var Promise = require.main.require('ember-cli/lib/ext/promise');
var WebpackBuild = require.main.require('angular-cli/tasks/build-webpack');

var path = require('path');
var fs = require('fs');
var ghpages = require('gh-pages');

module.exports =  Command.extend({
  name: 'ghpages',
  aliases: ['gh-pages'],
  description: 'Publish to any gh-pages branch on GitHub (or any other branch on any other remote). Build the project before publishing!',
  works: 'insideProject',

  availableOptions: [{
    name:         'repo',
    type:         String,
    default:      undefined, // using gh-pages default -- see readme
    description:  'The commit message to include with the build, must be wrapped in quotes.'
  }, {
    name:         'message',
    type:         String,
    default:      'Auto-generated commit',
    description:  'The commit message, must be wrapped in quotes.'
  }, {
    name:         'branch',
    type:         String,
    default:      'gh-pages',
    description:  'The git branch to push your pages to'
  }, {
    name:         'name',
    type:         String,
    default:      undefined,  // using gh-pages default -- see readme
    description:  'The git user-name which is associated with this commit'
  }, {
    name:         'email',
    type:         String,
    default:      undefined,  // using gh-pages default -- see readme
    description:  'The git user-email which is associated with this commit'
  }, {
    name:         'silent',
    type:         Boolean,
    default:      true,
    description:  'Suppress console logging. This option should be used if the repository URL or other information passed to git commands is sensitive!'
  }, {
    name:         'dir',
    type:         String,
    default:      'dist',
    description:  'Directory for all published sources, relative to the project-root. Most probably no change is required here.'
  }, {
    name:        'dotfiles',
    type:         Boolean,
    default:      true,
    description:  'Includes dotfiles by default. When set to `false` files starting with `.` are ignored.'
  }],
  run: function(options, rawArgs) {

    var ui = this.ui;
    var root = this.project.root;
    var dir = path.join(root, options.dir);
    
    options = options || {};
    if (options['name'] && options['email']) {
      options.user = {
        name: options['name'],
        email: options['email']
      }
    };

    // gh-pages: forwards  messages to ui
    options.logger = function(message) { ui.write(message + "\n"); }
        
    if (process.env.TRAVIS) {
      options.message += '\n\n' +
        'Triggered by commit: https://github.com/' + process.env.TRAVIS_REPO_SLUG + '/commit/' + process.env.TRAVIS_COMMIT + '\n' +
        'Travis build: https://travis-ci.org/'     + process.env.TRAVIS_REPO_SLUG + '/builds/' + process.env.TRAVIS_BUILD_ID;
    }
    
    // for your convenience - here you can hack credentials into the repository URL
    if (process.env.GH_TOKEN && options.repo) {
      options.repo = options.repo.replace('GH_TOKEN', process.env.GH_TOKEN); 
    }       

    // always clean the cache directory.
    // avoids "Error: Remote url mismatch."
    ghpages.clean();

    var access = publish = Promise.denodeify(fs.access);
    var publish = Promise.denodeify(ghpages.publish);

    function go() {
      return Promise.resolve();  
    }    

    return go()
      .then(function() {
        return access(dir, fs.F_OK)
      })        
      .catch(function(error) {
        ui.writeError('Dist folder does not exist. Check the dir --dir parameter or build the project first!\n');
        return Promise.reject(error) ;
      })
      .then(function() {
        return publish(dir, options)
      })
      .then(function() {
        ui.write('Successfully published!\n');
      })
      .catch(function(error) {
         ui.writeError('An error occurred!\n');
         return Promise.reject(error) ;
      });
  }
});
