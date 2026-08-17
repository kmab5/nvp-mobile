/**
 * Shareable results.
 *
 * The ledger pips are already an emoji grid waiting to happen: green for a digit
 * in the right slot, amber for right digit wrong slot, hollow for absent. That
 * reproduces the board exactly without giving away a single digit, so it's safe
 * to post while a match is still going.
 */

import { CODE_LENGTH } from '../core/engine.js';

const POSITION = '🟩';
const VALUE = '🟨';
const EMPTY = '⬜';

/** One guess as a row of pips — no digits, so nothing is spoiled. */
export function pipRow({ value, position }) {
  return POSITION.repeat(position)
    + VALUE.repeat(Math.max(0, value - position))
    + EMPTY.repeat(Math.max(0, CODE_LENGTH - value));
}

export function pipGrid(guesses) {
  return guesses.map(pipRow).join('\n');
}

/**
 * @param {object} options
 * @param {'cpu'|'local'|'online'} options.mode
 * @param {object} options.result   the controller's result object
 * @param {Array}  options.guesses  the sharer's own attempts
 * @param {string} [options.opponent]
 * @param {string} [options.link]
 */
export function resultShareText({ mode, result, guesses, opponent, link }) {
  const rounds = guesses.length;
  const cracked = guesses.some((g) => g.position === CODE_LENGTH);

  let headline;
  if (result?.kind === 'draw') {
    headline = `NVP — dead heat in ${rounds}`;
  } else if (cracked) {
    headline = `NVP — cracked it in ${rounds}`;
  } else {
    headline = `NVP — ${opponent || 'the code'} beat me in ${rounds}`;
  }

  const context = {
    cpu: opponent ? ` vs ${opponent}` : '',
    online: opponent ? ` vs ${opponent}` : '',
    local: '',
  }[mode] || '';

  return [
    headline + context,
    '',
    pipGrid(guesses),
    '',
    link || '',
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n').trim();
}
