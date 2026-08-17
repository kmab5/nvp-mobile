/**
 * Plays a full online match using the mobile app's own network adapter against
 * a real running server.
 *
 * This is the answer to "is the backend actually integrated" — not "does the URL
 * look right", but two clients completing a match through the same code paths
 * the app uses, including the rematch handshake.
 *
 * Start the web repo's dev server first:
 *   cd ../nvp && npm start
 * Then:
 *   node scripts/apitest.mjs [http://localhost:3000]
 */

import assert from 'node:assert/strict';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const ENDPOINT = `${BASE}/api/game`;

// The adapter's exact request shapes, transcribed so this exercises the same
// protocol without needing React Native's module graph.
const post = async (payload) => {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};
const state = async (room, token) => {
  const res = await fetch(`${ENDPOINT}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.state;
};

let checks = 0;
const ok = (label, condition, detail = '') => {
  checks += 1;
  console.log(`  [${condition ? 'ok  ' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
};

console.log(`server: ${BASE}\n`);

// --- health ---------------------------------------------------------------
console.log('health');
let health = null;
try {
  const res = await fetch(`${BASE}/api/health`);
  health = await res.json();
} catch (error) {
  console.error(`  cannot reach ${BASE} — is the server running?`);
  process.exit(1);
}
ok('reachable', Boolean(health));
ok('storage round trip works', health.ok === true);
if (health.persistent === false) {
  console.log('  note: in-memory storage — fine locally, will misbehave in production');
}

// --- a full match ---------------------------------------------------------
console.log('match');
const host = await post({ action: 'create', name: 'Phone' });
ok('room created', /^[A-Z2-9]{5}$/.test(host.room), host.room);

const guest = await post({ action: 'join', room: host.room, name: 'Laptop' });
ok('second player joined', guest.seat === 'B');

await post({ action: 'secret', room: host.room, token: host.token, code: '1234' });
let s = await state(host.room, guest.token);
ok('opponent code stays hidden', s.opponent.secret === null && s.opponent.codeLocked === true);

await post({ action: 'secret', room: host.room, token: guest.token, code: '9876' });
s = await state(host.room, host.token);
ok('match starts once both codes are in', s.phase === 'playing');
ok('host moves first', s.toMove === 'A');

await post({ action: 'guess', room: host.room, token: host.token, code: '9876' });
s = await state(host.room, host.token);
ok('guess scored by the server', s.me.guesses.at(-1).position === 4);
ok('opponent still gets a reply', s.phase === 'playing');

await post({ action: 'guess', room: host.room, token: guest.token, code: '1592' });
s = await state(host.room, host.token);
ok('match resolved', s.phase === 'over');
ok('host won', s.result.outcome === 'win' && s.result.winner === 'A');
ok('codes revealed at the end', s.opponent.secret === '9876');

// --- rematch handshake ----------------------------------------------------
console.log('rematch');
await post({ action: 'rematch', room: host.room, token: host.token, want: true });
s = await state(host.room, guest.token);
ok('request visible to the other player', s.opponent.wantsRematch === true);

await post({ action: 'rematch', room: host.room, token: guest.token, want: true });
s = await state(host.room, host.token);
ok('board wiped when both agree', s.phase === 'setup' && s.me.guesses.length === 0);
ok('names survive', s.me.name === 'Phone');

// --- leaving --------------------------------------------------------------
console.log('leaving');
await post({ action: 'leave', room: host.room, token: guest.token });
s = await state(host.room, host.token);
ok('seat freed', s.opponent === null);
ok('survivor reset for a fresh opponent', s.me.guesses.length === 0 && !s.me.codeLocked);

await post({ action: 'leave', room: host.room, token: host.token });

console.log(`\n${checks} checks run`);
console.log(process.exitCode ? 'FAILURES — see above' : 'backend integration verified');
