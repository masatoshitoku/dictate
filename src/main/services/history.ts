import Store from 'electron-store';
import { TranscriptionHistoryEntry } from '../../shared/types';
import { randomUUID } from 'crypto';

interface HistoryStore {
  entries: TranscriptionHistoryEntry[];
}

const store = new Store<HistoryStore>({
  name: 'history',
  defaults: {
    entries: [],
  },
});

export class HistoryService {
  getAll(): TranscriptionHistoryEntry[] {
    return store.get('entries').sort((a, b) => b.createdAt - a.createdAt);
  }

  add(originalText: string, formattedText: string): TranscriptionHistoryEntry {
    const entries = store.get('entries');

    const entry: TranscriptionHistoryEntry = {
      id: randomUUID(),
      originalText,
      formattedText,
      createdAt: Date.now(),
    };

    entries.push(entry);
    store.set('entries', entries);
    return entry;
  }

  search(query: string): TranscriptionHistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      entry =>
        entry.originalText.toLowerCase().includes(lowerQuery) ||
        entry.formattedText.toLowerCase().includes(lowerQuery)
    );
  }

  delete(id: string): boolean {
    const entries = store.get('entries');
    const filtered = entries.filter(e => e.id !== id);

    if (filtered.length === entries.length) return false;

    store.set('entries', filtered);
    return true;
  }

  deleteAll(): void {
    store.set('entries', []);
  }
}

export const historyService = new HistoryService();
