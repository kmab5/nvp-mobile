/**
 * Code entry.
 *
 * The pad is the only way in, so the rules are enforced by the interface rather
 * than by an error message: zero isn't on the keypad, and a digit already placed
 * goes dead until you take it back. Same design as the web build — but here the
 * keypad is the whole input story, since there's no physical keyboard to fall
 * back on, which makes the touch targets load-bearing rather than a convenience.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CODE_LENGTH, DIGITS, randomCode } from '../../core/engine.js';
import { color, role, font, size, space, radius } from '../theme.js';
import { Button } from './ui.js';
import * as sfx from '../adapters/sfx.js';

export function CodePad({
  onSubmit,
  masked = false,
  allowRandom = false,
  submitLabel = 'Submit guess',
  disabled = false,
  noteStates = {},
  resetKey = 0,
}) {
  const [entry, setEntry] = useState('');
  const [revealed, setRevealed] = useState(!masked);

  // Clearing between turns is driven by the parent bumping resetKey.
  React.useEffect(() => {
    setEntry('');
    setRevealed(!masked);
  }, [resetKey, masked]);

  const push = useCallback((digit) => {
    if (disabled) return;
    setEntry((current) => {
      if (current.length >= CODE_LENGTH || current.includes(digit)) return current;
      sfx.play('tap');
      return current + digit;
    });
  }, [disabled]);

  const back = useCallback(() => {
    if (disabled) return;
    setEntry((current) => {
      if (!current) return current;
      sfx.play('back');
      return current.slice(0, -1);
    });
  }, [disabled]);

  const complete = entry.length === CODE_LENGTH;

  return (
    <View style={styles.pad}>
      <View style={styles.tiles}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const filled = i < entry.length;
          const cursor = !disabled && i === entry.length;
          return (
            <View
              key={i}
              style={[
                styles.tile,
                filled && styles.tileFilled,
                cursor && styles.tileCursor,
              ]}
            >
              <Text style={[styles.tileText, !filled && { color: color.faint }]}>
                {filled ? (revealed ? entry[i] : '•') : '·'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.keys}>
        {DIGITS.split('').map((digit) => {
          const used = entry.includes(digit);
          const full = entry.length >= CODE_LENGTH;
          const off = disabled || used || full;
          const note = noteStates[digit];
          return (
            <Pressable
              key={digit}
              disabled={off}
              onPress={() => push(digit)}
              accessibilityLabel={`Digit ${digit}`}
              style={({ pressed }) => [
                styles.key,
                note === 'in' && { borderColor: role.position },
                note === 'maybe' && { borderColor: role.value },
                note === 'out' && { borderStyle: 'dashed' },
                pressed && !off && { backgroundColor: color.purple900 },
                off && { opacity: 0.25 },
              ]}
            >
              <Text
                style={[
                  styles.keyText,
                  note === 'in' && { color: role.position },
                  note === 'maybe' && { color: role.value },
                  note === 'out' && { color: color.faint },
                ]}
              >
                {digit}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tools}>
        <Button
          label="⌫"
          variant="ghost"
          cue={null}
          disabled={disabled || !entry}
          onPress={back}
          style={{ flex: 1 }}
        />
        {masked && (
          <Button
            label={revealed ? 'Hide' : 'Show'}
            variant="ghost"
            disabled={disabled || !entry}
            onPress={() => setRevealed((r) => !r)}
            style={{ flex: 1 }}
          />
        )}
        {allowRandom && (
          <Button
            label="Random"
            variant="ghost"
            disabled={disabled}
            onPress={() => setEntry(randomCode())}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <Button
        label={submitLabel}
        variant="primary"
        cue={null}
        disabled={disabled || !complete}
        onPress={() => onSubmit(entry)}
        style={{ width: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: space.md, width: '100%' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    width: 54,
    height: 66,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFilled: { borderColor: color.purple700, backgroundColor: color.raised },
  tileCursor: { borderColor: role.accent },
  tileText: { fontFamily: font.monoBold, fontSize: 28, color: color.text },
  keys: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    maxWidth: 260,
  },
  key: {
    width: 78,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: font.monoBold, fontSize: size.large, color: color.text },
  tools: { flexDirection: 'row', gap: space.sm, maxWidth: 260, width: '100%' },
});
