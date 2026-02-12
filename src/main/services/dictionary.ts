import Store from 'electron-store';
import { DictionaryEntry } from '../../shared/types';
import { randomUUID } from 'crypto';

interface DictionaryStore {
  entries: DictionaryEntry[];
}

const store = new Store<DictionaryStore>({
  name: 'dictionary',
  defaults: {
    entries: [],
  },
});

export class DictionaryService {
  getAll(): DictionaryEntry[] {
    return store.get('entries');
  }

  getByCategory(category: 'auto' | 'manual'): DictionaryEntry[] {
    return this.getAll().filter(entry => entry.category === category);
  }

  search(query: string): DictionaryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      entry =>
        entry.reading.toLowerCase().includes(lowerQuery) ||
        entry.word.toLowerCase().includes(lowerQuery)
    );
  }

  add(reading: string, word: string, category: 'auto' | 'manual' = 'manual'): DictionaryEntry {
    const entries = this.getAll();

    // Check if already exists
    const existing = entries.find(e => e.reading === reading && e.word === word);
    if (existing) {
      return existing;
    }

    const entry: DictionaryEntry = {
      id: randomUUID(),
      reading,
      word,
      category,
      createdAt: Date.now(),
      usageCount: 0,
    };

    entries.push(entry);
    store.set('entries', entries);
    return entry;
  }

  update(id: string, updates: Partial<Pick<DictionaryEntry, 'reading' | 'word'>>): DictionaryEntry | null {
    const entries = this.getAll();
    const index = entries.findIndex(e => e.id === id);

    if (index === -1) return null;

    entries[index] = { ...entries[index], ...updates };
    store.set('entries', entries);
    return entries[index];
  }

  delete(id: string): boolean {
    const entries = this.getAll();
    const filtered = entries.filter(e => e.id !== id);

    if (filtered.length === entries.length) return false;

    store.set('entries', filtered);
    return true;
  }

  incrementUsage(id: string): void {
    const entries = this.getAll();
    const entry = entries.find(e => e.id === id);

    if (entry) {
      entry.usageCount++;
      store.set('entries', entries);
    }
  }

  // Auto-detect and add special words from transcription
  autoDetectSpecialWords(text: string): void {
    // Detect patterns that might be names or special terms
    const patterns = [
      // Japanese names (カタカナ names)
      /[ァ-ヶー]{2,}/g,
      // English words in Japanese text
      /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g,
      // Company names or product names (often have specific patterns)
      /[A-Z]{2,}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Only add if it looks like a proper noun (starts with capital or is katakana)
          if (match.length >= 2) {
            // Check if already exists
            const existing = this.getAll().find(e => e.word === match);
            if (!existing) {
              // For auto-detected words, reading is the same as word initially
              this.add(match.toLowerCase(), match, 'auto');
            }
          }
        }
      }
    }
  }

  // Get dictionary as formatted string for Gemini prompt
  getDictionaryPrompt(): string {
    const entries = this.getAll();
    if (entries.length === 0) return '';

    const lines = entries.map(e => `- "${e.reading}" → "${e.word}"`);
    return `\n\n## 辞書（参考情報のみ）
注意: この辞書は音声に含まれている単語の表記を補助するためのものです。
音声に含まれていない単語を辞書から推測して出力してはいけません。
\n${lines.join('\n')}`;
  }
}

export const dictionaryService = new DictionaryService();
