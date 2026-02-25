import { describe, it, expect } from 'vitest';
import { removeJapaneseSpaces } from '../shared/text-processing';

describe('removeJapaneseSpaces', () => {
  it('removes spaces between kanji characters', () => {
    expect(removeJapaneseSpaces('東京 タワー')).toBe('東京タワー');
  });

  it('removes spaces between Japanese and ASCII', () => {
    expect(removeJapaneseSpaces('テスト abc テスト')).toBe('テストabcテスト');
  });

  it('removes spaces between ASCII and Japanese', () => {
    expect(removeJapaneseSpaces('abc テスト')).toBe('abcテスト');
  });

  it('removes full-width spaces', () => {
    expect(removeJapaneseSpaces('東京\u3000タワー')).toBe('東京タワー');
  });

  it('preserves spaces between ASCII-only characters', () => {
    expect(removeJapaneseSpaces('hello world')).toBe('hello world');
  });

  it('handles consecutive spaces between Japanese chars', () => {
    expect(removeJapaneseSpaces('東京  タワー')).toBe('東京タワー');
  });

  it('handles empty string', () => {
    expect(removeJapaneseSpaces('')).toBe('');
  });

  it('handles mixed Japanese-ASCII-Japanese', () => {
    expect(removeJapaneseSpaces('Hello 世界 test 東京 tower')).toBe('Hello世界test東京tower');
  });

  it('returns input unchanged when no spaces to remove', () => {
    expect(removeJapaneseSpaces('東京タワー')).toBe('東京タワー');
  });

  it('removes spaces between hiragana and katakana', () => {
    expect(removeJapaneseSpaces('ひらがな カタカナ')).toBe('ひらがなカタカナ');
  });

  it('removes spaces between katakana and kanji', () => {
    expect(removeJapaneseSpaces('カタカナ 漢字')).toBe('カタカナ漢字');
  });

  it('handles multiple full-width spaces', () => {
    expect(removeJapaneseSpaces('東京\u3000\u3000タワー')).toBe('東京タワー');
  });

  it('handles string with only spaces', () => {
    expect(removeJapaneseSpaces('   ')).toBe('   ');
  });

  it('handles numbers adjacent to Japanese', () => {
    expect(removeJapaneseSpaces('東京 123 タワー')).toBe('東京123タワー');
  });

  it('preserves newlines between Japanese characters', () => {
    expect(removeJapaneseSpaces('東京\nタワー')).toBe('東京\nタワー');
  });

  it('preserves newlines in multi-line transcription', () => {
    const input = '東京タワー\n大阪城\n京都寺';
    expect(removeJapaneseSpaces(input)).toBe(input);
  });

  it('removes tabs between Japanese characters', () => {
    expect(removeJapaneseSpaces('東京\tタワー')).toBe('東京タワー');
  });

  it('removes mixed spaces and tabs between Japanese', () => {
    expect(removeJapaneseSpaces('東京 \t タワー')).toBe('東京タワー');
  });

  it('preserves newlines while removing spaces on same line', () => {
    expect(removeJapaneseSpaces('東京 タワー\n大阪 城')).toBe('東京タワー\n大阪城');
  });

  it('handles fullwidth punctuation adjacent to Japanese', () => {
    expect(removeJapaneseSpaces('東京。 タワー')).toBe('東京。タワー');
  });

  // Boundary tests
  it('handles very long string without stack overflow', () => {
    const segment = '東京 タワー';
    const long = (segment + ' ').repeat(499) + segment; // no trailing space
    const result = removeJapaneseSpaces(long);
    expect(result).not.toContain(' ');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles CJK Extension B characters (surrogate pairs)', () => {
    // U+20000 is CJK Unified Ideograph Extension B — outside the regex range
    // Should not throw and should return input unchanged (spaces preserved)
    const input = 'test \uD840\uDC00 test';
    expect(() => removeJapaneseSpaces(input)).not.toThrow();
  });

  it('handles combining characters (dakuten)', () => {
    // が = U+304C (precomposed) — should be treated as Japanese
    expect(removeJapaneseSpaces('が き')).toBe('がき');
  });

  it('handles mixed newlines and spaces correctly', () => {
    const input = '東京 タワー\r\n大阪 城\n京都 寺';
    const result = removeJapaneseSpaces(input);
    expect(result).toBe('東京タワー\r\n大阪城\n京都寺');
  });

  it('handles only fullwidth spaces', () => {
    expect(removeJapaneseSpaces('\u3000\u3000\u3000')).toBe('');
  });

  it('preserves consecutive ASCII spaces', () => {
    expect(removeJapaneseSpaces('hello   world')).toBe('hello   world');
  });

  it('handles single character input', () => {
    expect(removeJapaneseSpaces('あ')).toBe('あ');
    expect(removeJapaneseSpaces('a')).toBe('a');
  });

  it('handles emoji adjacent to Japanese', () => {
    // Emoji are outside the JP regex range — spaces may be preserved
    const result = removeJapaneseSpaces('東京 🗼');
    expect(() => removeJapaneseSpaces('東京 🗼')).not.toThrow();
    expect(typeof result).toBe('string');
  });

  it('idempotent — applying twice yields same result', () => {
    const input = '東京 タワー abc テスト hello world';
    const once = removeJapaneseSpaces(input);
    const twice = removeJapaneseSpaces(once);
    expect(twice).toBe(once);
  });
});
