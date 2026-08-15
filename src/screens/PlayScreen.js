/**
 * One play screen for all three modes.
 *
 * Every controller in core/match exposes the same view shape, so this file only
 * branches where the mode genuinely changes what a player sees — a room code in
 * the HUD, a handoff card between hot-seat turns.
 *
 * The controllers are plain observable objects rather than React state, so this
 * subscribes and forces a re-render. That's the same contract the web build uses
 * and the reason the controllers ported without modification.
 */

import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Modal, Pressable, Share, StyleSheet,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { color, role, font, size, space, radius, type } from '../theme.js';
import { Button, Panel, Eyebrow, Pill, Alert } from '../components/ui.js';
import { Ledger, Notes } from '../components/Ledger.js';
import { CodePad } from '../components/CodePad.js';
import { shareLink } from '../adapters/net.js';
import * as sfx from '../adapters/sfx.js';

export function PlayScreen({ match, onLeave }) {
  // Thinking about a guess means long stretches of not touching the screen; a
  // phone dimming mid-deduction is exactly the wrong moment.
  useKeepAwake();

  const [, force] = useReducer((n) => n + 1, 0);
  const [error, setError] = useState(null);
  const [resultHidden, setResultHidden] = useState(false);
  const [visibleBoard, setVisibleBoard] = useState(0);
  const [padKey, setPadKey] = useState(0);
  const notesRef = useRef({});          // seat -> marks
  const [, bumpNotes] = useReducer((n) => n + 1, 0);

  useEffect(() => match.on(force), [match]);

  const view = match.view();
  const seatKey = view.mode === 'local' ? view.seat : 'solo';
  const marks = notesRef.current[seatKey] || {};

  const setMarks = (next) => {
    notesRef.current[seatKey] = next;
    bumpNotes();
  };

  async function submitGuess(code) {
    setError(null);
    const outcome = await match.guess(code);
    if (!outcome.ok) {
      setError(outcome.error);
      sfx.play('reject');
      return;
    }
    sfx.play(outcome.score && outcome.score.position === 4 ? 'crack' : 'submit');
    setPadKey((k) => k + 1);
  }

  async function submitSecret(code) {
    setError(null);
    const outcome = await match.setSecret(code);
    if (!outcome.ok) {
      setError(outcome.error);
      sfx.play('reject');
      return;
    }
    sfx.play('submit');
    setPadKey((k) => k + 1);
  }

  function startRematch() {
    setError(null);
    setResultHidden(false);
    notesRef.current = {};
    setPadKey((k) => k + 1);
    match.rematch();
  }

  // --- end-of-match controls, shared by the overlay and the console ---------
  function endActions(placement) {
    const result = view.result;
    const rematch = result?.rematch;
    const buttons = [];

    buttons.push(
      placement === 'overlay'
        ? <Button key="board" label="View final board" variant="ghost" onPress={() => setResultHidden(true)} style={styles.grow} />
        : <Button key="result" label="Show result" variant="ghost" onPress={() => setResultHidden(false)} style={styles.grow} />,
    );
    buttons.push(
      <Button key="menu" label="Main menu" variant="ghost" onPress={onLeave} style={styles.grow} />,
    );

    if (view.mode !== 'online') {
      buttons.push(
        <Button key="again" label="Play again" variant="primary" onPress={startRematch} style={styles.grow} />,
      );
      return buttons;
    }

    if (rematch && !rematch.opponentPresent) return buttons;

    if (rematch && rematch.theyWant && !rematch.iWant) {
      buttons.push(
        <Button
          key="decline"
          label="Decline"
          variant="ghost"
          style={styles.grow}
          onPress={async () => { await match.declineRematch(); onLeave(); }}
        />,
        <Button key="accept" label="Accept rematch" variant="primary" onPress={startRematch} style={styles.grow} />,
      );
      return buttons;
    }

    buttons.push(
      <Button
        key="rematch"
        label={rematch?.iWant ? 'Waiting…' : 'Rematch'}
        variant="primary"
        disabled={Boolean(rematch?.iWant)}
        onPress={startRematch}
        style={styles.grow}
      />,
    );
    return buttons;
  }

  function endStatus() {
    const result = view.result;
    if (!result) return null;
    const rematch = result.rematch;
    if (rematch && !rematch.opponentPresent) return `${rematch.opponentName} left the room.`;
    if (rematch && rematch.theyWant && !rematch.iWant) return `${rematch.opponentName} wants a rematch.`;
    return result.pending || null;
  }

  // --- console -------------------------------------------------------------
  function renderConsole() {
    if (view.phase === 'connecting') {
      return <Status title="Joining the room" />;
    }

    if (view.phase === 'lobby') {
      return (
        <View style={styles.status}>
          <Eyebrow>Room open</Eyebrow>
          <Text style={styles.roomCode}>{view.room}</Text>
          <Text style={type.muted}>
            Send the code or the link. The match starts as soon as they join.
          </Text>
          <Button
            label="Share invite"
            variant="primary"
            style={{ width: '100%' }}
            onPress={() => Share.share({
              message: `Crack my code on NVP: ${shareLink(view.room)} (room ${view.room})`,
            })}
          />
          <Text style={styles.waiting}>Waiting for a second player…</Text>
        </View>
      );
    }

    if (view.phase === 'setup') {
      const prompt = view.secretPrompt;
      if (prompt?.alreadySet) {
        return <Status title="Code locked in" sub={`Waiting for ${view.them.name} to set theirs.`} />;
      }
      return (
        <View style={{ gap: space.md, alignItems: 'center' }}>
          <Eyebrow>
            {view.mode === 'local' && prompt ? `${prompt.name}'s secret code` : 'Your secret code'}
          </Eyebrow>
          <Text style={type.heading}>Choose 4 digits</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            No zero, no repeats. This is what your opponent has to break.
          </Text>
          <Alert>{error}</Alert>
          <CodePad
            masked={Boolean(prompt?.masked)}
            allowRandom
            submitLabel="Lock it in"
            disabled={Boolean(view.handoff) || view.busy}
            onSubmit={submitSecret}
            resetKey={padKey}
          />
        </View>
      );
    }

    if (view.phase === 'over') {
      return (
        <View style={styles.status}>
          <Eyebrow>Match over</Eyebrow>
          <Text style={type.heading}>{view.result?.title ?? 'Match over'}</Text>
          {endStatus() && <Text style={type.muted}>{endStatus()}</Text>}
          <View style={styles.actionWrap}>{endActions('console')}</View>
        </View>
      );
    }

    if (!view.yourTurn) {
      return (
        <Status
          title={view.mode === 'cpu' ? `${view.them.name} is thinking` : `${view.them.name}'s turn`}
          sub={view.mode === 'online' ? 'You will get the move as soon as they guess.' : null}
        />
      );
    }

    return (
      <View style={{ gap: space.md, alignItems: 'center' }}>
        <Eyebrow>
          {view.mode === 'local'
            ? `${view.me.name} → ${view.them.name}'s code`
            : `Break ${view.them.name}'s code`}
        </Eyebrow>
        <Alert>{error}</Alert>
        <CodePad
          disabled={Boolean(view.handoff) || view.busy}
          onSubmit={submitGuess}
          noteStates={marks}
          resetKey={padKey}
        />
        <Notes marks={marks} onChange={setMarks} />
      </View>
    );
  }

  const boards = (view.phase === 'playing' || view.phase === 'over') ? (view.boards || []) : [];
  const showResult = Boolean(view.result) && !resultHidden && !view.handoff;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.hud}>
          {(view.phase === 'playing' || view.phase === 'over') && (
            <Text style={styles.hudRound}>
              Round <Text style={{ color: color.text }}>{view.round}</Text>
            </Text>
          )}
          {view.phase === 'setup' && <Text style={styles.hudRound}>Setting codes</Text>}
          {view.phase === 'playing' && (
            <Pill
              tone={view.yourTurn ? 'live' : 'neutral'}
              label={view.mode === 'local'
                ? `${view.me.name} to guess`
                : (view.yourTurn ? 'Your move' : `${view.them.name} to move`)}
            />
          )}
          <View style={{ flex: 1 }} />
          {view.connection === 'stalled' && <Pill tone="warn" label="Reconnecting" />}
          {view.mode === 'online' && view.room && <Pill label={view.room} />}
          <Button label="Leave" variant="quiet" onPress={onLeave} />
        </View>

        {boards.length > 0 && (
          <>
            <View style={styles.segmented}>
              {boards.map((board, i) => (
                <Pressable
                  key={board.key}
                  onPress={() => setVisibleBoard(i)}
                  style={[styles.segment, i === visibleBoard && styles.segmentOn]}
                >
                  <Text
                    style={[styles.segmentText, i === visibleBoard && { color: color.text }]}
                    numberOfLines={1}
                  >
                    {board.title}
                  </Text>
                </Pressable>
              ))}
            </View>

            {boards[visibleBoard] && (
              <Panel active={boards[visibleBoard].active} style={{ gap: space.sm }}>
                <View style={styles.boardHead}>
                  <Text style={styles.boardWho}>
                    {boards[visibleBoard].title}
                    <Text style={styles.boardSub}> {boards[visibleBoard].sub}</Text>
                  </Text>
                  <Text style={styles.boardCount}>
                    {boards[visibleBoard].guesses.length}
                    {boards[visibleBoard].guesses.length === 1 ? ' try' : ' tries'}
                  </Text>
                </View>
                <Ledger guesses={boards[visibleBoard].guesses} />
              </Panel>
            )}
          </>
        )}

        <Panel active={Boolean(view.yourTurn)} style={{ gap: space.md }}>
          {renderConsole()}
        </Panel>
      </ScrollView>

      {/* Handoff gate: opaque on purpose — someone is about to look at this
          screen who must not see what is behind it. */}
      <Modal visible={Boolean(view.handoff)} animationType="fade" transparent={false}>
        <View style={styles.gate}>
          <Eyebrow>Pass the device</Eyebrow>
          <Text style={styles.gateName}>{view.handoff?.name}</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            Hand it over {view.handoff?.reason}. Nobody else should be looking.
          </Text>
          <Button
            label={`I'm ${view.handoff?.name}`}
            variant="primary"
            style={{ width: '100%', maxWidth: 320 }}
            onPress={() => match.acknowledgeHandoff()}
          />
        </View>
      </Modal>

      <Modal visible={showResult} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Eyebrow>{view.result?.kind === 'draw' ? 'Draw' : 'Result'}</Eyebrow>
            <Text
              style={[
                styles.resultTitle,
                view.result?.kind !== 'draw' && {
                  color: /^You /.test(view.result?.title || '') ? role.position : role.value,
                },
              ]}
            >
              {view.result?.title}
            </Text>
            <Text style={[type.muted, { textAlign: 'center' }]}>{view.result?.detail}</Text>

            <View style={styles.reveal}>
              {(view.result?.reveals || []).map((item, i) => (
                <View key={i} style={styles.revealRow}>
                  <Text style={styles.revealLabel} numberOfLines={2}>
                    {item.label}
                    <Text style={{ color: color.faint }}>
                      {item.rounds ? ` · broken in ${item.rounds}` : ' · never broken'}
                    </Text>
                  </Text>
                  <Text style={styles.revealCode}>{item.code || '····'}</Text>
                </View>
              ))}
            </View>

            {endStatus() && <Text style={styles.pending}>{endStatus()}</Text>}
            <View style={styles.actionWrap}>{endActions('overlay')}</View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Status({ title, sub }) {
  return (
    <View style={styles.status}>
      <Text style={type.heading}>{title}</Text>
      {sub && <Text style={[type.muted, { textAlign: 'center' }]}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  grow: { flexGrow: 1, flexBasis: 130 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
  hudRound: {
    fontFamily: font.mono,
    fontSize: size.micro,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: color.muted,
  },
  segmented: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentOn: { backgroundColor: color.raised },
  segmentText: {
    fontFamily: font.mono,
    fontSize: size.small,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.muted,
  },
  boardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  boardWho: { fontFamily: font.displayBold, fontSize: size.large, color: color.text },
  boardSub: { fontFamily: font.display, fontSize: size.small, color: color.muted },
  boardCount: { fontFamily: font.mono, fontSize: size.small, color: color.faint },
  status: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  roomCode: {
    fontFamily: font.monoBold,
    fontSize: 40,
    letterSpacing: 8,
    color: color.purple300,
    textAlign: 'center',
  },
  waiting: { fontFamily: font.mono, fontSize: size.small, color: color.muted },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    width: '100%',
    marginTop: space.sm,
  },
  gate: {
    flex: 1,
    backgroundColor: color.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
  },
  gateName: { fontFamily: font.displayBold, fontSize: 34, color: color.text, textAlign: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,8,10,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  resultCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  resultTitle: {
    fontFamily: font.displayBold,
    fontSize: 28,
    color: color.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  reveal: {
    width: '100%',
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    marginTop: space.sm,
  },
  revealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  revealLabel: { ...type.muted, flex: 1 },
  revealCode: { fontFamily: font.monoBold, fontSize: size.large, letterSpacing: 4, color: color.text },
  pending: { ...type.muted, fontSize: size.small, textAlign: 'center' },
});
