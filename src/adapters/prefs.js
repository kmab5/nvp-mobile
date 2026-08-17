/**
 * Preferences — the same synchronous API the web version exposes.
 *
 * The match controllers call `prefs.get()` and `prefs.set()` inline, mid-render,
 * expecting an answer immediately. AsyncStorage would have forced that whole
 * call chain to become async, which would have meant editing the shared core —
 * exactly what the port is trying to avoid.
 *
 * expo-sqlite/kv-store solves it: a drop-in AsyncStorage replacement that also
 * offers real synchronous getters and setters. So the shape below is identical
 * to src/prefs.js on web, with SQLite where localStorage was.
 */

import { optional } from './native.js';

/**
 * expo-sqlite is a native module, so it can be absent in Expo Go or in a dev
 * build made before it was added. Falling back to a plain Map keeps the whole
 * app running — preferences simply don't survive a restart — instead of failing
 * to boot over a settings store.
 */
const memory = new Map();
const Storage = optional('expo-sqlite/kv-store', () => require('expo-sqlite/kv-store').default, {
  getItemSync: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); return Promise.resolve(); },
});

const KEY = 'nvp:v2';

const DEFAULTS = {
  sound: true,
  haptics: true,
  handoffGate: true,
  names: { p1: '', p2: '', online: '' },
  lastDifficulty: 'racer',
  record: { cpu: {}, local: { games: 0 }, online: { won: 0, lost: 0, drawn: 0 } },
  session: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return clone(DEFAULTS);
    return { ...clone(DEFAULTS), ...JSON.parse(raw) };
  } catch {
    return clone(DEFAULTS);
  }
}

let state = load();

function persist() {
  try {
    // Fire-and-forget: the in-memory copy is already authoritative for this
    // session, so a slow write must never block a turn.
    Storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the session still works, it just won't be remembered */
  }
}

export function get(path, fallback) {
  const found = path
    .split('.')
    .reduce((node, key) => (node == null ? undefined : node[key]), state);
  return found ?? fallback;
}

export function set(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = state;
  for (const key of keys) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
  }
  node[last] = value;
  persist();
}

export function recordResult({ mode, difficulty, outcome, rounds }) {
  if (mode === 'cpu') {
    const book = state.record.cpu[difficulty] || { won: 0, lost: 0, drawn: 0, best: null };
    book[outcome] = (book[outcome] || 0) + 1;
    if (outcome === 'won' && (book.best === null || rounds < book.best)) book.best = rounds;
    state.record.cpu[difficulty] = book;
  } else if (mode === 'online') {
    state.record.online[outcome] = (state.record.online[outcome] || 0) + 1;
  } else {
    state.record.local.games = (state.record.local.games || 0) + 1;
  }
  persist();
}

export function summary() {
  const cpu = Object.values(state.record.cpu);
  const wins = cpu.reduce((n, b) => n + (b.won || 0), 0) + (state.record.online.won || 0);
  const played = cpu.reduce((n, b) => n + (b.won || 0) + (b.lost || 0) + (b.drawn || 0), 0)
    + Object.values(state.record.online).reduce((n, v) => n + (v || 0), 0)
    + (state.record.local.games || 0);
  const bests = cpu.map((b) => b.best).filter((n) => typeof n === 'number');
  return { played, wins, best: bests.length ? Math.min(...bests) : null };
}

export const session = {
  read() {
    const s = state.session;
    if (!s || !s.room || !s.token) return null;
    if (Date.now() - (s.at || 0) > 6 * 60 * 60 * 1000) return null;
    return s;
  },
  save(data) {
    set('session', { ...data, at: Date.now() });
  },
  clear() {
    set('session', null);
  },
};

/** Test seam: lets the headless suite run without the native module. */
export function __resetForTests() {
  state = clone(DEFAULTS);
}
