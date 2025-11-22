const commander = require('../');
// var program = require('../')
//   , should = require('should');

describe('options.version', () => {
let capturedExitCode: number;
let capturedOutput: string;
let exitSpy: jest.SpyInstance;
let writeSpy: jest.SpyInstance;

// program.version('0.0.1');

['-V', '--version'].forEach(function (flag) {
  it(`should output version with ${flag}`, () => {
  const program = new commander.Command();
  program.version('0.0.1');
  capturedExitCode = -1;
  capturedOutput = '';

  exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    capturedExitCode = code ?? 0;
    return undefined as never;
  });
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((output: string | Uint8Array) => {
    capturedOutput += output;
    return true;
  });

  program.parse(['node', 'test', flag]);

  exitSpy.mockRestore();
  writeSpy.mockRestore();

  expect(capturedOutput).toBe('0.0.1\n');
  expect(capturedExitCode).toBe(0);
  });
})
});

export {};
