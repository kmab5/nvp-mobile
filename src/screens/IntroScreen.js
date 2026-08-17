/**
 * First-launch intro.
 *
 * NVP is hard to explain and easy to demonstrate: the moment a guess comes back
 * as "Value 2, Position 1" against a code you can see, the whole game clicks.
 * So the last step isn't more text — it's a real guess, scored by the real
 * engine, against a code shown on screen. Nothing is faked.
 *
 * Skippable from any step, and replayable later from the menu.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { color, role, font, size, space, radius, type } from '../theme.js';
import { Button, Eyebrow, Mark, Panel } from '../components/ui.js';
import { LedgerRow } from '../components/Ledger.js';
import { CodePad } from '../components/CodePad.js';
import { evaluate, CODE_LENGTH } from '../../core/engine.js';
import * as prefs from '../adapters/prefs.js';
import * as sfx from '../adapters/sfx.js';

// Shown openly during the demo — the point is to watch the scoring work, not to
// solve anything yet.
const DEMO_SECRET = '4719';

export function IntroScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [tries, setTries] = useState([]);
  const [padKey, setPadKey] = useState(0);

  const finish = () => {
    prefs.set('onboarded', true);
    onDone();
  };

  const steps = [
    {
      key: 'what',
      render: () => (
        <View style={styles.stepBody}>
          <Mark size={64} />
          <Text style={type.title}>Two codes, one race</Text>
          <Text style={styles.lede}>
            You and your opponent each hide a secret four-digit code. You take turns
            guessing at each other&apos;s. First to read the other&apos;s code wins.
          </Text>
          <Panel style={styles.rulesPanel}>
            <Rule text="Four digits, 1 to 9" />
            <Rule text="No zero, and no repeated digits" />
            <Rule text="You never learn which digits were right — only how many" />
          </Panel>
        </View>
      ),
    },
    {
      key: 'scoring',
      render: () => (
        <View style={styles.stepBody}>
          <Eyebrow>The only two numbers</Eyebrow>
          <Text style={type.title}>Value and Position</Text>

          <View style={styles.defs}>
            <View style={styles.def}>
              <View style={[styles.swatch, { backgroundColor: role.value }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.defTitle, { color: role.value }]}>Value</Text>
                <Text style={type.muted}>
                  How many of your digits appear anywhere in their code.
                </Text>
              </View>
            </View>
            <View style={styles.def}>
              <View style={[styles.swatch, { backgroundColor: role.position }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.defTitle, { color: role.position }]}>Position</Text>
                <Text style={type.muted}>
                  How many of those are also in the right slot. Never higher than Value.
                </Text>
              </View>
            </View>
          </View>

          <Panel style={{ gap: space.sm, width: '100%' }}>
            <Eyebrow>If their code is 4 7 1 9</Eyebrow>
            <LedgerRow index={1} guess="1732" value={2} position={1} />
            <Text style={type.muted}>
              The 1 and the 7 are both in the code, so Value is 2. Only the 7 is in the
              right slot, so Position is 1.
            </Text>
          </Panel>
        </View>
      ),
    },
    {
      key: 'pips',
      render: () => (
        <View style={styles.stepBody}>
          <Eyebrow>Reading the board</Eyebrow>
          <Text style={type.title}>Same score, two ways</Text>
          <Text style={styles.lede}>
            Every attempt shows its score as dots and as numbers, so you can read a board
            at a glance or work it out precisely.
          </Text>

          <Panel style={{ gap: space.sm, width: '100%' }}>
            <LedgerRow index={1} guess="1732" value={2} position={1} />
            <LedgerRow index={2} guess="4712" value={3} position={3} />
            <LedgerRow index={3} guess="4719" value={4} position={4} />
          </Panel>

          <View style={styles.legend}>
            <LegendDot color={role.position} label="Right digit, right slot" />
            <LegendDot color={role.value} label="Right digit, wrong slot" />
            <LegendDot color={null} label="Not in the code" />
          </View>
        </View>
      ),
    },
    {
      key: 'try',
      render: () => {
        const solved = tries.some((t) => t.position === CODE_LENGTH);
        return (
          <View style={styles.stepBody}>
            <Eyebrow>Your turn</Eyebrow>
            <Text style={type.title}>Try one</Text>
            <Text style={styles.lede}>
              The code is{' '}
              <Text style={styles.demoCode}>{DEMO_SECRET.split('').join(' ')}</Text> — you
              can see it this once. Guess anything and watch how it&apos;s scored.
            </Text>

            {tries.length > 0 && (
              <Panel style={{ width: '100%', gap: 2 }}>
                {tries.map((t, i) => (
                  <LedgerRow key={i} index={i + 1} {...t} />
                ))}
              </Panel>
            )}

            {solved ? (
              <Text style={styles.solved}>That&apos;s a crack — all four in place.</Text>
            ) : (
              <CodePad
                submitLabel="Score it"
                resetKey={padKey}
                onSubmit={(code) => {
                  const score = evaluate(DEMO_SECRET, code);
                  sfx.play(score.position === CODE_LENGTH ? 'crack' : 'submit');
                  setTries((current) => [...current, { guess: code, ...score }]);
                  setPadKey((k) => k + 1);
                }}
              />
            )}
          </View>
        );
      },
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>{current.render()}</ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((s, i) => (
            <Pressable
              key={s.key}
              onPress={() => setStep(i)}
              accessibilityLabel={`Step ${i + 1} of ${steps.length}`}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={last ? 'Skip' : 'Skip intro'}
            variant="quiet"
            onPress={finish}
            style={{ flex: 1 }}
          />
          <Button
            label={last ? 'Start playing' : 'Next'}
            variant="primary"
            style={{ flex: 2 }}
            onPress={() => (last ? finish() : setStep(step + 1))}
          />
        </View>
      </View>
    </View>
  );
}

function Rule({ text }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleMark}>—</Text>
      <Text style={[type.muted, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

function LegendDot({ color: dot, label }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          dot ? { backgroundColor: dot, borderColor: dot } : { borderColor: color.lineStrong },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, paddingBottom: space.lg, flexGrow: 1, justifyContent: 'center' },
  stepBody: { gap: space.md, alignItems: 'center' },
  lede: { ...type.body, color: color.muted, textAlign: 'center', fontSize: size.large, lineHeight: 25 },
  rulesPanel: { width: '100%', gap: space.sm },
  rule: { flexDirection: 'row', gap: space.sm },
  ruleMark: { fontFamily: font.mono, color: role.accent, width: 14 },
  defs: { width: '100%', gap: space.md },
  def: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  swatch: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  defTitle: { fontFamily: font.displayBold, fontSize: size.large },
  legend: { width: '100%', gap: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText: { ...type.muted },
  demoCode: { fontFamily: font.monoBold, color: color.text, letterSpacing: 2 },
  solved: {
    fontFamily: font.displayBold,
    fontSize: size.large,
    color: role.position,
    textAlign: 'center',
  },
  footer: {
    padding: space.lg,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.lineStrong,
  },
  dotActive: { backgroundColor: role.accent, width: 22 },
  actions: { flexDirection: 'row', gap: space.sm },
});
