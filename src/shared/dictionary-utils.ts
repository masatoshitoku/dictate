/**
 * Pure utility functions for dictionary operations.
 * Extracted from DictionaryService so tests can import real production code
 * without electron-store dependency.
 */

export interface DictionaryEntryLike {
  id: string;
  reading: string;
  word: string;
  usageCount: number;
}

/**
 * Immutable update: replace a single entry's fields without mutating the array.
 */
export function immutableUpdate<T extends DictionaryEntryLike>(
  entries: T[],
  id: string,
  updates: Partial<Pick<T, 'reading' | 'word'>>
): { entries: T[]; updated: T | null } {
  const index = entries.findIndex(e => e.id === id);
  if (index === -1) return { entries, updated: null };

  const updated = { ...entries[index], ...updates } as T;
  const newEntries = [...entries.slice(0, index), updated, ...entries.slice(index + 1)];
  return { entries: newEntries, updated };
}

/**
 * Immutable increment: bump usageCount by 1 without mutating the array.
 */
export function immutableIncrementUsage<T extends DictionaryEntryLike>(
  entries: T[],
  id: string
): T[] {
  const index = entries.findIndex(e => e.id === id);
  if (index === -1) return entries;

  const updated = { ...entries[index], usageCount: entries[index].usageCount + 1 } as T;
  return [...entries.slice(0, index), updated, ...entries.slice(index + 1)];
}

/**
 * Immutable add: append an entry without mutating the array.
 */
export function immutableAdd<T>(entries: T[], entry: T): T[] {
  return [...entries, entry];
}

/**
 * Format dictionary entries into a prompt string for Gemini.
 */
export function getDictionaryPrompt(entries: { reading: string; word: string }[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map(e => `- "${e.reading}" → "${e.word}"`);
  return `\n\n## 辞書（参考情報のみ）
注意: この辞書は音声に含まれている単語の表記を補助するためのものです。
音声に含まれていない単語を辞書から推測して出力してはいけません。
\n${lines.join('\n')}`;
}
