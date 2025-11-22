/**
 * Module dependencies.
 */
const commander = require('../');
// var program = require('../')
//   , should = require('should');

describe('options.coercion', () => {
function parseRange(str: string): number[] {
  return str.split('..').map(Number);
}

function increaseVerbosity(v: string, total: number): number {
  return total + 1;
}

function collectValues(str: string, memo: string[]): string[] {
  memo.push(str);
  return memo;
}

it('should coerce values correctly', () => {
let program = new commander.Command();
program
  .version('0.0.1')
  .option('-i, --int <n>', 'pass an int', parseInt)
  .option('-n, --num <n>', 'pass a number', Number)
  .option('-f, --float <n>', 'pass a float', parseFloat)
  .option('-r, --range <a..b>', 'pass a range', parseRange)
  .option('-v, --verbose', 'increase verbosity', increaseVerbosity, 0)
  .option('-c, --collect <str>', 'add a string (can be used multiple times)', collectValues, []);

program.parse('node test -i 5.5 -f 5.5 -n 15.99 -r 1..5 -c foo -c bar -c baz -vvvv --verbose'.split(' '));
expect(program.int).toBe(5);
expect(program.num).toBe(15.99);
expect(program.float).toBe(5.5);
expect(program.range).toEqual([1, 5]);
expect(program.collect).toEqual(['foo', 'bar', 'baz']);
expect(program.verbose).toBe(5);
});
});

export {};
