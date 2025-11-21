/**
 * commander-fork
 *
 * Minimal fork of commander v3.0.2 for angular-cli-ghpages
 *
 * Original: https://github.com/tj/commander.js (MIT License)
 * Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 *
 * This fork strips out features we don't use:
 * - Subcommands (.command() with action handlers)
 * - Git-style executable subcommands
 * - Action handlers (.action())
 * - Argument definitions (.arguments())
 * - Most EventEmitter functionality
 *
 * Features kept:
 * - .version() - version flag registration
 * - .description() - command description
 * - .option() - option parsing with --no- prefix support
 * - .parse() - argv parsing
 * - .opts() - get parsed options
 * - Property access (e.g., program.dir)
 * - Basic --help output
 */

/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter;
var path = require('path');
var basename = path.basename;

/**
 * Inherit `Command` from `EventEmitter.prototype`.
 */

require('util').inherits(Command, EventEmitter);

/**
 * Expose the root command.
 */

exports = module.exports = new Command();

/**
 * Expose `Command`.
 */

exports.Command = Command;

/**
 * Expose `Option`.
 */

exports.Option = Option;

/**
 * Initialize a new `Option` with the given `flags` and `description`.
 *
 * @param {String} flags
 * @param {String} description
 * @api public
 */

function Option(flags, description) {
  this.flags = flags;
  this.required = flags.indexOf('<') >= 0;
  this.optional = flags.indexOf('[') >= 0;
  // FORK FIX 1/2: Tightened negate detection to avoid false positives
  // Original: this.negate = flags.indexOf('-no-') !== -1;
  // Problem: Would match '-no-' anywhere, e.g., '--enable-notifications' would incorrectly match
  // Fix: Only match '--no-' at word boundaries (start of string or after delimiter)
  this.negate = /(^|[\s,|])--no-/.test(flags);
  flags = flags.split(/[ ,|]+/);
  if (flags.length > 1 && !/^[[<]/.test(flags[1])) this.short = flags.shift();
  this.long = flags.shift();
  this.description = description || '';
}

/**
 * Return option name.
 *
 * @return {String}
 * @api private
 */

Option.prototype.name = function() {
  return this.long.replace(/^--/, '');
};

/**
 * Return option name, in a camelcase format that can be used
 * as a object attribute key.
 *
 * @return {String}
 * @api private
 */

Option.prototype.attributeName = function() {
  return camelcase(this.name().replace(/^no-/, ''));
};

/**
 * Check if `arg` matches the short or long flag.
 *
 * @param {String} arg
 * @return {Boolean}
 * @api private
 */

Option.prototype.is = function(arg) {
  return this.short === arg || this.long === arg;
};

/**
 * Initialize a new `Command`.
 *
 * @param {String} name
 * @api public
 */

function Command(name) {
  this.options = [];
  this._allowUnknownOption = false;
  this._name = name || '';

  this._helpFlags = '-h, --help';
  this._helpDescription = 'output usage information';
  this._helpShortFlag = '-h';
  this._helpLongFlag = '--help';
}

/**
 * Define option with `flags`, `description` and optional
 * coercion `fn`.
 *
 * The `flags` string should contain both the short and long flags,
 * separated by comma, a pipe or space. The following are all valid
 * all will output this way when `--help` is used.
 *
 *    "-p, --pepper"
 *    "-p|--pepper"
 *    "-p --pepper"
 *
 * Examples:
 *
 *     // simple boolean defaulting to undefined
 *     program.option('-p, --pepper', 'add pepper');
 *
 *     program.pepper
 *     // => undefined
 *
 *     --pepper
 *     program.pepper
 *     // => true
 *
 *     // simple boolean defaulting to true (unless non-negated option is also defined)
 *     program.option('-C, --no-cheese', 'remove cheese');
 *
 *     program.cheese
 *     // => true
 *
 *     --no-cheese
 *     program.cheese
 *     // => false
 *
 *     // required argument
 *     program.option('-C, --chdir <path>', 'change the working directory');
 *
 *     --chdir /tmp
 *     program.chdir
 *     // => "/tmp"
 *
 *     // optional argument
 *     program.option('-c, --cheese [type]', 'add cheese [marble]');
 *
 * @param {String} flags
 * @param {String} description
 * @param {Function|*} [fn] or default
 * @param {*} [defaultValue]
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.option = function(flags, description, fn, defaultValue) {
  var self = this,
    option = new Option(flags, description),
    oname = option.name(),
    name = option.attributeName();

  // default as 3rd arg
  if (typeof fn !== 'function') {
    if (fn instanceof RegExp) {
      // This is a bit simplistic (especially no error messages), and probably better handled by caller using custom option processing.
      // No longer documented in README, but still present for backwards compatibility.
      var regex = fn;
      fn = function(val, def) {
        var m = regex.exec(val);
        return m ? m[0] : def;
      };
    } else {
      defaultValue = fn;
      fn = null;
    }
  }

  // preassign default value for --no-*, [optional], <required>, or plain flag if boolean value
  if (option.negate || option.optional || option.required || typeof defaultValue === 'boolean') {
    // when --no-foo we make sure default is true, unless a --foo option is already defined
    if (option.negate) {
      var opts = self.opts();
      defaultValue = Object.prototype.hasOwnProperty.call(opts, name) ? opts[name] : true;
    }
    // preassign only if we have a default
    if (defaultValue !== undefined) {
      self[name] = defaultValue;
      option.defaultValue = defaultValue;
    }
  }

  // register the option
  this.options.push(option);

  // when it's passed assign the value
  // and conditionally invoke the callback
  this.on('option:' + oname, function(val) {
    // coercion
    if (val !== null && fn) {
      val = fn(val, self[name] === undefined ? defaultValue : self[name]);
    }

    // unassigned or boolean value
    if (typeof self[name] === 'boolean' || typeof self[name] === 'undefined') {
      // if no value, negate false, and we have a default, then use it!
      if (val == null) {
        self[name] = option.negate
          ? false
          : defaultValue || true;
      } else {
        self[name] = val;
      }
    } else if (val !== null) {
      // reassign
      self[name] = option.negate ? false : val;
    }
  });

  return this;
};

/**
 * Allow unknown options on the command line.
 *
 * @param {Boolean} arg if `true` or omitted, no error will be thrown
 * for unknown options.
 * @api public
 */
Command.prototype.allowUnknownOption = function(arg) {
  this._allowUnknownOption = arguments.length === 0 || arg;
  return this;
};

/**
 * Parse `argv`, settings options and invoking commands when defined.
 *
 * @param {Array} argv
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.parse = function(argv) {
  // store raw args
  this.rawArgs = argv;

  // guess name
  this._name = this._name || basename(argv[1], '.js');

  // process argv
  var normalized = this.normalize(argv.slice(2));
  var parsed = this.parseOptions(normalized);
  this.args = parsed.args;

  // check for help
  outputHelpIfNecessary(this, parsed.unknown);

  // unknown options
  if (parsed.unknown.length > 0) {
    this.unknownOption(parsed.unknown[0]);
  }

  return this;
};

/**
 * Normalize `args`, splitting joined short flags. For example
 * the arg "-abc" is equivalent to "-a -b -c".
 * This also normalizes equal sign and splits "--abc=def" into "--abc def".
 *
 * @param {Array} args
 * @return {Array}
 * @api private
 */

Command.prototype.normalize = function(args) {
  var ret = [],
    arg,
    lastOpt,
    index,
    short,
    opt;

  for (var i = 0, len = args.length; i < len; ++i) {
    arg = args[i];
    if (i > 0) {
      lastOpt = this.optionFor(args[i - 1]);
    }

    if (arg === '--') {
      // Honor option terminator
      ret = ret.concat(args.slice(i));
      break;
    } else if (lastOpt && lastOpt.required) {
      ret.push(arg);
    } else if (arg.length > 2 && arg[0] === '-' && arg[1] !== '-') {
      short = arg.slice(0, 2);
      opt = this.optionFor(short);
      if (opt && (opt.required || opt.optional)) {
        ret.push(short);
        ret.push(arg.slice(2));
      } else {
        arg.slice(1).split('').forEach(function(c) {
          ret.push('-' + c);
        });
      }
    } else if (/^--/.test(arg) && ~(index = arg.indexOf('='))) {
      ret.push(arg.slice(0, index), arg.slice(index + 1));
    } else {
      ret.push(arg);
    }
  }

  return ret;
};

/**
 * Return an option matching `arg` if any.
 *
 * @param {String} arg
 * @return {Option}
 * @api private
 */

Command.prototype.optionFor = function(arg) {
  for (var i = 0, len = this.options.length; i < len; ++i) {
    if (this.options[i].is(arg)) {
      return this.options[i];
    }
  }
};

/**
 * Parse options from `argv` returning `argv`
 * void of these options.
 *
 * @param {Array} argv
 * @return {Array}
 * @api public
 */

Command.prototype.parseOptions = function(argv) {
  var args = [],
    len = argv.length,
    literal,
    option,
    arg;

  var unknownOptions = [];

  // parse options
  for (var i = 0; i < len; ++i) {
    arg = argv[i];

    // literal args after --
    if (literal) {
      args.push(arg);
      continue;
    }

    if (arg === '--') {
      literal = true;
      continue;
    }

    // find matching Option
    option = this.optionFor(arg);

    // option is defined
    if (option) {
      // requires arg
      if (option.required) {
        arg = argv[++i];
        if (arg == null) return this.optionMissingArgument(option);
        this.emit('option:' + option.name(), arg);
      // optional arg
      } else if (option.optional) {
        arg = argv[i + 1];
        if (arg == null || (arg[0] === '-' && arg !== '-')) {
          arg = null;
        } else {
          ++i;
        }
        this.emit('option:' + option.name(), arg);
      // flag
      } else {
        this.emit('option:' + option.name());
      }
      continue;
    }

    // looks like an option
    if (arg.length > 1 && arg[0] === '-') {
      unknownOptions.push(arg);

      // If the next argument looks like it might be
      // an argument for this option, we pass it on.
      // If it isn't, then it'll simply be ignored
      if ((i + 1) < argv.length && (argv[i + 1][0] !== '-' || argv[i + 1] === '-')) {
        unknownOptions.push(argv[++i]);
      }
      continue;
    }

    // arg
    args.push(arg);
  }

  return { args: args, unknown: unknownOptions };
};

/**
 * Return an object containing options as key-value pairs
 *
 * @return {Object}
 * @api public
 */
Command.prototype.opts = function() {
  var result = {},
    len = this.options.length;

  for (var i = 0; i < len; i++) {
    var key = this.options[i].attributeName();
    result[key] = key === this._versionOptionName ? this._version : this[key];
  }
  return result;
};

/**
 * `Option` is missing an argument, but received `flag` or nothing.
 *
 * @param {String} option
 * @param {String} flag
 * @api private
 */

Command.prototype.optionMissingArgument = function(option, flag) {
  if (flag) {
    console.error("error: option '%s' argument missing, got '%s'", option.flags, flag);
  } else {
    console.error("error: option '%s' argument missing", option.flags);
  }
  process.exit(1);
};

/**
 * Unknown option `flag`.
 *
 * @param {String} flag
 * @api private
 */

Command.prototype.unknownOption = function(flag) {
  if (this._allowUnknownOption) return;
  console.error("error: unknown option '%s'", flag);
  process.exit(1);
};

/**
 * Set the program version to `str`.
 *
 * This method auto-registers the "-V, --version" flag
 * which will print the version number when passed.
 *
 * You can optionally supply the  flags and description to override the defaults.
 *
 * @param {String} str
 * @param {String} [flags]
 * @param {String} [description]
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.version = function(str, flags, description) {
  if (arguments.length === 0) return this._version;
  this._version = str;
  flags = flags || '-V, --version';
  description = description || 'output the version number';
  var versionOption = new Option(flags, description);
  // FORK FIX 2/2: Support short-only and custom version flags properly
  // Original: this._versionOptionName = versionOption.long.substr(2) || 'version';
  // Problem: .substr(2) on '-v' gives empty string, falls back to 'version',
  //          but event is 'option:v' (or 'option:-v'), so listener never fires.
  //          Also doesn't handle camelCase for flags like '--version-info'.
  // Fix: Use attributeName() for proper camelCase conversion and short flag support.
  //      Examples: '-v' -> 'v', '--version' -> 'version', '--version-info' -> 'versionInfo'
  this._versionOptionName = versionOption.attributeName();
  this.options.push(versionOption);
  this.on('option:' + versionOption.name(), function() {
    process.stdout.write(str + '\n');
    process.exit(0);
  });
  return this;
};

/**
 * Set the description to `str`.
 *
 * @param {String} str
 * @param {Object} argsDescription
 * @return {String|Command}
 * @api public
 */

Command.prototype.description = function(str, argsDescription) {
  if (arguments.length === 0) return this._description;
  this._description = str;
  this._argsDescription = argsDescription;
  return this;
};

/**
 * Set / get the command usage `str`.
 *
 * @param {String} str
 * @return {String|Command}
 * @api public
 */

Command.prototype.usage = function(str) {
  var usage = '[options]';
  if (arguments.length === 0) return this._usage || usage;
  this._usage = str;
  return this;
};

/**
 * Get or set the name of the command
 *
 * @param {String} str
 * @return {String|Command}
 * @api public
 */

Command.prototype.name = function(str) {
  if (arguments.length === 0) return this._name;
  this._name = str;
  return this;
};

/**
 * Return the largest option length.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.largestOptionLength = function() {
  var options = [].slice.call(this.options);
  options.push({
    flags: this._helpFlags
  });

  return options.reduce(function(max, option) {
    return Math.max(max, option.flags.length);
  }, 0);
};

/**
 * Return the pad width.
 *
 * @return {Number}
 * @api private
 */

Command.prototype.padWidth = function() {
  return this.largestOptionLength();
};

/**
 * Return help for options.
 *
 * @return {String}
 * @api private
 */

Command.prototype.optionHelp = function() {
  var width = this.padWidth();

  // Append the help information
  return this.options.map(function(option) {
    return pad(option.flags, width) + '  ' + option.description +
      ((!option.negate && option.defaultValue !== undefined) ? ' (default: ' + JSON.stringify(option.defaultValue) + ')' : '');
  }).concat([pad(this._helpFlags, width) + '  ' + this._helpDescription])
    .join('\n');
};

/**
 * Return program help documentation.
 *
 * @return {String}
 * @api private
 */

Command.prototype.helpInformation = function() {
  var desc = [];
  if (this._description) {
    desc = [
      this._description,
      ''
    ];
  }

  var cmdName = this._name;
  var usage = [
    'Usage: ' + cmdName + ' ' + this.usage(),
    ''
  ];

  var options = [
    'Options:',
    '' + this.optionHelp().replace(/^/gm, '  '),
    ''
  ];

  return usage
    .concat(desc)
    .concat(options)
    .join('\n');
};

/**
 * Output help information for this command.
 *
 * When listener(s) are available for the helpLongFlag
 * those callbacks are invoked.
 *
 * @api public
 */

Command.prototype.outputHelp = function(cb) {
  if (!cb) {
    cb = function(passthru) {
      return passthru;
    };
  }
  const cbOutput = cb(this.helpInformation());
  if (typeof cbOutput !== 'string' && !Buffer.isBuffer(cbOutput)) {
    throw new Error('outputHelp callback must return a string or a Buffer');
  }
  process.stdout.write(cbOutput);
  this.emit(this._helpLongFlag);
};

/**
 * You can pass in flags and a description to override the help
 * flags and help description for your command.
 *
 * @param {String} [flags]
 * @param {String} [description]
 * @return {Command}
 * @api public
 */

Command.prototype.helpOption = function(flags, description) {
  this._helpFlags = flags || this._helpFlags;
  this._helpDescription = description || this._helpDescription;

  var splitFlags = this._helpFlags.split(/[ ,|]+/);

  if (splitFlags.length > 1) this._helpShortFlag = splitFlags.shift();

  this._helpLongFlag = splitFlags.shift();

  return this;
};

/**
 * Output help information and exit.
 *
 * @param {Function} [cb]
 * @api public
 */

Command.prototype.help = function(cb) {
  this.outputHelp(cb);
  process.exit();
};

/**
 * Camel-case the given `flag`
 *
 * @param {String} flag
 * @return {String}
 * @api private
 */

function camelcase(flag) {
  return flag.split('-').reduce(function(str, word) {
    return str + word[0].toUpperCase() + word.slice(1);
  });
}

/**
 * Pad `str` to `width`.
 *
 * @param {String} str
 * @param {Number} width
 * @return {String}
 * @api private
 */

function pad(str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 1).join(' ');
}

/**
 * Output help information if necessary
 *
 * @param {Command} command to output help for
 * @param {Array} array of options to search for -h or --help
 * @api private
 */

function outputHelpIfNecessary(cmd, options) {
  options = options || [];

  for (var i = 0; i < options.length; i++) {
    if (options[i] === cmd._helpLongFlag || options[i] === cmd._helpShortFlag) {
      cmd.outputHelp();
      process.exit(0);
    }
  }
}
