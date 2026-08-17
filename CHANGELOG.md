# Changelog

Every change to NVP, newest first. Covers both the web app and the Android app —
they share a game core, so a change to it lands in both.

---

## 2026-08-17 — Expo assets, first-launch intro

**Added — generated assets**

- `scripts/gen-icons.py` produces every image Expo needs from one definition of
  the mark: full-bleed `icon.png`, a transparent `adaptive-icon.png` confined to
  Android's centre-66% safe zone, a `monochrome-icon.png` for Android 13+ themed
  icons, `splash.png`, and a web `favicon.png`.
- Replaced the placeholders, which were wrong: the icon was a 512px web file
  reused, and the splash was an *iOS launch screenshot* rather than a logo image,
  so `expo-splash-screen` would have scaled a full phone-sized picture down to
  160px.

**Added — first-launch intro**

- Four-step onboarding, shown once and replayable from the menu. The final step
  is a real guess against a visible code, scored by the real engine — the game
  clicks the moment you see "Value 2, Position 1" against a code you can read.
- Every example number in the intro is asserted against the engine in
  `coretest.mjs` (now 41 checks), so onboarding can't drift into teaching the
  scoring backwards.

**Verified**

- `npx expo export` bundles 700 modules clean; `expo config` resolves with the
  new icon, adaptive icon, monochrome icon, splash and favicon all wired.

---

## 2026-08-16 — Android: build fixed, verified by actually bundling

Every dependency version in the first Android draft was written from memory, and
most of them were wrong. This round installed the packages and ran Metro for
real, so the build is now verified rather than assumed.

**Fixed — the build**

- **`babel-preset-expo` was never declared.** `babel.config.js` referenced it
  while `package.json` listed only `@babel/core`. This was the root cause of
  *both* reported errors: Metro builds its transformer from the babel config
  before bundling anything, so the missing preset surfaced as the opaque
  `Cannot read properties of undefined (reading 'transformFile')`.
- **Every dependency version was wrong.** SDK 57 unified the `expo-*` packages
  onto 57.x versioning; the first draft used older `~2.x`/`~8.x` numbers that
  don't exist. `@expo-google-fonts/space-grotesk` was pinned to `^0.4.2` when
  0.4.1 is the latest published. Versions now come from `expo@57.0.14`'s own
  `bundledNativeModules.json`, and all 20 were checked to resolve on npm.
- **`expo-asset` was missing** — a required peer of `expo-audio`, which
  expo-doctor warns "may crash outside of Expo Go". That is exactly how this app
  ships.

**Fixed — app config schema**

- Removed the top-level `splash` key; SDK 57 takes splash config through the
  `expo-splash-screen` plugin.
- `android.usesCleartextTraffic` isn't a valid schema field. Moved to the
  `expo-build-properties` plugin, which is the supported route.
- Trimmed the `expo-font` and `expo-audio` plugin entries — neither is needed
  when fonts load at runtime and no microphone permission is required.

**Changed**

- Fonts import per-weight entry points instead of the package root, which was
  bundling all nine weights of both families. Nine font files (845KB) down to
  four (369KB).
- Added `metro.config.js` (Expo's default, stated explicitly) and `eas.json`
  with development / preview / production profiles.
- Removed the unused `expo-status-bar` dependency.

**Verified**

- `npm install` completes, `npx expo export --platform android` bundles 699
  modules with no errors, `expo config` resolves, and expo-doctor passes every
  check that doesn't require network access.
- Documented why a dev build is ~180MB (dev client, debug symbols, all ABIs) and
  what ships instead: ~25–40MB release APK, ~15–25MB delivered from Play.

---

## 2026-08-16 — NVP Daily

**Added — one puzzle a day, everywhere**

- **`shared/daily.js`** — the daily puzzle, derived from the date rather than
  fetched. No server, no account, and the website and Android app compute the
  same code for the same day independently.
- **Seeded permutation, not a hash.** The first attempt hashed the date to an
  index, which draws *with replacement* — a code recurred four times in the first
  800 days, and a daily player would notice solving the same code twice. It now
  walks a fixed shuffle of all 3,024 codes: no repeat for ~8.3 years.
- **Eight attempts**, verified fair rather than guessed: a competent solver
  finishes 100% of puzzles in an average of 5.09.
- **Shareable pip grid** (🟩🟨⬜) reproducing the board exactly while containing
  no digits, so it's safe to post while others are still playing. Native share
  sheet on both platforms, clipboard fallback on web.
- **Streaks and a solve histogram**, stored locally.
- **Progress saves after every guess**, so closing mid-puzzle resumes exactly
  where you were — there's no second attempt at a daily.
- Featured card on both menus, plus `?mode=daily` deep link on web.

**Fixed**

- Daily histogram read "0 days" after an unsolved game; it now reports played and
  solved separately and hides until there's something to plot.

**Removed**

- All mention of turn notifications. No notification code, no permission request,
  no `expo-notifications` dependency — the only thing that buzzes is haptic
  feedback on your own taps.

**Tests**

- `scripts/dailytest.mjs` (web): determinism, the full 3,024-day permutation,
  streak edges, distribution, digit-free grids, and an attempt-budget fairness
  check.
- Mobile `coretest.mjs` grew to 38 checks, including a hard-coded assertion that
  15 June 2026 is code `7648` on *both* platforms — a daily that differs by
  platform would be worse than no daily.

---

## 2026-08-16 — Android: fixed startup, real backend integration

**Fixed — the app wouldn't load**

- `App.js` held the splash screen until fonts resolved and rendered `null` until
  then, while ignoring the error from `useFonts`. Any font failure meant a
  permanently blank app. Fonts are now best-effort with a system fallback, and
  the splash hides from a `finally`.
- Native modules were imported at module scope, so one missing package killed the
  bundle before React mounted, with no visible error. All of them now load
  through `src/adapters/native.js`, which degrades to a working fallback and
  records what failed.
- Added an error boundary and a diagnostic screen, so a failure shows what broke
  instead of a blank screen. Degraded modules are also reported on the menu.

**Added — backend integration**

- `src/config.js` resolves the API address at call time: a saved in-app override,
  then `extra.apiUrl`, then (in dev) the host Metro served the bundle from —
  `10.0.2.2` on the emulator, the LAN address on a device.
- Server status badge in the lobby via `/api/health`, distinguishing *Server
  ready* / *No storage* / *Server unreachable*. Tapping it repoints the app at a
  different server at runtime, no rebuild.
- `usesCleartextTraffic` so Android permits plain http to a local dev server.
- `scripts/apitest.mjs`: 17 checks playing a complete match, rematch handshake and
  seat cleanup against a real server.

**Added — Android features**

- Native share of results as a pip grid; clipboard copy of the room code with a
  toast.
- Back button confirms before abandoning a live match, double-press to exit from
  the menu.
- Themed icon for Android 13+, keyboard avoidance in the lobby.
- Swapped `@react-native-community/netinfo` for first-party `expo-network`, one
  fewer native module to fail to link.

---

## 2026-08-15 — Android app (Expo SDK 57)

**Added**

- Full Android port on Expo SDK 57 (RN 0.86, React 19.2.3, New Architecture).
- The engine, CPU and all three match controllers are the **same files** as the
  web build, synced by `scripts/sync-core.mjs` with a `--check` mode that fails
  the build if the two drift.
- Three adapters are the entire porting layer: `prefs` on `expo-sqlite/kv-store`
  (chosen for its synchronous getters — AsyncStorage would have forced the shared
  core to become async), `sfx` on bundled WAVs plus `expo-haptics`, and `net` with
  `AppState`-driven polling.
- `scripts/gen-sounds.py` renders the web build's WebAudio oscillator cues to WAV,
  since React Native has no WebAudio.
- Headless test suite: ported-core behaviour, and a static pass parsing every file
  and resolving every import.

---

## 2026-08-15 — Web: installable app, offline play

**Added**

- Service worker precaching the shell; pass-and-play and the CPU work fully
  offline. Verified by killing the server and playing a complete match.
- Install prompt on Android, Add-to-Home-Screen instructions on iOS (Apple fires
  no install event).
- Haptics, screen wake lock, safe-area insets, iOS splash images, home-screen
  shortcuts.
- Cache version is a content hash, so the "Update ready" prompt fires exactly
  when something changed. Updates never apply silently — activating a worker
  forces a reload, which mid-match would cost someone their turn.
- `scripts/pwatest.py`: ten checks including the kill-the-server offline match.

---

## 2026-08-15 — Rematch handshake, final board, responsiveness

**Added**

- End-of-match controls now also appear in the console, so "View final board"
  doesn't strand you with no way to rematch or leave.
- Online rematch is a real handshake: the requester waits, the opponent gets
  Accept / Decline. Declining frees the seat and returns to the menu.

**Fixed**

- Leaving a room left the *remaining* player's secret and guesses in place, so
  the next person to join walked into a half-finished match. The survivor is now
  reset.
- How-to-play list was unreadable: raw text and `<strong>` sat as separate CSS
  grid children, so everything past the first two items wrapped one word per line
  inside the bullet column.
- Room-code input had no `size` attribute, giving it a ~20-character intrinsic
  width that overflowed the viewport at 320px.

---

## 2026-08-15 — Storage verification

**Added**

- `/api/health` reporting the live storage driver and proving it with a real
  round trip.
- `npm run check-storage` for pre-deploy verification against real credentials.
- Mock of the Upstash REST protocol, so the Redis driver is exercised in CI
  without a live database.

**Fixed**

- The in-memory store handed out live object references, so mutations bypassed
  the compare-and-swap and a player could lose a submitted code.

---

## 2026-08-14 — Complete rebuild

**Added**

- Rewritten from scratch: rules engine, three CPU difficulties (measured at 7.5 /
  5.7 / 5.1 rounds average), pass-and-play with a handoff gate, online rooms, and
  a deduction notepad.
- Turn order and results are *derived* from the two guess lists rather than
  stored, so there's no shared pointer for simultaneous requests to disagree
  about — and the second player always gets a reply, making a same-round crack a
  draw rather than a loss.
- Secrets never leave the server in online play.
- Compare-and-swap writes inside a Lua script.
