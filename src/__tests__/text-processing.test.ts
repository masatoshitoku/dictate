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
});
