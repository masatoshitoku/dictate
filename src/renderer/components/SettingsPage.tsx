import { useEffect, useState, useRef } from 'react';
import type { DictionaryEntry, ShortcutSettings, TranscriptionHistoryEntry } from '../../shared/types';

type MainTab = 'apikey' | 'dictionary' | 'shortcuts' | 'history';

export default function SettingsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('dictionary');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 text-white">
      {/* Header - pl-20 to avoid macOS window buttons, draggable for window movement */}
      <div
        className="border-b border-white/10 pl-20 pr-6 py-4 backdrop-blur-sm bg-white/5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Settings
        </h1>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <div className="w-56 border-r border-white/10 p-4 bg-white/5 backdrop-blur-sm">
          <nav className="space-y-2">
            <button
              onClick={() => setMainTab('dictionary')}
              className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                mainTab === 'dictionary'
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-400/30 text-white shadow-lg shadow-violet-500/10'
                  : 'hover:bg-white/10 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              Dictionary
            </button>
            <button
              onClick={() => setMainTab('shortcuts')}
              className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                mainTab === 'shortcuts'
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-400/30 text-white shadow-lg shadow-violet-500/10'
                  : 'hover:bg-white/10 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              Shortcuts
            </button>
            <button
              onClick={() => setMainTab('history')}
              className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                mainTab === 'history'
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-400/30 text-white shadow-lg shadow-violet-500/10'
                  : 'hover:bg-white/10 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setMainTab('apikey')}
              className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                mainTab === 'apikey'
                  ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-400/30 text-white shadow-lg shadow-violet-500/10'
                  : 'hover:bg-white/10 text-white/70 hover:text-white border border-transparent'
              }`}
            >
              API Key
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {mainTab === 'apikey' && <ApiKeySection />}
          {mainTab === 'dictionary' && <DictionarySection />}
          {mainTab === 'shortcuts' && <ShortcutsSection />}
          {mainTab === 'history' && <HistorySection />}
        </div>
      </div>
    </div>
  );
}

function ApiKeySection() {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentKey();
    checkEncryption();
  }, []);

  const loadCurrentKey = async () => {
    try {
      setLoadError(null);
      const masked = await window.electronAPI.getMaskedApiKey();
      setMaskedKey(masked);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLoadError(`Failed to load API key: ${message}`);
    }
  };

  const checkEncryption = async () => {
    try {
      const available = await window.electronAPI.isEncryptionAvailable();
      setIsEncrypted(available);
    } catch {
      setIsEncrypted(true);
    }
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await window.electronAPI.validateApiKey(apiKey.trim());
      setValidationResult(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setValidationResult({ valid: false, error: `Validation failed: ${message}` });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const success = await window.electronAPI.saveApiKey(apiKey.trim());

      if (success) {
        setSaveMessage('API key saved successfully. Please restart the app to apply changes.');
        setApiKey('');
        await loadCurrentKey();
      } else {
        setSaveMessage('Failed to save API key. Please try again.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSaveMessage(`Failed to save API key: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Gemini API Key
        </h2>
      </div>

      {loadError && (
        <div className="mb-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-400/30 rounded-xl">
          <p className="text-sm text-red-300">{loadError}</p>
        </div>
      )}

      {!isEncrypted && (
        <div className="mb-4 p-4 bg-amber-500/10 backdrop-blur-sm border border-amber-400/30 rounded-xl">
          <p className="text-sm text-amber-300">
            Warning: Secure encryption is not available on this system. Your API key will be stored in plain text.
          </p>
        </div>
      )}

      {maskedKey && (
        <div className="mb-6 p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
          <p className="text-sm text-white/50 mb-2">Current API Key:</p>
          <p className="font-mono text-sm text-white/80">{maskedKey}</p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">
            {maskedKey ? 'Enter new API Key' : 'Enter your Gemini API Key'}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setValidationResult(null);
                setSaveMessage(null);
              }}
              placeholder="AIza..."
              className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all pr-20 placeholder-white/30"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {validationResult && (
          <div
            className={`p-4 rounded-xl backdrop-blur-sm ${
              validationResult.valid
                ? 'bg-emerald-500/10 border border-emerald-400/30'
                : 'bg-red-500/10 border border-red-400/30'
            }`}
          >
            <p className={`text-sm ${validationResult.valid ? 'text-emerald-300' : 'text-red-300'}`}>
              {validationResult.valid ? 'API key is valid!' : validationResult.error}
            </p>
          </div>
        )}

        {saveMessage && (
          <div
            className={`p-4 rounded-xl backdrop-blur-sm ${
              saveMessage.includes('success')
                ? 'bg-emerald-500/10 border border-emerald-400/30'
                : 'bg-red-500/10 border border-red-400/30'
            }`}
          >
            <p className={`text-sm ${saveMessage.includes('success') ? 'text-emerald-300' : 'text-red-300'}`}>
              {saveMessage}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={!apiKey.trim() || isValidating}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-10 p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
          <h3 className="text-sm font-medium mb-3 text-white/80">How to get your API Key:</h3>
          <ol className="text-sm text-white/50 space-y-2 list-decimal list-inside">
            <li>
              Go to{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Google AI Studio
              </a>
            </li>
            <li>Sign in with your Google account</li>
            <li>Click &quot;Create API key&quot;</li>
            <li>Copy the generated key and paste it above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function DictionarySection() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DictionaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newReading, setNewReading] = useState('');
  const [newWord, setNewWord] = useState('');
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    filterEntries();
  }, [entries, searchQuery]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await window.electronAPI.getDictionary();
      setEntries(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load dictionary: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.reading.toLowerCase().includes(query) ||
          e.word.toLowerCase().includes(query)
      );
    }

    setFilteredEntries(filtered);
  };

  const handleAddEntry = async () => {
    if (!newReading.trim() || !newWord.trim()) return;

    try {
      setError(null);
      await window.electronAPI.addDictionaryEntry(newReading.trim(), newWord.trim(), 'manual');
      setNewReading('');
      setNewWord('');
      setIsAddDialogOpen(false);
      await loadEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to add entry: ${message}`);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !newReading.trim() || !newWord.trim()) return;

    try {
      setError(null);
      await window.electronAPI.updateDictionaryEntry(editingEntry.id, {
        reading: newReading.trim(),
        word: newWord.trim(),
      });
      setEditingEntry(null);
      setNewReading('');
      setNewWord('');
      await loadEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update entry: ${message}`);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      setError(null);
      await window.electronAPI.deleteDictionaryEntry(id);
      await loadEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete entry: ${message}`);
    }
  };

  const openEditDialog = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setNewReading(entry.reading);
    setNewWord(entry.word);
  };

  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingEntry(null);
    setNewReading('');
    setNewWord('');
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Dictionary
        </h2>
        <button
          onClick={() => setIsAddDialogOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Word
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-400/30 rounded-xl flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-200 ml-2 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-4 text-center text-white/50 text-sm">Loading dictionary...</div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all placeholder-white/30"
        />
      </div>

      {/* Table */}
      {filteredEntries.length > 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                  Reading
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                  Word
                </th>
                <th className="px-5 py-4 text-right text-xs font-medium text-white/50 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 text-sm text-white/70">{entry.reading}</td>
                  <td className="px-5 py-4 text-sm font-medium text-white">{entry.word}</td>
                  <td className="px-5 py-4 text-sm text-right">
                    <button
                      onClick={() => openEditDialog(entry)}
                      className="text-white/40 hover:text-violet-400 mr-4 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-white/40 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm text-white/50">No dictionary entries yet.</p>
          <p className="text-xs mt-1 text-white/30">
            Click &quot;New Word&quot; to add custom words for better transcription.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {(isAddDialogOpen || editingEntry) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-96 shadow-2xl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newReading.trim() && newWord.trim()) {
                e.preventDefault();
                editingEntry ? handleUpdateEntry() : handleAddEntry();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog();
              }
            }}
          >
            <h3 className="text-lg font-semibold mb-5 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              {editingEntry ? 'Edit Word' : 'Add New Word'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Reading</label>
                <input
                  type="text"
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="e.g., dictate"
                  autoFocus
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all placeholder-white/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Word</label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="e.g., Dictate"
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all placeholder-white/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeDialog}
                className="px-5 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
              >
                {editingEntry ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState<ShortcutSettings>({
    toggleRecording: 'Alt+Space',
    cancelRecording: 'Escape',
    openSettings: 'F2',
  });
  const [editingKey, setEditingKey] = useState<keyof ShortcutSettings | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref for synchronous key tracking
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const editingKeyRef = useRef<keyof ShortcutSettings | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    loadShortcuts();
  }, []);

  const loadShortcuts = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.getShortcuts();
      setShortcuts(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to load shortcuts: ${errorMessage}` });
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeKey = (key: string): string => {
    if (!key || key.length === 0) return '';

    const keyMap: Record<string, string> = {
      'Control': 'Ctrl',
      'Meta': 'Command',
      ' ': 'Space',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
    };
    return keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  };

  const isModifierKey = (key: string): boolean => {
    return ['Control', 'Alt', 'Shift', 'Meta'].includes(key);
  };

  const buildShortcutFromSet = (keys: Set<string>): string => {
    const modifierOrder = ['Ctrl', 'Alt', 'Shift', 'Command'];
    const modifiers: string[] = [];
    const mainKeys: string[] = [];

    keys.forEach(key => {
      if (!key || key.length === 0) return; // Skip empty keys

      const normalized = normalizeKey(key);
      if (!normalized) return; // Skip if normalization returned empty

      if (['Ctrl', 'Alt', 'Shift', 'Command'].includes(normalized)) {
        if (!modifiers.includes(normalized)) {
          modifiers.push(normalized);
        }
      } else {
        if (!mainKeys.includes(normalized)) {
          mainKeys.push(normalized);
        }
      }
    });

    // Sort modifiers in standard order
    modifiers.sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));

    // Filter out any empty strings and join
    return [...modifiers, ...mainKeys].filter(k => k && k.length > 0).join('+');
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!isRecordingRef.current || !editingKeyRef.current) return;

      event.preventDefault();
      event.stopPropagation();

      const key = event.key;
      const code = event.code;

      // Normalize space key
      let keyToAdd = key;
      if (key === ' ' || code === 'Space') {
        keyToAdd = ' ';
      }

      pressedKeysRef.current.add(keyToAdd);

      const shortcutStr = buildShortcutFromSet(pressedKeysRef.current);
      setCurrentKeys(shortcutStr || 'Press keys...');

      // Check if we have a non-modifier key
      const hasMainKey = Array.from(pressedKeysRef.current).some(k => !isModifierKey(k));

      if (hasMainKey && shortcutStr && shortcutStr.length > 0) {
        const currentEditingKey = editingKeyRef.current;

        setShortcuts(s => ({ ...s, [currentEditingKey]: shortcutStr }));
        setIsRecording(false);
        isRecordingRef.current = false;
        setEditingKey(null);
        editingKeyRef.current = null;
        setCurrentKeys('');
        pressedKeysRef.current.clear();

        // Resume global shortcuts
        window.electronAPI.resumeShortcuts();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isRecordingRef.current) return;

      event.preventDefault();
      event.stopPropagation();

      const key = event.key;
      pressedKeysRef.current.delete(key);

      if (pressedKeysRef.current.size > 0) {
        setCurrentKeys(buildShortcutFromSet(pressedKeysRef.current));
      } else {
        setCurrentKeys('');
      }
      // Debug: key=${key}, remaining=${pressedKeysRef.current.size}
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
    };
  }, []);

  const startRecording = async (key: keyof ShortcutSettings) => {
    // Pause global shortcuts so we can capture all key combinations
    await window.electronAPI.pauseShortcuts();

    // Blur any focused element to ensure key events are captured
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setEditingKey(key);
    editingKeyRef.current = key;
    setIsRecording(true);
    isRecordingRef.current = true;
    setCurrentKeys('');
    pressedKeysRef.current.clear();
    setMessage(null);
  };

  const cancelRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setEditingKey(null);
    editingKeyRef.current = null;
    setCurrentKeys('');
    pressedKeysRef.current.clear();

    // Resume global shortcuts
    await window.electronAPI.resumeShortcuts();
  };

  const isValidShortcut = (shortcut: string): boolean => {
    if (!shortcut || shortcut.length === 0) return false;
    if (shortcut.endsWith('+')) return false;
    if (shortcut.startsWith('+')) return false;

    const parts = shortcut.split('+').filter(p => p.length > 0);
    if (parts.length === 0) return false;

    // Must have at least one non-modifier key, or be a single key
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'Command'];
    const hasMainKey = parts.some(p => !modifiers.includes(p));
    return hasMainKey || parts.length === 1;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    // Validate all shortcuts
    const invalidShortcuts: string[] = [];
    Object.entries(shortcuts).forEach(([key, value]) => {
      if (!isValidShortcut(value)) {
        invalidShortcuts.push(key);
      }
    });

    if (invalidShortcuts.length > 0) {
      setMessage({ type: 'error', text: `Invalid shortcuts: ${invalidShortcuts.join(', ')}. Each shortcut needs a main key (not just modifiers).` });
      setIsSaving(false);
      return;
    }

    try {
      const success = await window.electronAPI.saveShortcuts(shortcuts);
      if (success) {
        setMessage({ type: 'success', text: 'Shortcuts saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to register shortcuts. The key combination may be in use.' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Failed to save shortcuts: ${errorMessage}` });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    const defaultShortcuts: ShortcutSettings = {
      toggleRecording: 'Alt+Space',
      cancelRecording: 'Escape',
      openSettings: 'F2',
    };
    setShortcuts(defaultShortcuts);
    setMessage(null);
  };

  const shortcutLabels: Record<keyof ShortcutSettings, { label: string; description: string }> = {
    toggleRecording: { label: 'Toggle Recording', description: 'Start/stop voice recording' },
    cancelRecording: { label: 'Cancel Recording', description: 'Cancel current recording without transcription' },
    openSettings: { label: 'Open Settings', description: 'Open the settings window' },
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <div className="text-center text-white/50 py-8">Loading shortcuts...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          Keyboard Shortcuts
        </h2>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl backdrop-blur-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-400/30'
              : 'bg-red-500/10 border border-red-400/30'
          }`}
        >
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(Object.keys(shortcuts) as Array<keyof ShortcutSettings>).map((key) => (
          <div
            key={key}
            className="p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{shortcutLabels[key].label}</p>
                <p className="text-sm text-white/50 mt-1">{shortcutLabels[key].description}</p>
              </div>
              <button
                onClick={() => isRecording && editingKey === key ? cancelRecording() : startRecording(key)}
                className={`px-4 py-2 rounded-lg font-mono text-sm transition-all min-w-[120px] ${
                  isRecording && editingKey === key
                    ? 'bg-violet-500/30 border border-violet-400/50 text-violet-300 animate-pulse'
                    : 'bg-white/10 border border-white/10 text-white hover:bg-white/20 hover:border-white/20'
                }`}
              >
                {isRecording && editingKey === key
                  ? (currentKeys || 'Press keys...')
                  : shortcuts[key]}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={resetToDefaults}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 hover:border-white/20 text-white text-sm font-medium rounded-xl transition-all"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          {isSaving ? 'Saving...' : 'Save Shortcuts'}
        </button>
      </div>

      <div className="mt-10 p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
        <h3 className="text-sm font-medium mb-3 text-white/80">Tips:</h3>
        <ul className="text-sm text-white/50 space-y-2 list-disc list-inside">
          <li>Click on a shortcut to change it, then press your desired key combination</li>
          <li>Use modifier keys like Alt, Ctrl, Shift, or Command with other keys</li>
          <li>Some shortcuts may conflict with system or other app shortcuts</li>
          <li>Changes take effect immediately after saving</li>
        </ul>
      </div>
    </div>
  );
}

function HistorySection() {
  const [entries, setEntries] = useState<TranscriptionHistoryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TranscriptionHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    filterEntries();
  }, [entries, searchQuery]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await window.electronAPI.getHistory();
      setEntries(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load history: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEntries = () => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredEntries(
        entries.filter(
          (e) =>
            e.originalText.toLowerCase().includes(query) ||
            e.formattedText.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredEntries(entries);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      setError(null);
      await window.electronAPI.deleteHistoryEntry(id);
      await loadEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete entry: ${message}`);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setError(null);
      await window.electronAPI.deleteAllHistory();
      setShowDeleteAllConfirm(false);
      await loadEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete all history: ${message}`);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyToClipboard = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Fallback for Electron
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
          History
        </h2>
        {entries.length > 0 && (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 text-sm font-medium rounded-xl transition-all border border-red-400/30 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete All
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-400/30 rounded-xl flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-200 ml-2 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-4 text-center text-white/50 text-sm">Loading history...</div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition-all placeholder-white/30"
        />
      </div>

      {/* Table */}
      {filteredEntries.length > 0 ? (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                  Text
                </th>
                <th className="px-5 py-4 text-right text-xs font-medium text-white/50 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 text-sm text-white/50 whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-white cursor-pointer hover:text-violet-300 transition-colors"
                    onClick={() => handleCopyToClipboard(entry.id, entry.formattedText)}
                    title="Click to copy"
                  >
                    <div className="max-w-md truncate flex items-center gap-2">
                      {entry.formattedText}
                      {copiedId === entry.id && (
                        <span className="text-xs text-emerald-400">Copied!</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-right">
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-white/40 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-white/50">No transcription history yet.</p>
          <p className="text-xs mt-1 text-white/30">
            Your transcription history will appear here after you use voice input.
          </p>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold mb-3 text-white">Delete All History?</h3>
            <p className="text-sm text-white/60 mb-6">
              This will permanently delete all {entries.length} transcription records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-5 py-2.5 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-xl transition-all"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
