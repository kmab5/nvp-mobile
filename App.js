/**
 * App shell.
 *
 * Deliberately not using a stack navigator. A match is a long-lived controller
 * object that has to survive every screen change within a game, and a game
 * doesn't really have a navigation stack — there is one surface, and the mode
 * decides what it shows. What a router would have given for free is handled
 * explicitly below: the Android back button, and deep links.
 *
 * Startup is written defensively on purpose. The first version held the splash
 * screen until fonts resolved and rendered null until then, so any font failure
 * left the app on a splash screen forever with nothing to debug. Now fonts are
 * best-effort, the splash is hidden from a `finally`, and anything that still
 * throws lands in a readable error screen rather than a blank one.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler, StatusBar, StyleSheet, View, ToastAndroid, Platform,
  Alert as RNAlert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { color } from './src/theme.js';
import { optional } from './src/adapters/native.js';
import { ErrorBoundary } from './src/components/ErrorBoundary.js';
import { MenuScreen, RulesScreen } from './src/screens/MenuScreen.js';
import { LocalSetupScreen, CpuSetupScreen, OnlineLobbyScreen } from './src/screens/SetupScreens.js';
import { PlayScreen } from './src/screens/PlayScreen.js';
import { DailyScreen } from './src/screens/DailyScreen.js';
import { createLocalMatch } from './core/match/local.js';
import { createCpuMatch } from './core/match/cpu.js';
import { createOnlineMatch } from './core/match/online.js';
import * as sfx from './src/adapters/sfx.js';

const SplashScreen = optional('expo-splash-screen', () => require('expo-splash-screen'), {
  preventAutoHideAsync: async () => {},
  hideAsync: async () => {},
});
const Linking = optional('expo-linking', () => require('expo-linking'), null);
const Network = optional('expo-network', () => require('expo-network'), null);
const Font = optional('expo-font', () => require('expo-font'), null);

SplashScreen.preventAutoHideAsync().catch(() => {});

// Loaded lazily so a missing font package cannot take the bundle down at import.
async function loadFonts() {
  if (!Font?.loadAsync) return false;
  const grotesk = optional(
    '@expo-google-fonts/space-grotesk',
    () => require('@expo-google-fonts/space-grotesk'),
    null,
  );
  const mono = optional(
    '@expo-google-fonts/space-mono',
    () => require('@expo-google-fonts/space-mono'),
    null,
  );
  if (!grotesk || !mono) return false;
  await Font.loadAsync({
    SpaceGrotesk_500Medium: grotesk.SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold: grotesk.SpaceGrotesk_700Bold,
    SpaceMono_400Regular: mono.SpaceMono_400Regular,
    SpaceMono_700Bold: mono.SpaceMono_700Bold,
  });
  return true;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState('menu');
  const [online, setOnline] = useState(true);
  const [invite, setInvite] = useState('');
  const matchRef = useRef(null);
  const backAt = useRef(0);
  const [, force] = useState(0);

  // Boot: try to load fonts, but never let that block the app. The UI falls
  // back to the system typeface rather than showing nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadFonts();
      } catch (error) {
        if (__DEV__) console.warn('[nvp] fonts failed, using system fallback', error);
      } finally {
        if (!cancelled) setBooted(true);
        // In a finally so a font failure cannot strand the app on the splash.
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (booted) sfx.prepare();
  }, [booted]);

  useEffect(() => () => sfx.release(), []);

  // Connectivity, if the module is present. Defaults to online so a missing
  // module cannot lock anyone out of the mode.
  useEffect(() => {
    if (!Network?.addNetworkStateListener) return undefined;
    let subscription;
    try {
      Network.getNetworkStateAsync?.()
        .then((state) => setOnline(state?.isInternetReachable !== false))
        .catch(() => {});
      subscription = Network.addNetworkStateListener(({ isInternetReachable, isConnected }) => {
        setOnline(isInternetReachable !== false && isConnected !== false);
      });
    } catch {
      /* leave it optimistic */
    }
    return () => subscription?.remove?.();
  }, []);

  const closeMatch = useCallback(() => {
    matchRef.current?.quit();
    matchRef.current = null;
  }, []);

  const go = useCallback((next) => {
    if (next !== 'play') closeMatch();
    setScreen(next);
  }, [closeMatch]);

  const leaveMatch = useCallback(() => {
    closeMatch();
    setScreen('menu');
  }, [closeMatch]);

  // Invite links: nvp://room/ABC12 and https://<host>/?room=ABC12 both land here.
  useEffect(() => {
    if (!Linking) return undefined;
    const handle = (url) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const room = parsed.queryParams?.room || (parsed.path || '').replace(/^room\/?/, '');
        if (room && /^[A-Za-z0-9]{5}$/.test(room)) {
          setInvite(String(room).toUpperCase());
          closeMatch();
          setScreen('online');
        }
      } catch {
        /* malformed link — ignore */
      }
    };
    Linking.getInitialURL?.().then(handle).catch(() => {});
    const sub = Linking.addEventListener?.('url', (event) => handle(event.url));
    return () => sub?.remove?.();
  }, [closeMatch]);

  // Android back: confirm before abandoning a live match, and require a double
  // press to leave the app from the menu.
  useEffect(() => {
    const onBack = () => {
      if (matchRef.current && screen === 'play') {
        RNAlert.alert(
          'Leave the match?',
          matchRef.current.mode === 'online'
            ? 'Your opponent will be told the seat is free.'
            : 'Progress will be lost.',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: leaveMatch },
          ],
        );
        return true;
      }
      if (screen !== 'menu') {
        go('menu');
        return true;
      }
      const now = Date.now();
      if (now - backAt.current < 2000) return false;   // let the OS close the app
      backAt.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [screen, go, leaveMatch]);

  const startMatch = useCallback((factory) => {
    closeMatch();
    matchRef.current = factory();
    setScreen('play');
    force((n) => n + 1);
  }, [closeMatch]);

  let body = null;
  if (!booted) {
    body = <View style={styles.body} />;
  } else if (screen === 'play' && matchRef.current) {
    body = <PlayScreen match={matchRef.current} onLeave={leaveMatch} />;
  } else if (screen === 'daily') {
    body = <DailyScreen go={go} />;
  } else if (screen === 'rules') {
    body = <RulesScreen go={go} />;
  } else if (screen === 'local') {
    body = <LocalSetupScreen go={go} start={(config) => startMatch(() => createLocalMatch(config))} />;
  } else if (screen === 'cpu') {
    body = (
      <CpuSetupScreen
        go={go}
        start={({ difficulty }) => startMatch(
          () => createCpuMatch({ difficulty, playerName: 'You' }),
        )}
      />
    );
  } else if (screen === 'online') {
    body = (
      <OnlineLobbyScreen
        go={go}
        initialRoom={invite}
        start={({ room, token, seat, state }) => startMatch(
          () => createOnlineMatch({ room, token, seat, initialState: state }),
        )}
      />
    );
  } else {
    body = <MenuScreen go={go} online={online} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={color.bg} />
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <ErrorBoundary>
          <View style={styles.body}>{body}</View>
        </ErrorBoundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },
});
