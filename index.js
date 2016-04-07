module.exports = {
  name: 'angular-cli-ghpages',

  includedCommands: function() {
    return {
      'gh-pages': require('./lib/commands/deploy'),
      'ghpages': require('./lib/commands/deploy'),
    };
  }
};
