/**
 * Tests for angular-cli-ghpages fork-specific fixes and features
 * 
 * This file contains tests for the 2 intentional improvements we made
 * to commander v3.0.2 for angular-cli-ghpages:
 * 
 * FIX 1/2: Tightened negate detection regex
 * FIX 2/2: Support for short-only and custom version flags
 * 
 * These tests do NOT exist in the original commander v3.0.2.
 */

const commander = require('../');

describe('Fork Fix 1: Negate detection with tightened regex', () => {
  // This is implicitly tested by test.options.bool.no.spec.ts
  // No additional tests needed here
});

describe('Fork Fix 2: Version short-only and custom flags', () => {
  describe('version() with short-only flag', () => {
    let exitSpy: jest.SpyInstance;
    let writeSpy: jest.SpyInstance;
    let captured: {out: string, code: null | number};

    beforeEach(() => {
      captured = {out: '', code: null};
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((c?: number) => {
        captured.code = c ?? 0;
        return undefined as never;
      });
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
        captured.out += s;
        return true;
      });
    });

    afterEach(() => {
      exitSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it('prints version and exits with -v short-only flag', () => {
      const program = new commander.Command();
      program.version('1.2.3', '-v');
      program.parse(['node', 'x', '-v']);
      expect(captured.out).toBe('1.2.3\n');
      expect(captured.code).toBe(0);
    });

    it('prints version with long-only custom flag', () => {
      captured = {out: '', code: null};
      const program = new commander.Command();
      program.version('2.0.0', '--ver');
      program.parse(['node', 'x', '--ver']);
      expect(captured.out).toBe('2.0.0\n');
      expect(captured.code).toBe(0);
    });

    it('prints version with combined custom flags', () => {
      captured = {out: '', code: null};
      const program = new commander.Command();
      program.version('3.0.0', '-v, --ver');
      program.parse(['node', 'x', '--ver']);
      expect(captured.out).toBe('3.0.0\n');
      expect(captured.code).toBe(0);
    });
  });

  describe('helpOption() with custom flags', () => {
    let exitSpy: jest.SpyInstance;
    let writeSpy: jest.SpyInstance;
    let exitCode: null | number;

    beforeEach(() => {
      exitCode = null;
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((c?: number) => {
        exitCode = c ?? 0;
        throw new Error(`exit(${c})`);
      });
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      writeSpy.mockRestore();
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
  });

  describe('opts() includes version with custom flags', () => {
    let exitSpy: jest.SpyInstance;
    let writeSpy: jest.SpyInstance;

    beforeEach(() => {
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        return undefined as never;
      });
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      writeSpy.mockRestore();
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
      // Note: Short-only flags like '-v' become capital 'V' in opts due to camelCase conversion
      expect(opts.V).toBe('3.1.4');
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

  describe('unknown options with attached values', () => {
    let errSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
      errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        return undefined as never;
      });
    });

    afterEach(() => {
      errSpy.mockRestore();
      exitSpy.mockRestore();
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
});

export {};
