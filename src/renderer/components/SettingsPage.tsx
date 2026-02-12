import { useEffect, useState } from 'react';
import type { DictionaryEntry } from '../../shared/types';

type MainTab = 'apikey' | 'dictionary';

export default function SettingsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('apikey');

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-700 p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setMainTab('apikey')}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                mainTab === 'apikey' ? 'bg-gray-700' : 'hover:bg-gray-700/50'
              }`}
            >
              API Key
            </button>
            <button
              onClick={() => setMainTab('dictionary')}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                mainTab === 'dictionary' ? 'bg-gray-700' : 'hover:bg-gray-700/50'
              }`}
            >
              Dictionary
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {mainTab === 'apikey' ? <ApiKeySection /> : <DictionarySection />}
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
      // Default to encrypted warning not shown if check fails
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Gemini API Key</h2>
      </div>

      {loadError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{loadError}</p>
        </div>
      )}

      {!isEncrypted && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-400">
            Warning: Secure encryption is not available on this system. Your API key will be stored in plain text.
          </p>
        </div>
      )}

      {maskedKey && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400 mb-2">Current API Key:</p>
          <p className="font-mono text-sm">{maskedKey}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
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
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 pr-20"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {validationResult && (
          <div
            className={`p-3 rounded-lg ${
              validationResult.valid
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <p
              className={`text-sm ${
                validationResult.valid ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {validationResult.valid ? 'API key is valid!' : validationResult.error}
            </p>
          </div>
        )}

        {saveMessage && (
          <div
            className={`p-3 rounded-lg ${
              saveMessage.includes('success')
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <p
              className={`text-sm ${
                saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {saveMessage}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={!apiKey.trim() || isValidating}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || isSaving}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">How to get your API Key:</h3>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>
              Go to{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Dictionary</h2>
        <button
          onClick={() => setIsAddDialogOpen(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Word
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mb-4 text-center text-gray-400 text-sm">Loading dictionary...</div>
      )}


      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Table */}
      {filteredEntries.length > 0 ? (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Reading
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Word
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm">{entry.reading}</td>
                  <td className="px-4 py-3 text-sm font-medium">{entry.word}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => openEditDialog(entry)}
                      className="text-gray-400 hover:text-white mr-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-sm">No dictionary entries yet.</p>
          <p className="text-xs mt-1">
            Click &quot;New Word&quot; to add custom words for better transcription.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {(isAddDialogOpen || editingEntry) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-medium mb-4">
              {editingEntry ? 'Edit Word' : 'Add New Word'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Reading
                </label>
                <input
                  type="text"
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="e.g., typeless"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Word
                </label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="e.g., Typeless"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeDialog}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
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
