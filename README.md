# NVP for Android

The native Android build of [NVP](../nvp), on Expo SDK 57 (React Native 0.86,
React 19.2.3, New Architecture).

All three modes work: pass-and-play, online rooms against the same server the web
build uses, and the CPU at three difficulties. The CPU runs entirely on-device,
so it needs no connection.

## Before you can run it

```bash
npm install
npx expo install --fix     # authoritative: pins every package to SDK 57's version
npm run doctor             # expo-doctor, catches config problems
npx expo run:android       # device or emulator, needs Android Studio
```

`npx expo install --fix` matters more than usual here: the versions in
`package.json` were written by hand and `expo install` is the only thing that
knows the exact set SDK 57 expects. Run it before your first build.

Point the app at your deployment in `app.json`:

```json
"extra": { "apiUrl": "https://your-app.vercel.app" }
```

Online play talks to the same `/api/game` endpoint as the website, so the two
share rooms — you can play the Android app against someone on the web.

### Shipping to Play

```bash
npm i -g eas-cli && eas login
eas build --platform android --profile production
eas submit --platform android
```

Google Play needs a one-off $25 developer account. Unlike Apple, it has no
objection to how the UI is built.

## How the port works

The engine, the CPU and all three match controllers are **the same files as the
web build**, copied unchanged apart from their import paths:

```
core/engine.js        rules, scoring, turn order, match resolution
core/cpu.js           the three difficulty levels
core/match/*.js       hot-seat, CPU and online controllers
```

That is possible because none of them ever touched the DOM. They reach the
outside world through three services, and porting means reimplementing only
those:

| Service | Web | Android |
|---|---|---|
| `prefs` | `localStorage` | `expo-sqlite/kv-store` (synchronous) |
| `sfx` | WebAudio oscillators | bundled WAVs via `expo-audio` + `expo-haptics` |
| `net` | relative `fetch` | absolute `fetch`, polling driven by `AppState` |

`expo-sqlite/kv-store` was chosen over AsyncStorage specifically because it has
real synchronous getters. The match controllers call `prefs.get()` inline and
expect an answer immediately; AsyncStorage would have forced that whole call
chain async, which would have meant editing the shared core — the one thing the
port is trying to avoid.

The sound cues are the same waveforms as the site. WebAudio doesn't exist here,
so `scripts/gen-sounds.py` renders the same oscillator definitions to WAV ahead
of time. Re-run it if you change a cue.

### Keeping the two in step

```bash
npm run sync          # copy core/ from the web repo
npm test              # fails if they have drifted
```

`scripts/sync-core.mjs` copies the six core files and rewrites their import
specifiers. The `--check` mode is part of `npm test`, so a change made on one
side and not the other fails the build rather than silently shipping an app that
scores guesses differently from the website.

### Why no navigation library

A match is a long-lived controller object that has to survive every screen
change within a game, and a game doesn't really have a navigation stack — there
is one surface, and the mode decides what it shows. `App.js` is a state machine
mirroring the web router, which also keeps the two ports comparable. The two
things a router would have given for free are handled explicitly: the Android
back button (with a confirmation before abandoning a live match, since leaving
an online room forfeits the seat) and deep links.

Invite links work both ways: `nvp://room/ABC12` and
`https://<your-host>/?room=ABC12` both open the join screen with the code filled
in. The `https` form needs Digital Asset Links set up on the domain to open the
app directly rather than the browser.

## Testing

```bash
npm test
```

Three suites, none of which need a device:

- **`scripts/coretest.mjs`** runs the ported core under plain Node with the
  native modules stubbed — the engine, CPU strength across 180 games, and all
  three match controllers including the handoff gate and the CPU's async reply.
  This is the one that matters: it proves the shared logic behaves identically
  after the port.
- **`scripts/statictest.mjs`** parses every source file and resolves every
  relative import and package reference, catching the errors that would
  otherwise only appear on first launch.
- **`sync-core.mjs --check`** fails if `core/` has drifted from the web repo.

### What is *not* verified

No emulator or Metro bundler was available while this was written, so **nothing
here has been rendered on a device.** The logic is tested and the module graph is
checked, but layout, native module behaviour and the actual look of the screens
are unverified. Expect to spend a session on visual adjustment, and treat the
first `npx expo run:android` as the real test.

The most likely things to need attention:

- Keypad and tile sizing on small or very large screens — the numbers are fixed
  (54×66 tiles, 78×52 keys) rather than responsive.
- `expo-audio` player behaviour on rapid repeated cues; if taps sound clipped,
  the `seekTo(0)` in `src/adapters/sfx.js` is where to look.
- Edge-to-edge insets on Android 15+, which RN 0.86 changed.

## Layout

```
App.js                 shell: state machine, back button, deep links, fonts
core/                  synced from the web repo — do not edit here
src/adapters/          the entire porting layer: prefs, sfx, net
src/components/        CodePad, Ledger, Notes, shared primitives
src/screens/           menu, rules, setup, lobby, play
scripts/               sync, sound generation, tests
assets/sounds/         generated WAV cues
```

---

A game by Sami.
