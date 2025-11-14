const commander = require('../');
// var program = require('../')
//   , should = require('should');

describe('options.version', () => {
var capturedExitCode, capturedOutput, oldProcessExit, oldProcessStdoutWrite;

// program.version('0.0.1');

['-V', '--version'].forEach(function (flag) {
  it(`should output version with ${flag}`, () => {
  const program = new commander.Command();
  program.version('0.0.1');
  capturedExitCode = -1;
  capturedOutput = '';
  oldProcessExit = process.exit;
  oldProcessStdoutWrite = process.stdout.write;
  process.exit = function (code) { capturedExitCode = code; } as any;
  process.stdout.write = function(output) { capturedOutput += output; return true; } as any;
  program.parse(['node', 'test', flag]);
  process.exit = oldProcessExit;
  process.stdout.write = oldProcessStdoutWrite;
  expect(capturedOutput).toBe('0.0.1\n');
  expect(capturedExitCode).toBe(0);
  });
})
});
