import { describe, it, expect } from 'vitest';
import {
  BELL_CURVE,
  BAR_COUNT,
  INITIAL_AUDIO_LEVELS,
  DEFAULT_AUDIO_LEVEL,
  AUDIO_LEVEL_FLOOR,
  WAVEFORM_MAX_HEIGHT_PX,
  WAVEFORM_MIN_HEIGHT_SCALE,
  computeBarHeight,
  computeAudioLevels,
  computeAudioLevelsInto,
} from '../shared/waveform';

describe('waveform constants', () => {
  it('BAR_COUNT equals BELL_CURVE.length', () => {
    expect(BAR_COUNT).toBe(BELL_CURVE.length);
  });

  it('INITIAL_AUDIO_LEVELS has correct length and values', () => {
    expect(INITIAL_AUDIO_LEVELS).toHaveLength(BAR_COUNT);
    expect(INITIAL_AUDIO_LEVELS.every(v => v === DEFAULT_AUDIO_LEVEL)).toBe(true);
  });

  it('INITIAL_AUDIO_LEVELS is frozen (immutable)', () => {
    expect(Object.isFrozen(INITIAL_AUDIO_LEVELS)).toBe(true);
  });

  it('BELL_CURVE is symmetric', () => {
    for (let i = 0; i < Math.floor(BAR_COUNT / 2); i++) {
      expect(BELL_CURVE[i]).toBe(BELL_CURVE[BAR_COUNT - 1 - i]);
    }
  });

  it('BELL_CURVE peak is at center', () => {
    const center = Math.floor(BAR_COUNT / 2);
    expect(BELL_CURVE[center]).toBe(1.0);
  });
});

describe('computeBarHeight', () => {
  it('returns minimum height for zero level', () => {
    const height = computeBarHeight(0, 0.5);
    expect(height).toBe(0.5 * WAVEFORM_MIN_HEIGHT_SCALE);
  });

  it('returns full height for max level and center bell weight', () => {
    const height = computeBarHeight(1.0, 1.0);
    expect(height).toBe(WAVEFORM_MAX_HEIGHT_PX);
  });

  it('respects minimum height floor for small levels', () => {
    const bellWeight = 0.85;
    const height = computeBarHeight(0.01, bellWeight);
    expect(height).toBeGreaterThanOrEqual(bellWeight * WAVEFORM_MIN_HEIGHT_SCALE);
  });

  it('scales linearly with level', () => {
    const h1 = computeBarHeight(0.5, 1.0);
    const h2 = computeBarHeight(1.0, 1.0);
    expect(h2).toBeCloseTo(h1 * 2, 5);
  });

  it('scales linearly with bell weight (above minimum)', () => {
    const h1 = computeBarHeight(1.0, 0.5);
    const h2 = computeBarHeight(1.0, 1.0);
    expect(h2).toBeCloseTo(h1 * 2, 5);
  });

  it('returns zero when both level and bellWeight are zero', () => {
    expect(computeBarHeight(0, 0)).toBe(0);
  });
});

describe('computeAudioLevels', () => {
  it('returns correct number of bars', () => {
    const data = new Uint8Array([100, 150, 200, 128, 64, 32, 80, 120, 90, 110, 140, 170, 200, 50, 100, 130]);
    const levels = computeAudioLevels(data, BAR_COUNT);
    expect(levels).toHaveLength(BAR_COUNT);
  });

  it('applies floor to silent data', () => {
    const data = new Uint8Array(16).fill(0);
    const levels = computeAudioLevels(data, BAR_COUNT);
    expect(levels.every(l => l >= AUDIO_LEVEL_FLOOR)).toBe(true);
    expect(levels.every(l => l === AUDIO_LEVEL_FLOOR)).toBe(true);
  });

  it('normalizes max volume to 1.0', () => {
    const data = new Uint8Array(16).fill(255);
    const levels = computeAudioLevels(data, BAR_COUNT);
    expect(levels.every(l => l === 1.0)).toBe(true);
  });

  it('handles single-element data array', () => {
    const data = new Uint8Array([128]);
    const levels = computeAudioLevels(data, 3);
    expect(levels).toHaveLength(3);
    expect(levels.every(l => l === 128 / 255)).toBe(true);
  });

  it('handles arbitrary bar count', () => {
    const data = new Uint8Array(8).fill(200);
    const levels = computeAudioLevels(data, 5);
    expect(levels).toHaveLength(5);
  });

  it('maps indices correctly for non-uniform data', () => {
    // 4 bins → 2 bars: bar 0 maps to idx 0, bar 1 maps to idx 2
    const data = new Uint8Array([255, 0, 128, 0]);
    const levels = computeAudioLevels(data, 2);
    expect(levels[0]).toBe(1.0); // 255/255
    expect(levels[1]).toBe(128 / 255); // 128/255
  });

  it('all values respect floor regardless of data', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const levels = computeAudioLevels(data, 4);
    expect(levels.every(l => l >= AUDIO_LEVEL_FLOOR)).toBe(true);
  });

  it('handles more bars than data bins', () => {
    const data = new Uint8Array([200, 100]);
    const levels = computeAudioLevels(data, 10);
    expect(levels).toHaveLength(10);
    // First 5 bars should map to idx 0 (200), rest to idx 1 (100)
    expect(levels[0]).toBe(200 / 255);
    expect(levels[9]).toBe(100 / 255);
  });

  it('returns floor values for empty dataArray', () => {
    const data = new Uint8Array(0);
    const levels = computeAudioLevels(data, BAR_COUNT);
    expect(levels).toHaveLength(BAR_COUNT);
    expect(levels.every(l => l === AUDIO_LEVEL_FLOOR)).toBe(true);
  });

  it('returns empty array for zero bar count', () => {
    const data = new Uint8Array([100, 200]);
    const levels = computeAudioLevels(data, 0);
    expect(levels).toHaveLength(0);
  });
});

describe('computeAudioLevelsInto', () => {
  it('writes results into pre-allocated output array', () => {
    const data = new Uint8Array(16).fill(200);
    const out = new Array(BAR_COUNT).fill(0);
    computeAudioLevelsInto(data, BAR_COUNT, out);
    expect(out.every(l => l === 200 / 255)).toBe(true);
  });

  it('produces same results as computeAudioLevels', () => {
    const data = new Uint8Array([100, 150, 200, 128, 64, 32, 80, 120]);
    const allocated = computeAudioLevels(data, BAR_COUNT);
    const out = new Array(BAR_COUNT).fill(0);
    computeAudioLevelsInto(data, BAR_COUNT, out);
    expect(out).toEqual(allocated);
  });

  it('applies floor to silent data', () => {
    const data = new Uint8Array(8).fill(0);
    const out = new Array(4).fill(0);
    computeAudioLevelsInto(data, 4, out);
    expect(out.every(l => l === AUDIO_LEVEL_FLOOR)).toBe(true);
  });

  it('overwrites previous values in output array', () => {
    const out = [999, 999, 999];
    const data = new Uint8Array([128, 128, 128]);
    computeAudioLevelsInto(data, 3, out);
    expect(out.every(l => l === 128 / 255)).toBe(true);
  });

  it('handles empty dataArray by filling with floor values', () => {
    const data = new Uint8Array(0);
    const out = new Array(BAR_COUNT).fill(999);
    computeAudioLevelsInto(data, BAR_COUNT, out);
    expect(out.every(l => l === AUDIO_LEVEL_FLOOR)).toBe(true);
  });
});
