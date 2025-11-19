/**
 * Test for unknown options with attached values
 * Tests --foo=bar, --foo=, --foo -5 scenarios
 */

const commander = require('../');

describe('unknown options with attached values', () => {
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    errSpy.mockRestore();
    (process.exit as any).mockRestore();
  });

  describe('errors by default', () => {
    test.each([
      ['--mystery=42'],
      ['--mystery='],
      ['--mystery', '-5'],
    ])('errors on %p', (...args) => {
      const p = new commander.Command().option('-k, --known <v>');
      p.parse(['node', 'x', ...args]);
      expect(errSpy).toHaveBeenCalled();
    });
  });

  describe('allowed with allowUnknownOption', () => {
    test.each([
      ['--mystery=42'],
      ['--mystery='],
      ['--mystery', '-5'],
    ])('allowed with %p', (...args) => {
      errSpy.mockClear();
      const p = new commander.Command().allowUnknownOption();
      p.parse(['node', 'x', ...args]);
      expect(errSpy).not.toHaveBeenCalled();
    });
  });

  it('handles mixed known and unknown options', () => {
    errSpy.mockClear();
    const p = new commander.Command()
      .option('-k, --known <val>')
      .allowUnknownOption();
    p.parse(['node', 'x', '-k', 'knownValue', '--unknown=foo']);
    expect(errSpy).not.toHaveBeenCalled();
    expect(p.known).toBe('knownValue');
  });

  it('handles equals with spaces in value', () => {
    errSpy.mockClear();
    const p = new commander.Command().allowUnknownOption();
    p.parse(['node', 'x', '--mystery=some value']);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
