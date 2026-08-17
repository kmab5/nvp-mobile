/**
 * Headless test for the ported core.
 *
 * The screens need a device, but the game logic does not — the engine, the CPU
 * and all three match controllers are pure. This runs them under plain Node with
 * the native modules stubbed, which catches the failure that actually matters
 * after a port: the shared logic behaving differently on mobile than on the web.
 *
 *   node --experimental-vm-modules scripts/coretest.mjs
 *
 * Adapters are stubbed via a Node module resolution hook so the real files (and
 * their `expo-*` imports) are never loaded. What IS loaded, unmodified, is
 * everything in core/.
 */

import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Stub the native-dependent adapters before anything imports them.
register(
  './stub-natives.mjs',
  { parentURL: pathToFileURL(`${import.meta.dirname}/`) },
);

const { evaluate, validateCode, randomCode, allCodes, resolveMatch } = await import('../core/engine.js');
const { createCpu, LEVELS, LEVEL_ORDER } = await import('../core/cpu.js');
const { createLocalMatch } = await import('../core/match/local.js');
const { createCpuMatch } = await import('../core/match/cpu.js');

let checks = 0;
const ok = (label, condition, detail = '') => {
  checks += 1;
  if (!condition) {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
  }
};

// --- the engine must be bit-identical to the web build ---------------------
console.log('engine');
assert.deepEqual(evaluate('1234', '1234'), { value: 4, position: 4 });
assert.deepEqual(evaluate('4719', '1732'), { value: 2, position: 1 });
assert.equal(validateCode('1234'), null);
assert.ok(validateCode('1123'));
assert.ok(validateCode('1023'));
assert.equal(allCodes().length, 3024);
ok('scoring matches the web build', true);

for (let i = 0; i < 300; i += 1) {
  const a = randomCode();
  const b = randomCode();
  assert.deepEqual(evaluate(a, b), evaluate(b, a));
}
ok('scoring stays symmetric', true);

// --- the second player always gets a reply ---------------------------------
const crack = { guess: '1234', value: 4, position: 4 };
const miss = { guess: '5678', value: 0, position: 0 };
assert.equal(resolveMatch([crack], []), null);
assert.deepEqual(resolveMatch([crack], [crack]), { outcome: 'draw', winner: null, rounds: 1 });
assert.deepEqual(resolveMatch([crack], [miss]), { outcome: 'win', winner: 'A', rounds: 1 });
ok('draw rule survives the port', true);

// --- CPU still solves at the documented pace -------------------------------
console.log('cpu');
for (const level of LEVEL_ORDER) {
  const rounds = [];
  for (let game = 0; game < 60; game += 1) {
    const cpu = createCpu(level);
    const secret = randomCode();
    const history = [];
    let solved = 0;
    for (let round = 1; round <= 40; round += 1) {
      const guess = cpu.nextGuess(history);
      const score = evaluate(secret, guess);
      history.push({ guess, ...score });
      if (score.position === 4) { solved = round; break; }
    }
    assert.ok(solved > 0, `${level} failed to solve a code`);
    rounds.push(solved);
  }
  const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
  const expected = { rookie: [6.5, 9.5], racer: [4.8, 6.8], ace: [4.4, 5.8] }[level];
  ok(
    `${LEVELS[level].name} solves at the documented pace`,
    avg >= expected[0] && avg <= expected[1],
    `avg ${avg.toFixed(2)}, expected ${expected[0]}–${expected[1]}`,
  );
}

// --- hot-seat controller ---------------------------------------------------
console.log('match controllers');
const local = createLocalMatch({ names: { A: 'Sami', B: 'Nardos' }, gate: true });
ok('hot-seat starts in setup', local.view().phase === 'setup');
ok('first player is asked first', local.view().secretPrompt.name === 'Sami');
local.setSecret('1234');
ok('gate raised after the first code', Boolean(local.view().handoff));
ok('gate names the incoming player', local.view().handoff.name === 'Nardos');
local.acknowledgeHandoff();
local.setSecret('5678');
ok('play begins once both codes are in', local.view().phase === 'playing');

local.acknowledgeHandoff();
const guessResult = local.guess('5678');
ok('a guess is scored', guessResult.ok && guessResult.score.position === 4);
ok('opponent still gets their reply', local.view().phase === 'playing');
local.acknowledgeHandoff();
local.guess('9999'.slice(0, 0) + '1235');
ok('match resolves after both play', local.view().phase === 'over');
ok('the cracker wins', local.view().result.title.includes('Sami'));
ok('both codes are revealed', local.view().result.reveals.length === 2);

// invalid input is refused, not crashed on
ok('rejects a repeated digit', createLocalMatch({ names: {}, gate: false }).setSecret('1123').ok === false);

// --- CPU controller, including the async reply -----------------------------
const cpuMatch = createCpuMatch({ playerName: 'You', difficulty: 'ace' });
ok('cpu match starts in setup', cpuMatch.view().phase === 'setup');
cpuMatch.setSecret('1234');
ok('cpu match begins', cpuMatch.view().phase === 'playing');
ok('player moves first', cpuMatch.view().yourTurn === true);
cpuMatch.guess('5678');
ok('cpu takes its turn', cpuMatch.view().busy === true);

await new Promise((resolve) => setTimeout(resolve, 1800));
ok('cpu replied', cpuMatch.view().them.guesses.length === 1);
ok('turn handed back', cpuMatch.view().yourTurn === true);
cpuMatch.quit();

// --- daily must match the web build exactly ------------------------------
console.log('daily');
const daily = await import('../core/daily.js');
const { createDailyMatch } = await import('../core/match/daily.js');

// Hard-coded from the web repo's own test run. If the two ever diverge — a
// changed seed, a different hash, an accidental edit to the shuffle — this
// fails, because a daily that differs by platform is worse than no daily.
ok('puzzle numbering matches web', daily.puzzleNumber(new Date(2026, 0, 1)) === 1);
ok(
  'seeded code matches web',
  daily.dailyCode(new Date(2026, 5, 15)) === '7648',
  daily.dailyCode(new Date(2026, 5, 15)),
);
ok('code is stable within a day',
  daily.dailyCode(new Date(2026, 5, 15, 2)) === daily.dailyCode(new Date(2026, 5, 15, 22)));
ok('a new day brings a new code',
  daily.dailyCode(new Date(2026, 5, 15)) !== daily.dailyCode(new Date(2026, 5, 16)));

const noRepeat = new Set();
for (let i = 0; i < 500; i += 1) {
  noRepeat.add(daily.dailyCode(new Date(2026, 0, 1 + i)));
}
ok('no repeats across 500 days', noRepeat.size === 500);

ok('pip row hides digits', daily.pipRow({ value: 2, position: 1 }) === '🟩🟨⬜⬜');

const dailyMatch = createDailyMatch({ now: () => new Date(2026, 5, 15) });
ok('daily starts playable', dailyMatch.view().phase === 'playing');
ok('eight attempts', dailyMatch.view().remaining === daily.MAX_ATTEMPTS);
dailyMatch.guess('1234');
ok('guess recorded', dailyMatch.view().guesses.length === 1);
ok('secret stays hidden while playing', dailyMatch.view().secret === null);
ok('repeat guess refused', dailyMatch.guess('1234').ok === false);
dailyMatch.guess('7648');
ok('solving ends the day', dailyMatch.view().phase === 'over');
ok('secret revealed at the end', dailyMatch.view().secret === '7648');
ok('share text produced', /NVP Daily #\d+ — 2\/8/.test(dailyMatch.view().shareText));
ok('share text leaks no digits', !/[1-9]/.test(dailyMatch.view().shareText.split('\n').slice(2, -1).join('')));

// --- the intro must teach the real scoring -------------------------------
// Every number shown during onboarding is checked against the engine. A wrong
// example here would teach the game backwards to every new player, and it is
// exactly the kind of hand-written constant that rots silently.
console.log('intro');
const INTRO_SECRET = '4719';
const INTRO_EXAMPLES = [
  ['1732', 2, 1],
  ['4712', 3, 3],
  ['4719', 4, 4],
];
for (const [guess, value, position] of INTRO_EXAMPLES) {
  const score = evaluate(INTRO_SECRET, guess);
  ok(
    `intro example ${guess} scores V${value} P${position}`,
    score.value === value && score.position === position,
    `actual V${score.value} P${score.position}`,
  );
}

console.log(`\n${checks} checks run`);
console.log(process.exitCode ? 'FAILURES — see above' : 'ported core behaves identically to the web build');
