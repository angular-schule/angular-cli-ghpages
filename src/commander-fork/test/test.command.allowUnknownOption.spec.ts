/**
 * Module dependencies.
 */
const commander = require('../');
// var program = require('../')
//     , sinon = require('sinon').sandbox.create()
//     , should = require('should');

describe('command.allowUnknownOption', () => {
let stubError: jest.SpyInstance;
let stubExit: jest.SpyInstance;

function resetStubStatus() {
  stubError.mockClear();
  stubExit.mockClear();
}

beforeEach(() => {
  stubError = jest.spyOn(console, 'error').mockImplementation(() => {});
  stubExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
});
afterEach(() => {
  stubError.mockRestore();
  stubExit.mockRestore();
});

it('should error on unknown option', () => {
let program = new commander.Command();
program
  .version('0.0.1')
  .option('-p, --pepper', 'add pepper');
program.parse('node test -m'.split(' '));

expect(stubError).toHaveBeenCalledTimes(1);
});

// // test subcommand
// resetStubStatus();
// program
//   .command('sub')
//   .action(function () {
//   });
// program.parse('node test sub -m'.split(' '));
//
// stubError.callCount.should.equal(1);
// stubExit.calledOnce.should.be.true();

it('should not error with allowUnknownOption', () => {
// command with `allowUnknownOption`
resetStubStatus();
let program = new commander.Command();
program
  .version('0.0.1')
  .option('-p, --pepper', 'add pepper');
program
  .allowUnknownOption()
  .parse('node test -m'.split(' '));

expect(stubError).toHaveBeenCalledTimes(0);
expect(stubExit).not.toHaveBeenCalled();
});

// // subcommand with `allowUnknownOption`
// resetStubStatus();
// program
//   .command('sub2')
//   .allowUnknownOption()
//   .action(function () {
//   });
// program.parse('node test sub2 -m'.split(' '));
//
// stubError.callCount.should.equal(0);
// stubExit.calledOnce.should.be.false();

});
