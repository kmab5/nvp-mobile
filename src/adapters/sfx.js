/**
 * Feedback — sound and haptics behind the same `play(name)` call the web build
 * exposes, so the shared match controllers need no changes.
 *
 * Two platform differences from web:
 *
 *  - No WebAudio. The oscillator cues are pre-rendered to WAV by
 *    scripts/gen-sounds.py and bundled, so they sound the same as the site.
 *  - Real haptics. Android gets expo-haptics rather than the blunt Vibration
 *    API, so the cues can have distinct textures instead of just durations.
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as prefs from './prefs.js';

// require() rather than import: Metro needs static asset references to bundle.
const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  back: require('../../assets/sounds/back.wav'),
  submit: require('../../assets/sounds/submit.wav'),
  reject: require('../../assets/sounds/reject.wav'),
  turn: require('../../assets/sounds/turn.wav'),
  crack: require('../../assets/sounds/crack.wav'),
  lose: require('../../assets/sounds/lose.wav'),
};

const HAPTICS = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  back: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  submit: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  reject: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  turn: () => Haptics.selectionAsync(),
  crack: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  lose: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

const players = new Map();
let ready = false;

/**
 * Called once at startup. Players are created eagerly because building one on
 * first use adds audible latency to the very first keypress — the one that
 * makes the whole app feel slow.
 */
export async function prepare() {
  if (ready) return;
  ready = true;
  try {
    // Play through the silent switch and don't interrupt background music:
    // this is a puzzle game, people will have a podcast on.
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    /* audio mode is advisory; carry on */
  }
  for (const [name, source] of Object.entries(SOURCES)) {
    try {
      const player = createAudioPlayer(source);
      player.volume = 0.6;
      players.set(name, player);
    } catch {
      /* a missing cue is not worth failing startup over */
    }
  }
}

export function enabled() {
  return prefs.get('sound', true) !== false;
}

export function toggle() {
  const next = !enabled();
  prefs.set('sound', next);
  if (next) play('tap');
  return next;
}

export function hapticsEnabled() {
  return prefs.get('haptics', true) !== false;
}

export function toggleHaptics() {
  const next = !hapticsEnabled();
  prefs.set('haptics', next);
  if (next) HAPTICS.tap?.();
  return next;
}

/**
 * The single feedback entry point. Sound and haptics are toggled independently:
 * someone playing muted still wants to feel a cracked code, and someone who
 * finds vibration distracting still wants the audio.
 */
export function play(name) {
  if (hapticsEnabled()) {
    try {
      HAPTICS[name]?.();
    } catch {
      /* no haptic motor, or permission denied */
    }
  }

  if (!enabled()) return;
  const player = players.get(name);
  if (!player) return;
  try {
    // Rewind first: cues fire faster than they finish, and without this a
    // rapid sequence of taps would only sound once.
    player.seekTo(0);
    player.play();
  } catch {
    /* audio is a nicety, never a failure mode */
  }
}

export function release() {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {
      /* already gone */
    }
  }
  players.clear();
  ready = false;
}
