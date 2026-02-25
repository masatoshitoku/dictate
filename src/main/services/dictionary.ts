import Store from 'electron-store';
import { DictionaryEntry } from '../../shared/types';
import {
  getDictionaryPrompt as formatDictionaryPrompt,
  immutableUpdate,
  immutableIncrementUsage,
  immutableAdd,
} from '../../shared/dictionary-utils';
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

    const newEntries = immutableAdd(entries, entry);
    store.set('entries', newEntries);
    return entry;
  }

  update(id: string, updates: Partial<Pick<DictionaryEntry, 'reading' | 'word'>>): DictionaryEntry | null {
    const entries = this.getAll();
    const { entries: newEntries, updated } = immutableUpdate(entries, id, updates);
    if (!updated) return null;
    store.set('entries', newEntries);
    return updated;
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
    const newEntries = immutableIncrementUsage(entries, id);
    if (newEntries !== entries) {
      store.set('entries', newEntries);
    }
  }

  // Get dictionary as formatted string for Gemini prompt
  getDictionaryPrompt(): string {
    return formatDictionaryPrompt(this.getAll());
  }
}

export const dictionaryService = new DictionaryService();
