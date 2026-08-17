/**
 * Online play client.
 *
 * Same protocol as the web build. Two changes the platform forces:
 *
 *  - Requests need an absolute URL. There is no origin to be relative to, so
 *    the host comes from app config (see app.json > extra.apiUrl).
 *  - Polling follows app state rather than tab visibility. `document.hidden`
 *    doesn't exist here; React Native reports foreground/background instead,
 *    and a backgrounded app must stop polling entirely or it will drain battery
 *    and burn through the request budget for a game nobody is looking at.
 */

import { AppState } from 'react-native';
import { apiBase, apiProblem } from '../config.js';

// Resolved per call rather than captured once: the server can be repointed at
// runtime from Server settings, and a value frozen at import time would ignore
// that until the app restarted.
const endpoint = () => `${apiBase()}/api/game`;

/** Requests give up rather than hanging a turn indefinitely on a dead network. */
const TIMEOUT_MS = 12000;

export class NetError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(url, options = {}) {
  const problem = apiProblem();
  if (problem) throw new NetError(problem, 0);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw new NetError(
      error.name === 'AbortError'
        ? 'The server took too long to answer.'
        : 'No connection. Check your network and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new NetError(body.error || `Request failed (${res.status}).`, res.status);
  return body;
}

const post = (payload) => request(endpoint(), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const api = {
  createRoom: (name) => post({ action: 'create', name }),
  joinRoom: (room, name) => post({ action: 'join', room, name }),
  setSecret: (room, token, code) => post({ action: 'secret', room, token, code }),
  guess: (room, token, code) => post({ action: 'guess', room, token, code }),
  rematch: (room, token, want = true) => post({ action: 'rematch', room, token, want }),
  leave: (room, token) => post({ action: 'leave', room, token }),
  state: (room, token) => request(
    `${endpoint()}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`,
  ),

  /**
   * Reachability plus storage driver, used by the lobby to tell "the server is
   * down" apart from "the server is up but online rooms won't hold". Returns
   * null rather than throwing: a failed health check must never block play.
   */
  health: () => request(`${apiBase()}/api/health`).catch(() => null),
};

/**
 * Polls the room, faster while the opponent holds the move and slower when it's
 * your turn. Stops dead when the app is backgrounded and catches up the moment
 * it returns to the foreground.
 */
export function createPoller({ room, token, onState, onError, interval = () => 1600 }) {
  let timer = null;
  let stopped = false;
  let failures = 0;
  let inFlight = false;
  let foreground = AppState.currentState !== 'background';

  async function tick() {
    if (stopped || inFlight) return;
    if (!foreground) return;
    inFlight = true;
    try {
      const { state } = await api.state(room, token);
      failures = 0;
      onState(state);
    } catch (error) {
      failures += 1;
      if (onError) onError(error, failures);
      if (error.status === 403 || error.status === 404) return stop();
    } finally {
      inFlight = false;
    }
    return schedule();
  }

  function schedule() {
    if (stopped || !foreground) return;
    clearTimeout(timer);
    const base = interval();
    const backoff = failures ? Math.min(8000, base * 2 ** Math.min(failures, 3)) : base;
    timer = setTimeout(tick, backoff);
  }

  const subscription = AppState.addEventListener('change', (next) => {
    const active = next === 'active';
    if (active && !foreground) {
      foreground = true;
      clearTimeout(timer);
      tick();            // catch up immediately on return
    } else if (!active) {
      foreground = false;
      clearTimeout(timer);
    }
  });

  function stop() {
    stopped = true;
    clearTimeout(timer);
    subscription?.remove();
  }

  tick();
  return { stop, poke: () => { clearTimeout(timer); tick(); } };
}

export function shareLink(room) {
  return `${apiBase()}/?room=${room}`;
}

export { apiBase };
