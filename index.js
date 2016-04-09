module.exports = {
  name: 'angular-cli-ghpages',

  includedCommands: function() {
    return {
      'ghpages': require('./deploy'),
    };
  }
};
