// Type definitions for commander-fork (based on commander v3.0.2)
// Stripped to minimal API for angular-cli-ghpages
// Original: https://github.com/DefinitelyTyped/DefinitelyTyped

///<reference types="node" />

declare namespace local {

  class Option {
    flags: string;
    required: boolean;
    optional: boolean;
    negate: boolean;
    short?: string;
    long: string;
    description: string;

    constructor(flags: string, description?: string);
  }

  class Command extends NodeJS.EventEmitter {
    [key: string]: any;

    args: string[];

    constructor(name?: string);

    /**
     * Set the program version to `str`.
     *
     * This method auto-registers the "-V, --version" flag
     * which will print the version number when passed.
     *
     * You can optionally supply the  flags and description to override the defaults.
     */
    version(str: string, flags?: string, description?: string): Command;

    /**
     * Define option with `flags`, `description` and optional
     * coercion `fn`.
     *
     * The `flags` string should contain both the short and long flags,
     * separated by comma, a pipe or space.
     *
     * Examples:
     *     // simple boolean defaulting to false
     *     program.option('-p, --pepper', 'add pepper');
     *
     *     // simple boolean defaulting to true
     *     program.option('-C, --no-cheese', 'remove cheese');
     *
     *     // required argument
     *     program.option('-C, --chdir <path>', 'change the working directory');
     *
     *     // optional argument
     *     program.option('-c, --cheese [type]', 'add cheese [marble]');
     */
    option(flags: string, description?: string, fn?: ((arg1: any, arg2: any) => void) | RegExp, defaultValue?: any): Command;
    option(flags: string, description?: string, defaultValue?: any): Command;

    /**
     * Allow unknown options on the command line.
     */
    allowUnknownOption(arg?: boolean): Command;

    /**
     * Parse `argv`, settings options and invoking commands when defined.
     */
    parse(argv: string[]): Command;

    /**
     * Parse options from `argv` returning `argv` void of these options.
     */
    parseOptions(argv: string[]): commander.ParseOptionsResult;

    /**
     * Return an object containing options as key-value pairs
     */
    opts(): { [key: string]: any };

    /**
     * Set the description to `str`.
     */
    description(str: string, argsDescription?: {[argName: string]: string}): Command;
    description(): string;

    /**
     * Set or get the command usage.
     */
    usage(str: string): Command;
    usage(): string;

    /**
     * Set the name of the command.
     */
    name(str: string): Command;

    /**
     * Get the name of the command.
     */
    name(): string;

    /**
     * Return help information for this command as a string.
     */
    helpInformation(): string;

    /**
     * Output help information for this command.
     *
     * When listener(s) are available for the helpLongFlag
     * those callbacks are invoked.
     */
    outputHelp(cb?: (str: string) => string): void;

    /**
     * You can pass in flags and a description to override the help
     * flags and help description for your command.
     */
    helpOption(flags?: string, description?: string): Command;

    /**
     * Output help information and exit.
     */
    help(cb?: (str: string) => string): never;
  }

}

declare namespace commander {

    type Command = local.Command

    type Option = local.Option

    interface ParseOptionsResult {
        args: string[];
        unknown: string[];
    }

    interface CommanderStatic extends Command {
        Command: typeof local.Command;
        Option: typeof local.Option;
        ParseOptionsResult: ParseOptionsResult;
    }

}

declare const commander: commander.CommanderStatic;
export = commander;
