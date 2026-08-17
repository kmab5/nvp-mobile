/**
 * Error boundary.
 *
 * The default failure mode for a React Native app is a blank screen and a
 * stack trace you can only see if a debugger happens to be attached. This
 * catches render errors and puts the message on screen, along with any native
 * modules that failed to load — which is almost always the real cause.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { color, font, size, space, radius } from '../theme.js';
import { nativeWarnings } from '../adapters/native.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.error('[nvp] render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <DiagnosticScreen
        title="Something broke"
        message={String(this.state.error?.message || this.state.error)}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

export function DiagnosticScreen({ title, message, onRetry }) {
  const warnings = nativeWarnings();
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {warnings.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Native modules that did not load</Text>
          {warnings.map((warning, i) => (
            <Text key={i} style={styles.warning}>• {warning}</Text>
          ))}
          <Text style={styles.hint}>
            This usually means the dev build is older than the dependency list. Rebuild
            with{'\n'}
            <Text style={styles.code}>npx expo run:android</Text>
          </Text>
        </View>
      )}

      {onRetry && (
        <Text onPress={onRetry} style={styles.retry}>Tap to retry</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
    backgroundColor: color.bg,
  },
  // No custom fonts here on purpose: this screen has to render even when font
  // loading is what failed.
  title: { fontSize: 24, fontWeight: '700', color: color.amber500 },
  message: { fontSize: 15, color: color.text, lineHeight: 22 },
  block: {
    backgroundColor: color.panel,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  blockTitle: { fontSize: 13, color: color.muted, textTransform: 'uppercase', letterSpacing: 1.5 },
  warning: { fontSize: 13, color: color.amber300 },
  hint: { fontSize: 13, color: color.muted, lineHeight: 20 },
  code: { color: color.purple300 },
  retry: {
    fontSize: 15,
    color: color.purple300,
    paddingVertical: space.md,
    textAlign: 'center',
  },
});
