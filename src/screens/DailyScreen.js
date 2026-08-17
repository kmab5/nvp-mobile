/**
 * NVP Daily on Android.
 *
 * Same puzzle as the website, same day — the code comes from the shared core, so
 * the two can't disagree. Sharing goes through the native sheet, which is the
 * whole reason this mode earns its place on a phone: the grid is one tap from
 * any chat app.
 */

import React, { useEffect, useReducer, useState } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { color, role, font, size, space, radius, type } from '../theme.js';
import { Button, Panel, Eyebrow, Alert } from '../components/ui.js';
import { Ledger, Notes } from '../components/Ledger.js';
import { CodePad } from '../components/CodePad.js';
import { createDailyMatch } from '../../core/match/daily.js';
import { formatCountdown, MAX_ATTEMPTS } from '../../core/daily.js';
import { apiBase } from '../config.js';
import * as sfx from '../adapters/sfx.js';

export function DailyScreen({ go }) {
  const [match] = useState(() => createDailyMatch({ link: apiBase() || 'nvp' }));
  const [, force] = useReducer((n) => n + 1, 0);
  const [error, setError] = useState(null);
  const [marks, setMarks] = useState({});
  const [padKey, setPadKey] = useState(0);
  const [tick, retick] = useReducer((n) => n + 1, 0);

  useEffect(() => match.on(force), [match]);

  const view = match.view();

  // The countdown only matters once the day is done.
  useEffect(() => {
    if (view.phase !== 'over') return undefined;
    const timer = setInterval(retick, 1000);
    return () => clearInterval(timer);
  }, [view.phase]);

  function submit(code) {
    setError(null);
    const outcome = match.guess(code);
    if (!outcome.ok) {
      setError(outcome.error);
      sfx.play('reject');
      return;
    }
    setPadKey((k) => k + 1);
  }

  const grid = view.shareText ? view.shareText.split('\n').slice(2).join('\n') : '';

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>Daily · puzzle #{view.number}</Eyebrow>
      <Text style={type.title}>One code, everyone</Text>
      <Text style={type.muted}>
        {view.phase === 'over'
          ? 'Come back tomorrow for the next one.'
          : `${view.remaining} ${view.remaining === 1 ? 'attempt' : 'attempts'} left. `
            + 'Everybody in the world gets this same code today.'}
      </Text>
      {view.streak > 0 && <Text style={styles.streak}>🔥 {view.streak} day streak</Text>}

      {view.guesses.length > 0 && (
        <Panel>
          <Ledger guesses={view.guesses} />
        </Panel>
      )}

      {view.phase === 'over' ? (
        <View style={styles.done}>
          <Text
            style={[
              styles.resultTitle,
              { color: view.solved ? role.position : role.value },
            ]}
          >
            {view.solved ? 'Cracked it' : 'Out of attempts'}
          </Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            {view.solved
              ? `Puzzle #${view.number} in ${view.attempts} `
                + `${view.attempts === 1 ? 'attempt' : 'attempts'}.`
              : `Puzzle #${view.number}. The code was ${view.secret}.`}
          </Text>

          <View style={styles.reveal}>
            <Text style={styles.revealLabel}>Today&apos;s code</Text>
            <Text style={styles.revealCode}>{view.secret}</Text>
          </View>

          <Text style={styles.grid}>{grid}</Text>

          <Button
            label="Share result"
            variant="primary"
            style={{ width: '100%' }}
            onPress={() => Share.share({ message: view.shareText }).catch(() => {})}
          />
          <Text style={styles.countdown}>
            Next puzzle in {formatCountdown(view.msUntilNext)}
          </Text>

          <Histogram stats={view.stats} current={view.solved ? view.attempts : 0} />
        </View>
      ) : (
        <View style={{ gap: space.md, alignItems: 'center', marginTop: space.sm }}>
          <Alert>{error}</Alert>
          <CodePad
            submitLabel="Submit guess"
            onSubmit={submit}
            noteStates={marks}
            resetKey={padKey}
          />
          <Notes marks={marks} onChange={setMarks} />
        </View>
      )}

      <Button label="Back to the menu" variant="quiet" onPress={() => go('menu')} />
    </ScrollView>
  );
}

function Histogram({ stats, current }) {
  if (!stats.solved) {
    return (
      <Text style={[type.muted, { textAlign: 'center' }]}>
        {stats.played === 1
          ? 'That was your first daily. Solve one and your record shows up here.'
          : `${stats.played} dailies played, none solved yet.`}
      </Text>
    );
  }
  const peak = Math.max(1, ...stats.buckets);
  return (
    <View style={styles.histogram}>
      <Eyebrow>Solved in — {stats.solved} of {stats.played}</Eyebrow>
      {stats.buckets.map((count, i) => (
        <View key={i} style={styles.histRow}>
          <Text style={styles.histLabel}>{i + 1}</Text>
          <View
            style={[
              styles.histBar,
              { width: `${Math.max(8, (count / peak) * 100)}%` },
              current === i + 1 && { backgroundColor: color.purple700 },
            ]}
          >
            <Text style={styles.histCount}>{count}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  streak: { fontFamily: font.mono, color: color.amber300, fontSize: size.small },
  done: { gap: space.md, alignItems: 'center', marginTop: space.sm },
  resultTitle: { fontFamily: font.displayBold, fontSize: 28, textAlign: 'center' },
  reveal: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  revealLabel: { ...type.muted },
  revealCode: { fontFamily: font.monoBold, fontSize: size.xl, letterSpacing: 4, color: color.text },
  grid: {
    fontFamily: font.mono,
    fontSize: size.large,
    lineHeight: 26,
    letterSpacing: 2,
    textAlign: 'center',
    color: color.text,
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space.md,
    width: '100%',
  },
  countdown: { fontFamily: font.mono, fontSize: size.small, color: color.muted },
  histogram: { width: '100%', gap: 3, marginTop: space.sm },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  histLabel: { fontFamily: font.mono, fontSize: size.small, color: color.faint, width: 16 },
  histBar: {
    backgroundColor: color.raised,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: 'flex-end',
  },
  histCount: { fontFamily: font.mono, fontSize: size.small, color: color.muted },
});
