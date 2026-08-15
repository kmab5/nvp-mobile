/**
 * Pre-match setup: names, difficulty, and the online lobby. Secret codes are
 * collected on the play screen, where the handoff gate already lives.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { color, role, font, size, space, radius, type } from '../theme.js';
import { Button, Panel, Eyebrow, Alert } from '../components/ui.js';
import { LEVEL_ORDER, LEVELS } from '../../core/cpu.js';
import { api, NetError } from '../adapters/net.js';
import * as prefs from '../adapters/prefs.js';

function Field({ label, value, onChangeText, placeholder, ...rest }) {
  return (
    <View style={{ gap: 4 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        maxLength={14}
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export function LocalSetupScreen({ go, start }) {
  const [nameA, setNameA] = useState(prefs.get('names.p1', ''));
  const [nameB, setNameB] = useState(prefs.get('names.p2', ''));
  const [gate, setGate] = useState(prefs.get('handoffGate', true));

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>Pass and play</Eyebrow>
      <Text style={type.title}>Who is playing?</Text>
      <Text style={type.muted}>
        You will each set a secret code on the next screen, one at a time.
      </Text>

      <Field label="First player" value={nameA} onChangeText={setNameA} placeholder="Player 1" />
      <Field label="Second player" value={nameB} onChangeText={setNameB} placeholder="Player 2" />

      <View style={styles.switchRow}>
        <Switch
          value={gate}
          onValueChange={setGate}
          trackColor={{ true: color.purple700, false: color.lineStrong }}
          thumbColor={gate ? role.accent : color.muted}
        />
        <Text style={type.muted}>Show a handoff card between turns</Text>
      </View>

      <Text style={styles.note}>
        Guesses and scores are public — only the codes are hidden.
      </Text>

      <View style={styles.actions}>
        <Button label="Back" variant="ghost" onPress={() => go('menu')} style={{ flex: 1 }} />
        <Button
          label="Start match"
          variant="primary"
          style={{ flex: 1 }}
          onPress={() => {
            const names = { A: nameA.trim() || 'Player 1', B: nameB.trim() || 'Player 2' };
            prefs.set('names.p1', names.A);
            prefs.set('names.p2', names.B);
            prefs.set('handoffGate', gate);
            start({ names, gate });
          }}
        />
      </View>
    </ScrollView>
  );
}

export function CpuSetupScreen({ go, start }) {
  const stored = prefs.get('lastDifficulty', 'racer');
  const [chosen, setChosen] = useState(LEVELS[stored] ? stored : 'racer');
  const record = prefs.get('record.cpu', {}) || {};

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>Play the CPU</Eyebrow>
      <Text style={type.title}>Pick your opponent</Text>
      <Text style={type.muted}>
        You move first in every round. All three levels reason only from the scores you
        give them.
      </Text>

      <View style={{ gap: space.sm }}>
        {LEVEL_ORDER.map((id, index) => {
          const level = LEVELS[id];
          const book = record[id];
          const active = id === chosen;
          return (
            <Pressable
              key={id}
              onPress={() => setChosen(id)}
              style={[styles.choice, active && styles.choiceActive]}
            >
              <View style={styles.bars}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      { height: 8 + i * 6 },
                      i <= index && { backgroundColor: active ? role.accent : color.muted },
                    ]}
                  />
                ))}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.choiceName}>
                  {level.name}
                  <Text style={styles.choiceTagline}> — {level.tagline}</Text>
                </Text>
                <Text style={type.muted}>{level.blurb}</Text>
                <Text style={styles.choicePace}>
                  {level.pace}
                  {book?.best ? ` · your best: ${book.best} rounds` : ''}
                  {book && (book.won || book.lost) ? ` · ${book.won || 0}W ${book.lost || 0}L` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button label="Back" variant="ghost" onPress={() => go('menu')} style={{ flex: 1 }} />
        <Button
          label="Start match"
          variant="primary"
          style={{ flex: 1 }}
          onPress={() => {
            prefs.set('lastDifficulty', chosen);
            start({ difficulty: chosen });
          }}
        />
      </View>
    </ScrollView>
  );
}

export function OnlineLobbyScreen({ go, start, initialRoom = '' }) {
  const [name, setName] = useState(prefs.get('names.online', ''));
  const [code, setCode] = useState(initialRoom.toUpperCase());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resumable, setResumable] = useState(null);

  // A match interrupted by a phone call or an app switch shouldn't be forfeit;
  // the seat token is kept locally and revalidated before it's offered back.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = prefs.session.read();
      if (!saved) return;
      try {
        const { state } = await api.state(saved.room, saved.token);
        if (!cancelled && (state.phase !== 'over' || state.opponent)) {
          setResumable({ ...saved, state });
        }
      } catch {
        prefs.session.clear();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function run(work) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (problem) {
      setError(problem instanceof NetError ? problem.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const create = () => run(async () => {
    prefs.set('names.online', name.trim());
    const response = await api.createRoom(name.trim() || 'Player 1');
    prefs.session.save({ room: response.room, token: response.token, seat: response.seat });
    start(response);
  });

  const join = () => run(async () => {
    if (code.length !== 5) {
      setError('Room codes are five characters.');
      setBusy(false);
      return;
    }
    prefs.set('names.online', name.trim());
    const response = await api.joinRoom(code, name.trim() || 'Player 2');
    prefs.session.save({ room: response.room, token: response.token, seat: response.seat });
    start(response);
  });

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>Play online</Eyebrow>
      <Text style={type.title}>Open a room or join one</Text>
      <Text style={type.muted}>Rooms hold two players and expire after six hours of quiet.</Text>

      {resumable && (
        <Panel style={{ gap: space.sm }}>
          <Eyebrow>Match in progress</Eyebrow>
          <Text style={type.body}>Room {resumable.room} is still open.</Text>
          <Button
            label="Rejoin that match"
            variant="primary"
            onPress={() => start({ ...resumable, state: resumable.state })}
          />
          <Button
            label="Forget it"
            variant="quiet"
            onPress={() => {
              api.leave(resumable.room, resumable.token).catch(() => {});
              prefs.session.clear();
              setResumable(null);
            }}
          />
        </Panel>
      )}

      <Field label="Your name" value={name} onChangeText={setName} placeholder="Player 1" />

      <Alert>{error}</Alert>

      <Button
        label={busy ? 'Working…' : 'Open a new room'}
        variant="primary"
        disabled={busy}
        onPress={create}
      />

      <Eyebrow style={{ textAlign: 'center', marginTop: space.sm }}>or join with a code</Eyebrow>

      <View style={styles.joinRow}>
        <TextInput
          value={code}
          onChangeText={(next) => setCode(next.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
          placeholder="ABC12"
          placeholderTextColor={color.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={5}
          style={[styles.input, styles.codeInput]}
        />
        <Button label="Join" disabled={busy} onPress={join} />
      </View>

      <Button label="Back to the menu" variant="quiet" onPress={() => go('menu')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.md,
    color: color.text,
    fontFamily: font.display,
    fontSize: size.base,
  },
  codeInput: {
    flex: 1,
    fontFamily: font.monoBold,
    fontSize: size.xl,
    letterSpacing: 6,
    textAlign: 'center',
  },
  joinRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  note: { ...type.muted, fontSize: size.small },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  choice: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
  },
  choiceActive: { borderColor: role.accent, backgroundColor: color.purple900 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22, paddingTop: 4 },
  bar: { width: 5, borderRadius: 1, backgroundColor: color.lineStrong },
  choiceName: { fontFamily: font.displayBold, fontSize: size.base, color: color.text },
  choiceTagline: { fontFamily: font.display, fontSize: size.small, color: color.muted },
  choicePace: { fontFamily: font.mono, fontSize: size.small, color: color.faint },
});
