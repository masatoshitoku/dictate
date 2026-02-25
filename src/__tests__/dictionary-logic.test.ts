import { describe, it, expect } from 'vitest';
import {
  immutableUpdate,
  immutableIncrementUsage,
  immutableAdd,
  getDictionaryPrompt,
  type DictionaryEntryLike,
} from '../shared/dictionary-utils';

// Tests verify the REAL production functions imported from shared/dictionary-utils.ts.

describe('immutable update pattern', () => {
  interface Entry extends DictionaryEntryLike {
    id: string;
    reading: string;
    word: string;
    usageCount: number;
  }

  const sampleEntries: Entry[] = [
    { id: '1', reading: 'とうきょう', word: '東京', usageCount: 5 },
    { id: '2', reading: 'おおさか', word: '大阪', usageCount: 3 },
    { id: '3', reading: 'きょうと', word: '京都', usageCount: 1 },
  ];

  describe('immutableUpdate', () => {
    it('returns new array (not same reference)', () => {
      const result = immutableUpdate(sampleEntries, '2', { word: '大阪市' });
      expect(result.entries).not.toBe(sampleEntries);
    });

    it('does not mutate original array', () => {
      const original = [...sampleEntries];
      immutableUpdate(sampleEntries, '2', { word: '大阪市' });
      expect(sampleEntries).toEqual(original);
    });

    it('does not mutate original entry object', () => {
      const originalEntry = { ...sampleEntries[1] };
      immutableUpdate(sampleEntries, '2', { word: '大阪市' });
      expect(sampleEntries[1]).toEqual(originalEntry);
    });

    it('returns updated entry with new values', () => {
      const result = immutableUpdate(sampleEntries, '2', { word: '大阪市' });
      expect(result.updated).toEqual({ id: '2', reading: 'おおさか', word: '大阪市', usageCount: 3 });
    });

    it('returns null for nonexistent id', () => {
      const result = immutableUpdate(sampleEntries, 'nonexistent', { word: 'test' });
      expect(result.updated).toBeNull();
      expect(result.entries).toBe(sampleEntries); // same reference when no change
    });

    it('preserves other entries unchanged', () => {
      const result = immutableUpdate(sampleEntries, '2', { word: '大阪市' });
      expect(result.entries[0]).toEqual(sampleEntries[0]);
      expect(result.entries[2]).toEqual(sampleEntries[2]);
    });

    it('updates only the specified fields', () => {
      const result = immutableUpdate(sampleEntries, '1', { reading: 'とうきょうと' });
      expect(result.updated!.reading).toBe('とうきょうと');
      expect(result.updated!.word).toBe('東京'); // unchanged
    });
  });

  describe('immutableIncrementUsage', () => {
    it('increments usageCount by 1', () => {
      const result = immutableIncrementUsage(sampleEntries, '1');
      expect(result[0].usageCount).toBe(6);
    });

    it('returns new array (not same reference)', () => {
      const result = immutableIncrementUsage(sampleEntries, '1');
      expect(result).not.toBe(sampleEntries);
    });

    it('does not mutate original', () => {
      const original = sampleEntries[0].usageCount;
      immutableIncrementUsage(sampleEntries, '1');
      expect(sampleEntries[0].usageCount).toBe(original);
    });

    it('returns same reference for nonexistent id', () => {
      const result = immutableIncrementUsage(sampleEntries, 'nonexistent');
      expect(result).toBe(sampleEntries);
    });

    it('preserves other entries', () => {
      const result = immutableIncrementUsage(sampleEntries, '2');
      expect(result[0]).toEqual(sampleEntries[0]);
      expect(result[2]).toEqual(sampleEntries[2]);
      expect(result[1].usageCount).toBe(4);
    });
  });

  describe('immutableAdd', () => {
    it('returns new array with entry appended', () => {
      const newEntry: Entry = { id: '4', reading: 'なごや', word: '名古屋', usageCount: 0 };
      const result = immutableAdd(sampleEntries, newEntry);
      expect(result).toHaveLength(4);
      expect(result[3]).toEqual(newEntry);
    });

    it('does not mutate original array', () => {
      const originalLength = sampleEntries.length;
      const newEntry: Entry = { id: '4', reading: 'なごや', word: '名古屋', usageCount: 0 };
      immutableAdd(sampleEntries, newEntry);
      expect(sampleEntries).toHaveLength(originalLength);
    });

    it('returns new array reference', () => {
      const newEntry: Entry = { id: '4', reading: 'なごや', word: '名古屋', usageCount: 0 };
      const result = immutableAdd(sampleEntries, newEntry);
      expect(result).not.toBe(sampleEntries);
    });

    it('preserves existing entries', () => {
      const newEntry: Entry = { id: '4', reading: 'なごや', word: '名古屋', usageCount: 0 };
      const result = immutableAdd(sampleEntries, newEntry);
      expect(result.slice(0, 3)).toEqual(sampleEntries);
    });

    it('works with empty array', () => {
      const newEntry: Entry = { id: '1', reading: 'test', word: 'test', usageCount: 0 };
      const result = immutableAdd([], newEntry);
      expect(result).toEqual([newEntry]);
    });
  });
});

describe('getDictionaryPrompt format', () => {
  it('returns empty string for no entries', () => {
    expect(getDictionaryPrompt([])).toBe('');
  });

  it('formats single entry correctly', () => {
    const result = getDictionaryPrompt([{ reading: 'とうきょう', word: '東京' }]);
    expect(result).toContain('- "とうきょう" → "東京"');
    expect(result).toContain('## 辞書');
  });

  it('formats multiple entries with newline separation', () => {
    const entries = [
      { reading: 'とうきょう', word: '東京' },
      { reading: 'おおさか', word: '大阪' },
    ];
    const result = getDictionaryPrompt(entries);
    expect(result).toContain('- "とうきょう" → "東京"');
    expect(result).toContain('- "おおさか" → "大阪"');
  });

  it('includes the warning text', () => {
    const result = getDictionaryPrompt([{ reading: 'test', word: 'Test' }]);
    expect(result).toContain('音声に含まれていない単語を辞書から推測して出力してはいけません');
  });
});
