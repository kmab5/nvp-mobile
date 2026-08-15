#!/usr/bin/env python3
"""
Generates the sound effects as WAV files.

The web build synthesises these live with WebAudio oscillators. React Native has
no WebAudio, so the same waveforms are rendered ahead of time here and bundled
as assets — same frequencies, same envelopes, same durations, so the app sounds
identical to the site.

    python3 scripts/gen-sounds.py

Each cue is a list of (frequency, duration, waveform, gain, delay, slide) voices,
transcribed from VOICES in the web repo's src/sfx.js.
"""

import math
import os
import struct
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")

# name -> [(freq, dur, wave, gain, delay, slide_hz)]
CUES = {
    "tap":    [(520, 0.05, "triangle", 0.35, 0.0, 0)],
    "back":   [(240, 0.06, "triangle", 0.30, 0.0, 0)],
    "submit": [(420, 0.08, "square", 0.26, 0.0, 0),
               (660, 0.10, "square", 0.22, 0.06, 0)],
    "reject": [(180, 0.16, "saw", 0.30, 0.0, -60)],
    "turn":   [(700, 0.07, "sine", 0.30, 0.0, 0)],
    "crack":  [(523, 0.16, "sine", 0.40, 0.000, 0),
               (659, 0.16, "sine", 0.40, 0.075, 0),
               (784, 0.16, "sine", 0.40, 0.150, 0),
               (1047, 0.16, "sine", 0.40, 0.225, 0)],
    "lose":   [(392, 0.22, "sine", 0.38, 0.00, 0),
               (330, 0.22, "sine", 0.38, 0.12, 0),
               (262, 0.22, "sine", 0.38, 0.24, 0)],
}


def sample(kind, phase):
    """One sample of the given waveform at phase in [0,1)."""
    if kind == "sine":
        return math.sin(2 * math.pi * phase)
    if kind == "square":
        return 1.0 if phase < 0.5 else -1.0
    if kind == "triangle":
        return 4 * abs(phase - 0.5) - 1
    if kind == "saw":
        return 2 * phase - 1
    raise ValueError(kind)


def render(voices):
    total = max(delay + dur for _, dur, _, _, delay, _ in voices) + 0.03
    frames = [0.0] * int(total * RATE)

    for freq, dur, kind, gain, delay, slide in voices:
        start = int(delay * RATE)
        length = int(dur * RATE)
        phase = 0.0
        for i in range(length):
            t = i / length
            # Matches the WebAudio envelope: a fast exponential attack, then a
            # decay to silence across the note.
            attack = min(1.0, i / max(1, int(0.012 * RATE)))
            envelope = attack * (0.0025 ** t)
            current = freq + slide * t
            phase = (phase + current / RATE) % 1.0
            index = start + i
            if index < len(frames):
                frames[index] += sample(kind, phase) * gain * envelope

    peak = max((abs(f) for f in frames), default=0.0)
    if peak > 1.0:
        frames = [f / peak for f in frames]
    return frames


os.makedirs(OUT, exist_ok=True)
for name, voices in CUES.items():
    frames = render(voices)
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, f)) * 32767)) for f in frames
        ))
    print(f"  {name}.wav  {len(frames) / RATE:.2f}s  {os.path.getsize(path) // 1024}kB")

print(f"\n{len(CUES)} cues written to assets/sounds/")
