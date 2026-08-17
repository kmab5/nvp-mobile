# NVP for Android

The native Android build of [NVP](../nvp), on Expo SDK 57 (React Native 0.86,
React 19.2.3, New Architecture).

All three modes work: pass-and-play, online rooms against the same server the web
build uses, and the CPU at three difficulties. The CPU runs entirely on-device,
so it needs no connection.

## If the app doesn't load

The first version had a startup bug: it held the splash screen until fonts
loaded and rendered nothing until then, so any font failure left it stuck
forever with nothing to debug. That's fixed — fonts are now best-effort, the
splash hides from a `finally`, and every native module is loaded through
`src/adapters/native.js` so a missing one degrades instead of killing the
bundle. Anything that still throws lands on a readable error screen listing
which modules failed.

If it still won't start, in order:

1. **Rebuild the dev client.** By far the most common cause: the JS references a
   native module the installed build doesn't contain. Adding any `expo-*`
   package requires a new build, not just a Metro restart.
   ```bash
   npx expo run:android
   ```
2. **Check Expo Go.** Expo Go only runs the SDK it was built for. If it's not an
   SDK 57 build, use a dev build instead — which you want anyway.
3. **Read the Metro output.** `npx expo start --clear` and watch the terminal as
   the app launches; a bundling error appears there and nowhere else.
4. **Check the menu for an amber warning.** If some modules failed but the app
   still ran, it says which ones.

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

## The backend

Online play talks to the same `/api/game` endpoint as the website, so the two
share rooms — the Android app can play against someone in a browser.

**What it needs, in full:**

1. **An address.** `extra.apiUrl` in `app.json`:
   ```json
   "extra": { "apiUrl": "https://nvp-kmab.vercel.app" }
   ```
2. **Redis on the server**, or online rooms will appear to vanish for the second
   player. The app now checks this for you (see below).
3. **Nothing else.** There's no CORS to configure — native `fetch` isn't subject
   to it — no auth, and no separate mobile backend.

**Development against a local server** is handled automatically. `localhost` on
a phone means the phone, not your laptop, so `src/config.js` reads the host
Metro served the bundle from and reuses it: `10.0.2.2` on the emulator, your LAN
address on a real device, port 3000. `usesCleartextTraffic` is enabled so
Android 9+ permits plain http to it.

**The lobby tells you the server's state** before you open a room, via
`/api/health`. The badge reads *Server ready*, *No storage* (up, but rooms won't
survive), or *Server unreachable* — and tapping it opens a field to repoint the
app at a different server at runtime, no rebuild needed. That override persists
and takes priority over `app.json`.

Verify the whole thing without a device:

```bash
cd ../nvp && npm start          # in another shell
npm run test:api                # plays a full match through the real API
```

That runs 17 checks: health, a complete two-player match, secret leakage, the
rematch handshake, and seat cleanup on leave.

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

## Android features

- **Native share of results** — the pip grid as emoji (🟩🟨⬜), reproducing the
  board without revealing a digit, so it's safe to post mid-match.
- **Clipboard** — tap the room code in the HUD to copy it, with a toast.
- **Back button** — confirms before abandoning a live match (leaving an online
  room forfeits the seat), and double-press to exit from the menu.
- **Deep links** — `nvp://room/ABC12` and `https://<host>/?room=ABC12` both open
  the join screen with the code filled in.
- **Haptics** — `expo-haptics` cues matched to the sounds, independently
  toggleable, so a muted player still feels a cracked code.
- **Keep awake** during a match, so the screen doesn't dim mid-deduction.
- **Themed icon** for Android 13+, and an adaptive icon.
- **Offline awareness** — online mode is greyed out with a reason when there's
  no connection; the CPU and pass-and-play work fully offline.

No notifications, by design. The app never asks for notification permission and
ships no notification code — the only thing that buzzes is haptic feedback on
your own taps.

## Testing

```bash
npm test          # no device needed
npm run test:api  # against a running server
```

Four suites, none of which need a device:

- **`scripts/coretest.mjs`** runs the ported core under plain Node with the
  native modules stubbed — the engine, CPU strength across 180 games, and all
  three match controllers including the handoff gate and the CPU's async reply.
  This is the one that matters: it proves the shared logic behaves identically
  after the port.
- **`scripts/statictest.mjs`** parses every source file and resolves every
  relative import and package reference, catching the errors that would
  otherwise only appear on first launch.
- **`sync-core.mjs --check`** fails if `core/` has drifted from the web repo.
- **`scripts/apitest.mjs`** plays a complete online match against a real server
  through the same protocol the app uses.

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
