/**
 * Where the server lives.
 *
 * Resolution order, first hit wins:
 *
 *   1. an override saved in-app (Settings on the online screen) — lets you point
 *      a shipped build at a different server without rebuilding
 *   2. extra.apiUrl in app.json — the normal production answer
 *   3. in development only, the machine running Metro
 *
 * Rule 3 exists because `localhost` means the phone itself, not your laptop. On
 * the Android emulator the host machine is 10.0.2.2; on a physical device it's
 * your LAN address. Expo already knows the latter — Metro told the app where to
 * fetch the bundle from — so we reuse that host and swap the port.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as prefs from './adapters/prefs.js';

const DEV_PORT = 3000;

function metroHost() {
  // e.g. "192.168.1.14:8081" — the address the bundle was served from.
  const raw = Constants.expoConfig?.hostUri
    || Constants.expoGoConfig?.debuggerHost
    || '';
  const host = String(raw).split(':')[0];
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1') {
    // Running against a simulator/emulator: rewrite to the host-machine alias.
    return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  }
  return host;
}

export function configuredUrl() {
  return Constants.expoConfig?.extra?.apiUrl || '';
}

export function devFallbackUrl() {
  const host = metroHost();
  return host ? `http://${host}:${DEV_PORT}` : '';
}

/** The base URL every request should use right now. */
export function apiBase() {
  const override = prefs.get('apiUrlOverride', '');
  if (override) return String(override).replace(/\/+$/, '');

  const configured = configuredUrl();
  if (configured) return String(configured).replace(/\/+$/, '');

  if (__DEV__) return devFallbackUrl();
  return '';
}

export function setApiOverride(url) {
  prefs.set('apiUrlOverride', String(url || '').trim().replace(/\/+$/, ''));
}

/** Explains what's wrong when there's no usable server, for the UI to show. */
export function apiProblem() {
  if (apiBase()) return null;
  return __DEV__
    ? 'No server configured, and Metro\'s host could not be detected. Set one in Server settings.'
    : 'No server configured. Set extra.apiUrl in app.json and rebuild.';
}
