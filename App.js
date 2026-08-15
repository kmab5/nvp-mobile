/**
 * App shell.
 *
 * Deliberately not using a stack navigator. A match is a long-lived controller
 * object that has to survive every screen change within a game, and games don't
 * really have a navigation stack — there is one surface, and the mode decides
 * what it shows. A state machine mirrors that (and mirrors the web build, which
 * is what keeps the two ports comparable). What a router would have given for
 * free is handled explicitly below: the Android back button, and deep links.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, View, Alert as RNAlert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

import { color } from './src/theme.js';
import { MenuScreen, RulesScreen } from './src/screens/MenuScreen.js';
import { LocalSetupScreen, CpuSetupScreen, OnlineLobbyScreen } from './src/screens/SetupScreens.js';
import { PlayScreen } from './src/screens/PlayScreen.js';
import { createLocalMatch } from './core/match/local.js';
import { createCpuMatch } from './core/match/cpu.js';
import { createOnlineMatch } from './core/match/online.js';
import * as sfx from './src/adapters/sfx.js';
import * as prefs from './src/adapters/prefs.js';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [online, setOnline] = useState(true);
  const [invite, setInvite] = useState('');
  const matchRef = useRef(null);
  const [, force] = useState(0);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      sfx.prepare();
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => () => sfx.release(), []);

  // Connectivity drives whether online mode is offerable at all.
  useEffect(() => NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  }), []);

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
    const handle = (url) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const room = parsed.queryParams?.room
        || (parsed.path || '').replace(/^room\/?/, '');
      if (room && /^[A-Za-z0-9]{5}$/.test(room)) {
        setInvite(room.toUpperCase());
        closeMatch();
        setScreen('online');
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, [closeMatch]);

  // Android back button: leaving a live match asks first, because backing out of
  // an online room forfeits the seat for the other player.
  useEffect(() => {
    const onBack = () => {
      if (screen === 'menu') return false;   // let the OS close the app
      if (matchRef.current) {
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
      go('menu');
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

  if (!fontsLoaded) return null;   // splash stays up

  let body = null;
  if (screen === 'play' && matchRef.current) {
    body = <PlayScreen match={matchRef.current} onLeave={leaveMatch} />;
  } else if (screen === 'rules') {
    body = <RulesScreen go={go} />;
  } else if (screen === 'local') {
    body = (
      <LocalSetupScreen
        go={go}
        start={(config) => startMatch(() => createLocalMatch(config))}
      />
    );
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
        <View style={styles.body}>{body}</View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },
});
