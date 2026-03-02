/**
 * Text processing utilities for Japanese transcription.
 * Extracted as a pure module for testability.
 */

// Unicode range for Japanese characters (CJK + fullwidth + kana + punctuation)
const JP = '[\\u3000-\\u303F\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF\\uFF00-\\uFFEF]';
// Match only spaces and tabs — NOT newlines (\n, \r) to preserve line breaks in transcriptions
const SP = '[ \\t]+';

const JP_TO_JP_SPACE = new RegExp(`(${JP})${SP}(${JP})`, 'g');
const JP_TO_ASCII_SPACE = new RegExp(`(${JP})${SP}([a-zA-Z0-9])`, 'g');
const ASCII_TO_JP_SPACE = new RegExp(`([a-zA-Z0-9])${SP}(${JP})`, 'g');
const FULLWIDTH_SPACE = /\u3000/g;

/**
 * Remove unnecessary spaces from Japanese text.
 * - Spaces between Japanese characters
 * - Spaces between Japanese and ASCII characters
 * - Full-width spaces (ideographic space U+3000)
 */
const MAX_ITERATIONS = 100;

// Japanese sentence-ending punctuation (used for fuzzy matching)
const SENTENCE_PUNCT = /[。、！？!?,.\s]/g;
const isPunct = (ch: string): boolean => '。、！？!?,. \t\n\r'.includes(ch);

/**
 * Strip Japanese sentence punctuation for content-only comparison.
 */
function stripPunct(text: string): string {
  return text.replace(SENTENCE_PUNCT, '');
}

/**
 * Check if two texts have the same content ignoring punctuation differences.
 */
export function contentEquals(a: string, b: string): boolean {
  return stripPunct(a) === stripPunct(b);
}

/**
 * Compute the delta (new text) between previously typed text and new transcription.
 * Supports fuzzy prefix matching that tolerates punctuation differences
 * (e.g., Deepgram missing 。 that Gemini adds).
 *
 * Returns the new text to append, or empty string if no new content.
 */
export function computeDelta(previousText: string, newText: string): string {
  if (!newText) return '';
  if (!previousText) return newText;

  // Fast path: exact prefix match
  if (newText.startsWith(previousText)) {
    return newText.slice(previousText.length);
  }

  // Fuzzy match: strip punctuation and compare content
  const contentPrev = stripPunct(previousText);
  const contentNew = stripPunct(newText);

  if (contentNew === contentPrev) {
    // Same content, just different punctuation — no new text to append
    return '';
  }

  if (!contentNew.startsWith(contentPrev)) {
    // Content differs beyond punctuation — can't safely compute delta
    return '';
  }

  // contentNew starts with contentPrev — Gemini found new content.
  // Walk through newText to find where the previously-typed content ends.
  let matchIdx = 0;  // progress through contentPrev
  let scanIdx = 0;   // progress through newText

  while (matchIdx < contentPrev.length && scanIdx < newText.length) {
    if (isPunct(newText[scanIdx])) {
      scanIdx++;
      continue;
    }
    if (newText[scanIdx] === contentPrev[matchIdx]) {
      matchIdx++;
      scanIdx++;
    } else {
      return ''; // unexpected character mismatch
    }
  }

  if (matchIdx < contentPrev.length) {
    return ''; // couldn't consume all matched content
  }

  // scanIdx points right after the last matched content character.
  // Return everything after — includes punctuation and new content from Gemini.
  return newText.slice(scanIdx);
}

export function removeJapaneseSpaces(text: string): string {
  let result = text;
  let prev = '';
  let iterations = 0;

  // Repeat until no more changes (handles consecutive spaces)
  while (result !== prev && iterations < MAX_ITERATIONS) {
    prev = result;
    result = result.replace(JP_TO_JP_SPACE, '$1$2');
    result = result.replace(JP_TO_ASCII_SPACE, '$1$2');
    result = result.replace(ASCII_TO_JP_SPACE, '$1$2');
    iterations++;
  }

  result = result.replace(FULLWIDTH_SPACE, '');

  return result;
}
