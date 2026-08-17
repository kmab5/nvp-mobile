/**
 * Menu and rules.
 *
 * The hero is the acronym expanded — it doubles as the rules, in the colours
 * those two words wear for the rest of the game.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { color, role, font, size, space, radius, type } from '../theme.js';
import { Button, Panel, Eyebrow, Mark } from '../components/ui.js';
import { LedgerRow } from '../components/Ledger.js';
import * as prefs from '../adapters/prefs.js';
import * as sfx from '../adapters/sfx.js';
import { nativeWarnings } from '../adapters/native.js';
import { puzzleNumber, dayKey, streakFrom, MAX_ATTEMPTS } from '../../core/daily.js';

const MODES = [
  {
    id: 'local',
    name: 'Pass and play',
    desc: 'Two of you, one phone. Codes are masked while you type, and the screen hands off between turns.',
    tiles: [1, 1, 0, 0],
  },
  {
    id: 'online',
    name: 'Play online',
    desc: 'Open a room, send the code. Two devices, anywhere, same match.',
    tiles: [1, 0, 0, 1],
  },
  {
    id: 'cpu',
    name: 'Play the CPU',
    desc: 'Three levels. The Rookie forgets things. The Ace never wastes a question.',
    tiles: [1, 2, 2, 2],
  },
];

function KeywordRow({ lead, rest, gloss, tint }) {
  return (
    <View style={styles.keywordRow}>
      <View style={styles.keywordHead}>
        <Text style={[styles.keywordLead, tint && { color: tint, borderBottomColor: tint }]}>
          {lead}
        </Text>
        <Text style={[styles.keywordRest, tint && { color: tint }]}>{rest}</Text>
      </View>
      <Text style={styles.keywordGloss}>{gloss}</Text>
    </View>
  );
}

export function MenuScreen({ go, online }) {
  const [, force] = React.useReducer((n) => n + 1, 0);
  const record = prefs.summary();

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>A code-cracking duel</Eyebrow>

      <View style={styles.keyword}>
        <KeywordRow lead="N" rest="UMBER" gloss="Four digits, 1 to 9, none repeated." />
        <KeywordRow lead="V" rest="ALUE" gloss="How many of your digits are in their code." tint={role.value} />
        <KeywordRow lead="P" rest="OSITION" gloss="How many of those are in the right slot." tint={role.position} />
      </View>

      <Text style={styles.lede}>
        You each hide a code. You take turns guessing. Every guess comes back scored on
        those two numbers and nothing else — first to read the other&apos;s code wins.
      </Text>

      <DailyCard go={go} />

      <View style={{ gap: space.md }}>
        {MODES.map((mode) => {
          const unavailable = !online && mode.id === 'online';
          return (
            <Pressable
              key={mode.id}
              disabled={unavailable}
              onPress={() => { sfx.play('tap'); go(mode.id); }}
              style={({ pressed }) => [
                styles.mode,
                pressed && { borderColor: color.purple700, backgroundColor: color.raised },
                unavailable && { opacity: 0.45 },
              ]}
            >
              <View style={styles.modeTiles}>
                {mode.tiles.map((state, i) => (
                  <View
                    key={i}
                    style={[
                      styles.modeTile,
                      state === 1 && { backgroundColor: role.accent },
                      state === 2 && { backgroundColor: color.purple900, borderWidth: 1, borderColor: color.purple700 },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.modeName}>{mode.name}</Text>
              <Text style={styles.modeDesc}>
                {unavailable ? 'Needs a connection — you are offline.' : mode.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {record.played > 0 && (
        <View style={styles.statline}>
          <Text style={styles.stat}>
            {record.played} {record.played === 1 ? 'match' : 'matches'} played
          </Text>
          <Text style={styles.stat}>
            <Text style={{ color: color.text }}>{record.wins}</Text> won
          </Text>
          {record.best && (
            <Text style={styles.stat}>
              fastest crack: <Text style={{ color: color.text }}>{record.best} rounds</Text>
            </Text>
          )}
        </View>
      )}

      <View style={styles.footerRow}>
        <Button label="How to play" variant="ghost" onPress={() => go('rules')} />
      </View>

      <View style={styles.toggles}>
        <Pressable
          onPress={() => { sfx.toggle(); force(); }}
          style={[styles.toggle, sfx.enabled() && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, sfx.enabled() && { color: color.purple300 }]}>
            {sfx.enabled() ? 'Sound on' : 'Sound off'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { sfx.toggleHaptics(); force(); }}
          style={[styles.toggle, sfx.hapticsEnabled() && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, sfx.hapticsEnabled() && { color: color.purple300 }]}>
            {sfx.hapticsEnabled() ? 'Vibration on' : 'Vibration off'}
          </Text>
        </Pressable>
      </View>

      {nativeWarnings().length > 0 && (
        <View style={styles.warnBlock}>
          <Text style={styles.warnTitle}>Running with reduced features</Text>
          {nativeWarnings().map((warning, i) => (
            <Text key={i} style={styles.warnText}>• {warning}</Text>
          ))}
          <Text style={styles.warnText}>
            Rebuild with npx expo run:android to restore them.
          </Text>
        </View>
      )}

      <View style={styles.credit}>
        <Mark size={18} />
        <Text style={styles.creditText}>NVP — a game by Sami</Text>
      </View>
    </ScrollView>
  );
}

function DailyCard({ go }) {
  const history = prefs.get('daily.history', {}) || {};
  const today = history[dayKey()];
  const streak = streakFrom(history);
  const done = Boolean(today?.finished);

  return (
    <Pressable
      onPress={() => { sfx.play('tap'); go('daily'); }}
      style={({ pressed }) => [styles.dailyCard, pressed && { borderColor: role.accent }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Eyebrow>Daily · puzzle #{puzzleNumber()}</Eyebrow>
        <Text style={styles.dailyTitle}>{done ? 'Today: done' : "Play today's code"}</Text>
        <Text style={styles.dailySub}>
          {done
            ? (today.solved
              ? `Solved in ${today.attempts}. Come back tomorrow.`
              : 'Not solved today. Try again tomorrow.')
            : `One code, everyone, ${MAX_ATTEMPTS} attempts.`}
        </Text>
      </View>
      {streak > 0 && <Text style={styles.dailyStreak}>🔥 {streak}</Text>}
    </Pressable>
  );
}

export function RulesScreen({ go }) {
  const rules = [
    ['Four digits', ', drawn from 1 to 9.'],
    ['No zero and no repeats', ' — in codes or in guesses. Every digit counts exactly once, which keeps the two scores unambiguous.'],
    ['Value', ' counts the digits you named that appear anywhere in their code.'],
    ['Position', ' counts how many of those landed in the right slot. Position is never higher than Value.'],
    ['Both players always finish the round', ' — so going first is an advantage, not a win, and matching a crack in the same round is a draw.'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Eyebrow>How to play</Eyebrow>
      <Text style={type.heading}>Two codes, one race</Text>
      <Text style={type.muted}>
        Each player picks a secret code. Then you alternate guesses at each other&apos;s.
        A guess is never answered with which digits were right — only with how many.
      </Text>

      <View style={{ gap: space.sm }}>
        {rules.map(([lead, rest], i) => (
          <View key={i} style={styles.rule}>
            <Text style={styles.ruleMark}>—</Text>
            <Text style={styles.ruleText}>
              <Text style={{ color: color.text, fontFamily: font.displayBold }}>{lead}</Text>
              {rest}
            </Text>
          </View>
        ))}
      </View>

      <Panel style={{ backgroundColor: color.sunken, gap: space.sm }}>
        <Eyebrow>Worked example</Eyebrow>
        <Text style={type.muted}>Their secret code is 4 7 1 9. You guess 1 7 3 2.</Text>
        <LedgerRow index={1} guess="1732" value={2} position={1} />
        <Text style={type.muted}>
          Value 2 — the 1 and the 7 are both in their code. Position 1 — only the 7 is in
          the right slot. The 3 and the 2 are not in the code at all.
        </Text>
      </Panel>

      <Text style={type.heading}>Reading the ledger</Text>
      <Text style={type.muted}>
        Each attempt shows the same score twice: as pips and as numbers. A green pip is a
        digit in the right slot, an amber pip is a digit in the wrong slot, and a hollow
        pip is a digit that is not in the code at all.
      </Text>

      <Button label="Back to the menu" variant="primary" onPress={() => go('menu')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  keyword: { gap: space.md, marginTop: space.sm },
  keywordRow: { gap: 2 },
  keywordHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  keywordLead: {
    fontFamily: font.monoBold,
    fontSize: 26,
    color: color.text,
    borderBottomWidth: 2,
    borderBottomColor: color.text,
    paddingHorizontal: 2,
  },
  keywordRest: {
    fontFamily: font.mono,
    fontSize: size.large,
    letterSpacing: 3,
    color: color.text,
  },
  keywordGloss: { ...type.muted, marginLeft: 2 },
  lede: { ...type.body, color: color.muted, fontSize: size.large, lineHeight: 26 },
  mode: {
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 6,
  },
  modeTiles: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  modeTile: {
    width: 10,
    height: 14,
    borderRadius: 2,
    backgroundColor: color.lineStrong,
  },
  modeName: { fontFamily: font.displayBold, fontSize: size.xl, color: color.text, letterSpacing: -0.5 },
  modeDesc: { ...type.muted },
  statline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  stat: { fontFamily: font.mono, fontSize: size.small, color: color.muted },
  footerRow: { flexDirection: 'row', gap: space.sm },
  toggles: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.lineStrong,
  },
  toggleOn: { borderStyle: 'solid', borderColor: color.purple700 },
  toggleText: { fontFamily: font.mono, fontSize: size.small, color: color.faint },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.lg,
  },
  creditText: { fontFamily: font.display, fontSize: size.small, color: color.faint },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.purple900,
    borderWidth: 1,
    borderColor: color.purple700,
    borderRadius: radius.lg,
  },
  dailyTitle: { fontFamily: font.displayBold, fontSize: size.xl, color: color.text, letterSpacing: -0.5 },
  dailySub: { fontFamily: font.display, fontSize: size.small, color: color.muted },
  dailyStreak: { fontFamily: font.mono, fontSize: size.large, color: color.amber300 },
  warnBlock: {
    backgroundColor: color.amber900,
    borderWidth: 1,
    borderColor: color.amber700,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
    marginTop: space.md,
  },
  warnTitle: { fontFamily: font.displayBold, fontSize: size.small, color: color.amber300 },
  warnText: { fontFamily: font.display, fontSize: size.small, color: color.amber300 },
  rule: { flexDirection: 'row', gap: space.sm },
  ruleMark: { fontFamily: font.mono, color: role.accent, width: 14 },
  ruleText: { ...type.muted, flex: 1 },
});
