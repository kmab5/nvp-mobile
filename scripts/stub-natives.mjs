/**
 * Module resolution hook: swaps the native-dependent adapters for in-memory
 * stubs so core/ can run under plain Node.
 *
 * Only the adapters are stubbed. Everything in core/ loads for real — stubbing
 * any of that would make the test meaningless.
 */

const PREFS_STUB = `
let state = { sound: true, haptics: true, record: { cpu: {}, local: { games: 0 },
  online: { won: 0, lost: 0, drawn: 0 } }, session: null };
export function get(path, fallback) {
  const v = path.split('.').reduce((n, k) => (n == null ? undefined : n[k]), state);
  return v ?? fallback;
}
export function set(path, value) {
  const keys = path.split('.'); const last = keys.pop();
  let node = state;
  for (const k of keys) { if (typeof node[k] !== 'object' || node[k] === null) node[k] = {}; node = node[k]; }
  node[last] = value;
}
export function recordResult() {}
export function summary() { return { played: 0, wins: 0, best: null }; }
export const session = { read: () => null, save() {}, clear() {} };
`;

const SFX_STUB = `
export const fired = [];
export function play(name) { fired.push(name); }
export function prepare() {}
export function enabled() { return false; }
export function toggle() { return false; }
export function hapticsEnabled() { return false; }
export function toggleHaptics() { return false; }
export function release() {}
`;

const NET_STUB = `
export class NetError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export const API_BASE = 'http://localhost:3000';
export const api = new Proxy({}, {
  get: () => async () => { throw new NetError('offline in tests', 0); },
});
export function createPoller() { return { stop() {}, poke() {} }; }
export function shareLink(room) { return 'http://localhost:3000/?room=' + room; }
`;

const STUBS = [
  [/adapters\/prefs\.js$/, PREFS_STUB],
  [/adapters\/sfx\.js$/, SFX_STUB],
  [/adapters\/net\.js$/, NET_STUB],
];

export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context);
  return resolved;
}

export async function load(url, context, next) {
  for (const [pattern, source] of STUBS) {
    if (pattern.test(url)) {
      return { format: 'module', shortCircuit: true, source };
    }
  }
  return next(url, context);
}
