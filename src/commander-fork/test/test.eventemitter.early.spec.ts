/**
 * Test for EventEmitter early listener registration
 * Tests the bug fix for EventEmitter.call(this) in constructor
 */

const commander = require('../');

describe('EventEmitter early listener registration', () => {
  it('allows listener registration before any options', () => {
    const program = new commander.Command();
    const spy = jest.fn();

    // Register listener BEFORE defining options
    program.on('option:foo', spy);

    // Now define option and parse
    program.option('-f, --foo <value>');
    program.parse(['node', 'x', '-f', 'bar']);

    expect(spy).toHaveBeenCalledWith('bar');
    expect(program.foo).toBe('bar');
  });

  it('allows multiple early listeners', () => {
    const program = new commander.Command();
    const spy1 = jest.fn();
    const spy2 = jest.fn();

    program.on('option:alpha', spy1);
    program.on('option:bravo', spy2);

    program.option('-a, --alpha <val>');
    program.option('-b, --bravo <val>');
    program.parse(['node', 'x', '-a', 'A', '-b', 'B']);

    expect(spy1).toHaveBeenCalledWith('A');
    expect(spy2).toHaveBeenCalledWith('B');
  });

  it('works with version listener', () => {
    const program = new commander.Command();
    const spy = jest.fn();

    // Listen for version BEFORE defining it
    program.on('option:version', spy);

    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as any);

    program.version('1.0.0');
    program.parse(['node', 'x', '-V']);

    expect(spy).toHaveBeenCalled();

    (process.exit as any).mockRestore();
    (process.stdout.write as any).mockRestore();
  });

  it('inherits from EventEmitter properly', () => {
    const program = new commander.Command();
    expect(program).toBeInstanceOf(require('events').EventEmitter);
    expect(typeof program.on).toBe('function');
    expect(typeof program.emit).toBe('function');
    expect(typeof program.removeListener).toBe('function');
  });
});
