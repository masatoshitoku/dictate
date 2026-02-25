/**
 * Text processing utilities for Japanese transcription.
 * Extracted as a pure module for testability.
 */

const JP_TO_JP_SPACE = /([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g;
const JP_TO_ASCII_SPACE = /([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([a-zA-Z0-9])/g;
const ASCII_TO_JP_SPACE = /([a-zA-Z0-9])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g;
const FULLWIDTH_SPACE = /\u3000/g;

/**
 * Remove unnecessary spaces from Japanese text.
 * - Spaces between Japanese characters
 * - Spaces between Japanese and ASCII characters
 * - Full-width spaces (ideographic space U+3000)
 */
const MAX_ITERATIONS = 100;

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
