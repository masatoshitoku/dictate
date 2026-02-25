/**
 * Waveform visualization constants and pure computation functions.
 * Extracted for testability and reuse across renderer components.
 */

/** Bell curve weights for center-emphasized waveform bars */
export const BELL_CURVE = [0.35, 0.62, 0.85, 1.0, 0.85, 0.62, 0.35] as const;

/** Number of bars — derived from BELL_CURVE to guarantee consistency */
export const BAR_COUNT = BELL_CURVE.length;

export const WAVEFORM_MAX_HEIGHT_PX = 28;
export const WAVEFORM_MIN_HEIGHT_SCALE = 10;
export const DEFAULT_AUDIO_LEVEL = 0.2;
export const AUDIO_LEVEL_FLOOR = 0.15;

/** Pre-computed initial audio levels (avoids recreating at multiple call sites) */
export const INITIAL_AUDIO_LEVELS: readonly number[] = Object.freeze(
  Array(BAR_COUNT).fill(DEFAULT_AUDIO_LEVEL) as number[]
);

/**
 * Compute the pixel height for a single waveform bar.
 */
export function computeBarHeight(level: number, bellWeight: number): number {
  const minH = bellWeight * WAVEFORM_MIN_HEIGHT_SCALE;
  return Math.max(minH, level * WAVEFORM_MAX_HEIGHT_PX * bellWeight);
}

/**
 * Compute audio levels from frequency data.
 * Maps frequency bins to the given number of bars, applying a floor.
 */
export function computeAudioLevels(dataArray: Uint8Array, barCount: number): number[] {
  const levels = new Array<number>(barCount);
  const len = dataArray.length;
  if (len === 0) {
    levels.fill(AUDIO_LEVEL_FLOOR);
    return levels;
  }
  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor((i / barCount) * len);
    levels[i] = Math.max(AUDIO_LEVEL_FLOOR, dataArray[idx] / 255);
  }
  return levels;
}

/**
 * Compute audio levels in-place into a pre-allocated output array.
 * Avoids per-frame allocation in rAF hot paths.
 */
export function computeAudioLevelsInto(dataArray: Uint8Array, barCount: number, out: number[]): void {
  const len = dataArray.length;
  if (len === 0) {
    for (let i = 0; i < barCount; i++) {
      out[i] = AUDIO_LEVEL_FLOOR;
    }
    return;
  }
  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor((i / barCount) * len);
    out[i] = Math.max(AUDIO_LEVEL_FLOOR, dataArray[idx] / 255);
  }
}
