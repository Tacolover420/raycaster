import {runInContext} from 'lodash';

/* Create a copy of lodash to which we can add our mixins. */
let _ = runInContext();

/* Return a random odd Integer in the interval [a, b], where a and b are odd
 * Integers.
 */
function randOdd(a, b) {
  return a + 2 * Math.floor(Math.random() * ((b - a) / 2 + 1));
}

function matrix(rows, cols, val) {
  let m = [];
  for (let r = 0; r < rows; ++r) {
    m.push(_.fill(Array(cols), val));
  }
  return m;
}

_.mixin({
  randOdd: randOdd,
  matrix: matrix
});

export default _;

