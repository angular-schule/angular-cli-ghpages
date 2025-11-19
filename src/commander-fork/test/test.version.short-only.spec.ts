/**
 * Test for version flag with short-only custom flag
 * Tests the bug fix for version event name with short-only flags
 */

const commander = require('../');

describe('version flag short-only', () => {
  let oldExit: any;
  let oldWrite: any;
  let captured: { code: null | number; out: string };

  beforeEach(() => {
    captured = { code: null, out: '' };
    oldExit = process.exit;
    oldWrite = process.stdout.write;
    process.exit = ((code: any) => {
      captured.code = code as number;
    }) as any;
    process.stdout.write = ((chunk: any) => {
      captured.out += chunk;
      return true;
    }) as any;
  });

  afterEach(() => {
    process.exit = oldExit;
    process.stdout.write = oldWrite;
  });

  it('prints version and exits with -v short-only flag', () => {
    const program = new commander.Command();
    program.version('1.2.3', '-v');
    program.parse(['node', 'x', '-v']);
    expect(captured.out).toBe('1.2.3\n');
    expect(captured.code).toBe(0);
  });

  it('prints version with long-only flag', () => {
    const program = new commander.Command();
    program.version('2.0.0', '--ver');
    program.parse(['node', 'x', '--ver']);
    expect(captured.out).toBe('2.0.0\n');
    expect(captured.code).toBe(0);
  });

  it('prints version with both short and long flags', () => {
    const program = new commander.Command();
    program.version('3.1.4', '-v, --ver');

    // Test short flag
    captured = { code: null, out: '' };
    program.parse(['node', 'x', '-v']);
    expect(captured.out).toBe('3.1.4\n');
    expect(captured.code).toBe(0);
  });
});
