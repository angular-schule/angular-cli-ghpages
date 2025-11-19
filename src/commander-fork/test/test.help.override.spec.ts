/**
 * Test for help listener after helpOption() override
 * Tests the bug fix for help event emission with custom flags
 */

const commander = require('../');

describe('help listener after helpOption override', () => {
  let oldExit: any;
  let oldWrite: any;
  let exitCode: null | number;

  beforeEach(() => {
    exitCode = null;
    oldExit = process.exit;
    oldWrite = process.stdout.write;
    process.exit = ((c: any) => {
      exitCode = c as number;
      throw new Error(`exit(${c})`); // Stop execution like real exit
    }) as any;
    process.stdout.write = (() => true) as any;
  });

  afterEach(() => {
    process.exit = oldExit;
    process.stdout.write = oldWrite;
  });

  it('fires help listener with default flags', () => {
    const program = new commander.Command();
    const spy = jest.fn();
    program.on('--help', spy);
    expect(() => program.parse(['node', 'x', '--help'])).toThrow('exit(0)');
    expect(spy).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('fires help listener after helpOption override', () => {
    const program = new commander.Command().helpOption('-?, --helpme');
    const spy = jest.fn();
    program.on('--helpme', spy);
    expect(() => program.parse(['node', 'x', '--helpme'])).toThrow('exit(0)');
    expect(spy).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('fires stable help event regardless of custom flags', () => {
    const program = new commander.Command().helpOption('-?, --helpme');
    const spy = jest.fn();
    program.on('help', spy); // stable event name
    expect(() => program.parse(['node', 'x', '--helpme'])).toThrow('exit(0)');
    expect(spy).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('fires both dynamic and stable help events', () => {
    const program = new commander.Command().helpOption('-?, --assist');
    const dynamicSpy = jest.fn();
    const stableSpy = jest.fn();
    program.on('--assist', dynamicSpy);
    program.on('help', stableSpy);
    expect(() => program.parse(['node', 'x', '--assist'])).toThrow('exit(0)');
    expect(dynamicSpy).toHaveBeenCalled();
    expect(stableSpy).toHaveBeenCalled();
  });
});
