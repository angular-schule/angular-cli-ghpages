/**
 * Module dependencies.
 */
const commander = require('../');
// var program = require('../')
//   , should = require('should');

describe('options.regex', () => {
it('should validate with regex', () => {
let program = new commander.Command();
program
  .version('0.0.1')
  .option('-s, --size <size>', 'Pizza Size', /^(large|medium|small)$/i, 'medium')
  .option('-d, --drink [drink]', 'Drink', /^(Coke|Pepsi|Izze)$/i)

program.parse('node test -s big -d coke'.split(' '));
expect(program.size).toBe('medium');
expect(program.drink).toBe('coke');
});
});
