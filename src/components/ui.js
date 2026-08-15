/**
 * Shared primitives. Everything touchable routes through Button so the feedback
 * cue (sound + haptics) fires in exactly one place rather than at every call
 * site, where it would eventually be forgotten.
 */

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { color, role, font, size, space, radius, type } from '../theme.js';
import * as sfx from '../adapters/sfx.js';

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled = false,
  cue = 'tap',
  style,
  children,
}) {
  const tone = {
    default: { bg: color.raised, fg: color.text, border: color.lineStrong },
    primary: { bg: role.accent, fg: '#12030F', border: color.purple400 },
    ghost: { bg: 'transparent', fg: color.text, border: color.line },
    quiet: { bg: 'transparent', fg: color.muted, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (cue) sfx.play(cue);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.bg,
          borderColor: pressed ? color.purple700 : tone.border,
          opacity: disabled ? 0.4 : 1,
          transform: [{ translateY: pressed && !disabled ? 1 : 0 }],
        },
        variant === 'quiet' && styles.buttonQuiet,
        style,
      ]}
    >
      {children ?? (
        <Text
          numberOfLines={1}
          style={[
            styles.buttonLabel,
            {
              color: tone.fg,
              fontFamily: variant === 'primary' ? font.displayBold : font.display,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral', onPress }) {
  const tones = {
    neutral: { border: color.lineStrong, fg: color.muted, bg: 'transparent' },
    warn: { border: color.amber700, fg: color.amber300, bg: color.amber900 },
    action: { border: color.purple700, fg: color.purple300, bg: color.purple900 },
    live: { border: role.accent, fg: color.purple300, bg: color.purple900 },
  }[tone];

  const content = (
    <View style={[styles.pill, { borderColor: tones.border, backgroundColor: tones.bg }]}>
      <Text style={[styles.pillText, { color: tones.fg }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { sfx.play('tap'); onPress(); }}>{content}</Pressable>
  );
}

export function Panel({ children, style, active = false }) {
  return (
    <View
      style={[
        styles.panel,
        active && { borderColor: color.purple700 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Eyebrow({ children, style }) {
  return <Text style={[type.eyebrow, style]}>{children}</Text>;
}

export function Alert({ children }) {
  if (!children) return null;
  return (
    <View style={styles.alert}>
      <Text style={styles.alertText}>{children}</Text>
    </View>
  );
}

/** The four-square mark, drawn with plain Views — no SVG dependency needed. */
export function Mark({ size: s = 22 }) {
  const cell = (s - 3) / 2;
  const box = (bg, border) => ({
    width: cell,
    height: cell,
    borderRadius: 3,
    backgroundColor: bg,
    borderWidth: border ? 1.4 : 0,
    borderColor: border,
  });
  return (
    <View style={{ width: s, height: s, gap: 3 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={box(role.accent)} />
        <View style={box('transparent', color.lineStrong)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={box(role.value)} />
        <View style={box(role.position)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonQuiet: { minHeight: 38, paddingHorizontal: 10 },
  buttonLabel: { fontSize: size.base, letterSpacing: -0.2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: font.mono,
    fontSize: size.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.md,
  },
  alert: {
    borderWidth: 1,
    borderColor: color.amber700,
    backgroundColor: color.amber900,
    borderRadius: radius.md,
    padding: space.sm + 2,
  },
  alertText: {
    fontFamily: font.display,
    fontSize: size.small,
    color: color.amber300,
    lineHeight: 19,
  },
});
