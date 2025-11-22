const commander = require('../');
// require('should');

describe('options.bool.no', () => {
// Test combination of flag and --no-flag
// (negatable flag on its own is tested in test.options.bool.js)

function flagProgram(defaultValue?: boolean) {
  const program = new commander.Command();
  program
    .option('-p, --pepper', 'add pepper', defaultValue)
    .option('-P, --no-pepper', 'remove pepper');
  return program;
}

it('Flag with no default, normal usage - no options', () => {

const programNoDefaultNoOptions = flagProgram();
programNoDefaultNoOptions.parse(['node', 'test']);
expect(programNoDefaultNoOptions).not.toHaveProperty('pepper');
});
it('Flag with no default, normal usage - with flag', () => {
const programNoDefaultWithFlag = flagProgram();
programNoDefaultWithFlag.parse(['node', 'test', '--pepper']);
expect(programNoDefaultWithFlag.pepper).toBe(true);
});
it('Flag with no default, normal usage - with neg flag', () => {
const programNoDefaultWithNegFlag = flagProgram();
programNoDefaultWithNegFlag.parse(['node', 'test', '--no-pepper']);
expect(programNoDefaultWithNegFlag.pepper).toBe(false);
});
it('Flag with default true - no options', () => {
// Flag with default, say from an environment variable.

const programTrueDefaultNoOptions = flagProgram(true);
programTrueDefaultNoOptions.parse(['node', 'test']);
expect(programTrueDefaultNoOptions.pepper).toBe(true);
});
it('Flag with default true - with flag', () => {
const programTrueDefaultWithFlag = flagProgram(true);
programTrueDefaultWithFlag.parse(['node', 'test', '-p']);
expect(programTrueDefaultWithFlag.pepper).toBe(true);
});
it('Flag with default true - with neg flag', () => {
const programTrueDefaultWithNegFlag = flagProgram(true);
programTrueDefaultWithNegFlag.parse(['node', 'test', '-P']);
expect(programTrueDefaultWithNegFlag.pepper).toBe(false);
});
it('Flag with default false - no options', () => {
const programFalseDefaultNoOptions = flagProgram(false);
programFalseDefaultNoOptions.parse(['node', 'test']);
expect(programFalseDefaultNoOptions.pepper).toBe(false);
});
it('Flag with default false - with flag', () => {
const programFalseDefaultWithFlag = flagProgram(false);
programFalseDefaultWithFlag.parse(['node', 'test', '-p']);
expect(programFalseDefaultWithFlag.pepper).toBe(true);
});
it('Flag with default false - with neg flag', () => {
const programFalseDefaultWithNegFlag = flagProgram(false);
programFalseDefaultWithNegFlag.parse(['node', 'test', '-P']);
expect(programFalseDefaultWithNegFlag.pepper).toBe(false);
});
it('Flag specified both ways, last one wins - no then yes', () => {
// Flag specified both ways, last one wins.

const programNoYes = flagProgram();
programNoYes.parse(['node', 'test', '--no-pepper', '--pepper']);
expect(programNoYes.pepper).toBe(true);
});
it('Flag specified both ways, last one wins - yes then no', () => {
const programYesNo = flagProgram();
programYesNo.parse(['node', 'test', '--pepper', '--no-pepper']);
expect(programYesNo.pepper).toBe(false);
});
});

export {};
