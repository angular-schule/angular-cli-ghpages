/**
 * Test for opts() with custom version flag
 * Tests that version value appears correctly in opts() object
 */

const commander = require('../');

describe('opts() with custom version flag', () => {
  let oldExit: any;
  let oldWrite: any;

  beforeEach(() => {
    oldExit = process.exit;
    oldWrite = process.stdout.write;
    process.exit = (() => {}) as any;
    process.stdout.write = (() => true) as any;
  });

  afterEach(() => {
    process.exit = oldExit;
    process.stdout.write = oldWrite;
  });

  it('includes version in opts() with default flags', () => {
    const program = new commander.Command();
    program.version('1.2.3');
    program.parse(['node', 'x']);

    const opts = program.opts();
    expect(opts.version).toBe('1.2.3');
  });

  it('includes version in opts() with custom long flag', () => {
    const program = new commander.Command();
    program.version('2.0.0', '-V, --ver');
    program.parse(['node', 'x']);

    const opts = program.opts();
    expect(opts.ver).toBe('2.0.0');
  });

  it('includes version in opts() with short-only flag', () => {
    const program = new commander.Command();
    program.version('3.1.4', '-v');
    program.parse(['node', 'x']);

    const opts = program.opts();
    expect(opts.v).toBe('3.1.4');
  });

  it('includes version in opts() with long-only flag', () => {
    const program = new commander.Command();
    program.version('1.0.0', '--version-info');
    program.parse(['node', 'x']);

    const opts = program.opts();
    expect(opts.versionInfo).toBe('1.0.0');
  });

  it('includes version alongside other options', () => {
    const program = new commander.Command();
    program
      .version('1.2.3')
      .option('-d, --dir <dir>', 'directory', 'dist')
      .option('-v, --verbose', 'verbose');
    program.parse(['node', 'x', '--verbose']);

    const opts = program.opts();
    expect(opts.version).toBe('1.2.3');
    expect(opts.dir).toBe('dist');
    expect(opts.verbose).toBe(true);
  });
});
