/**
 * The ledger — the signature surface of the game.
 *
 * Each attempt reads left to right: attempt number, the code, then the score
 * twice over. The pips give the shape of the answer at a glance (green = right
 * slot, amber = right digit wrong slot, hollow = not in the code) and the chips
 * give the exact numbers you reason with. Same information, two speeds.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { CODE_LENGTH, DIGITS } from '../../core/engine.js';
import { color, role, font, size, space, radius } from '../theme.js';
import * as sfx from '../adapters/sfx.js';

export function LedgerRow({ index, guess, value, position }) {
  const cracked = position === CODE_LENGTH;
  return (
    <View
      accessibilityLabel={
        `Attempt ${index}: ${guess.split('').join(' ')}. `
        + `Value ${value}, position ${position}.${cracked ? ' Code cracked.' : ''}`
      }
      style={[styles.row, cracked && styles.rowCracked]}
    >
      <Text style={styles.rowNumber}>{String(index).padStart(2, '0')}</Text>

      <View style={styles.rowCode}>
        {guess.split('').map((digit, i) => (
          <View key={i} style={styles.digit}>
            <Text style={styles.digitText}>{digit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.pips}>
        {Array.from({ length: position }, (_, i) => (
          <View key={`p${i}`} style={[styles.pip, styles.pipPosition]} />
        ))}
        {Array.from({ length: value - position }, (_, i) => (
          <View key={`v${i}`} style={[styles.pip, styles.pipValue]} />
        ))}
        {Array.from({ length: CODE_LENGTH - value }, (_, i) => (
          <View key={`e${i}`} style={styles.pip} />
        ))}
      </View>

      <View style={styles.chips}>
        <View style={[styles.chip, { borderColor: color.amber700 }]}>
          <Text style={[styles.chipText, { color: role.value }]}>V{value}</Text>
        </View>
        <View style={[styles.chip, { borderColor: color.green700 }]}>
          <Text style={[styles.chipText, { color: role.position }]}>P{position}</Text>
        </View>
      </View>
    </View>
  );
}

export function Ledger({ guesses, empty = 'No attempts yet.' }) {
  if (!guesses.length) {
    return <Text style={styles.empty}>{empty}</Text>;
  }
  return (
    <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 2 }}>
      {guesses.map((turn, i) => (
        <LedgerRow key={`${turn.guess}-${i}`} index={i + 1} {...turn} />
      ))}
    </ScrollView>
  );
}

const CYCLE = { unknown: 'maybe', maybe: 'in', in: 'out', out: 'unknown' };
const LABEL = {
  unknown: 'unmarked',
  maybe: 'marked as maybe',
  in: 'marked as in the code',
  out: 'marked as ruled out',
};

/**
 * A scratchpad for the player's own deductions. Purely local — never sent
 * anywhere, and cleared between matches. The keypad picks up the same marks so
 * the notes follow you into the next guess.
 */
export function Notes({ marks, onChange }) {
  return (
    <View style={styles.notes}>
      <View style={styles.notesHead}>
        <Text style={styles.notesTitle}>Your notes</Text>
        <Pressable
          onPress={() => {
            sfx.play('back');
            onChange({});
          }}
        >
          <Text style={styles.notesClear}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.notesRow}>
        {DIGITS.split('').map((digit) => {
          const state = marks[digit] || 'unknown';
          return (
            <Pressable
              key={digit}
              accessibilityLabel={`Digit ${digit}, ${LABEL[state]}`}
              onPress={() => {
                sfx.play('tap');
                const next = { ...marks, [digit]: CYCLE[state] };
                if (next[digit] === 'unknown') delete next[digit];
                onChange(next);
              }}
              style={[
                styles.noteBtn,
                state === 'in' && { borderColor: role.position, backgroundColor: role.positionDim },
                state === 'maybe' && { borderColor: role.value, backgroundColor: role.valueDim },
                state === 'out' && { borderStyle: 'dashed' },
              ]}
            >
              <Text
                style={[
                  styles.noteText,
                  state === 'in' && { color: role.position },
                  state === 'maybe' && { color: role.value },
                  state === 'out' && { color: color.faint, textDecorationLine: 'line-through' },
                ]}
              >
                {digit}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.notesHint}>Tap to cycle: maybe, in, out. Only you see this.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  rowCracked: { backgroundColor: role.positionDim },
  rowNumber: {
    fontFamily: font.mono,
    fontSize: size.micro,
    color: color.faint,
    width: 20,
  },
  rowCode: { flexDirection: 'row', gap: 3 },
  digit: {
    width: 26,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: { fontFamily: font.monoBold, fontSize: size.base, color: color.text },
  pips: { flexDirection: 'row', gap: 3, flex: 1, marginLeft: 4 },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.lineStrong,
  },
  pipPosition: { backgroundColor: role.position, borderColor: role.position },
  pipValue: { backgroundColor: role.value, borderColor: role.value },
  chips: { flexDirection: 'row', gap: 4 },
  chip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: { fontFamily: font.monoBold, fontSize: size.micro },
  empty: {
    fontFamily: font.mono,
    fontSize: size.small,
    color: color.faint,
    paddingVertical: space.md,
  },
  notes: {
    backgroundColor: color.sunken,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  notesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesTitle: {
    fontFamily: font.mono,
    fontSize: size.micro,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: color.muted,
  },
  notesClear: { fontFamily: font.display, fontSize: size.small, color: color.muted },
  notesRow: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  noteBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: { fontFamily: font.monoBold, fontSize: size.small, color: color.text },
  notesHint: { fontFamily: font.display, fontSize: size.small, color: color.muted },
});
