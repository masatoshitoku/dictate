import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import type { DictionaryEntry, ShortcutSettings, TranscriptionHistoryEntry } from '../../shared/types';
import { DEFAULT_SHORTCUTS } from '../../shared/types';

type MainTab = 'dictionary' | 'shortcuts' | 'history' | 'apikey';

// ============================================================================
// Sidebar Icons (SF Symbols-inspired)
// ============================================================================

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ============================================================================
// Tab configuration
// ============================================================================

const TAB_CONFIG: { key: MainTab; label: string; icon: typeof BookIcon }[] = [
  { key: 'dictionary', label: 'Dictionary', icon: BookIcon },
  { key: 'shortcuts', label: 'Shortcuts', icon: KeyboardIcon },
  { key: 'history', label: 'History', icon: ClockIcon },
  { key: 'apikey', label: 'API Key', icon: KeyIcon },
];

// ============================================================================
// Main SettingsPage
// ============================================================================

export default function SettingsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('dictionary');

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#e5e5e5] select-none">
      {/* Title bar - draggable, leaves room for macOS traffic lights */}
      <div
        className="h-13 flex items-center pl-20 pr-5 border-b border-white/[0.06] bg-[#252525]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-[13px] font-medium text-white/80 tracking-tight">Settings</h1>
      </div>

      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar */}
        <div className="w-52 border-r border-white/[0.06] bg-[#222222] px-3 py-3">
          <nav className="space-y-0.5">
            {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] rounded-md transition-colors duration-100 ${
                  mainTab === key
                    ? 'bg-white/[0.12] text-white font-medium'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80'
                }`}
              >
                <Icon className="w-[16px] h-[16px] flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto bg-[#1e1e1e]">
          <div className="max-w-2xl mx-auto px-8 py-7">
            {mainTab === 'apikey' && <ApiKeySection />}
            {mainTab === 'dictionary' && <DictionarySection />}
            {mainTab === 'shortcuts' && <ShortcutsSection />}
            {mainTab === 'history' && <HistorySection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared UI Primitives
// ============================================================================

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[20px] font-semibold text-white tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#2a2a2a] border border-white/[0.06] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

function AlertBox({
  variant,
  children,
  onDismiss,
}: {
  variant: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    error: 'bg-red-500/[0.08] border-red-500/20 text-red-400',
    warning: 'bg-amber-500/[0.08] border-amber-500/20 text-amber-400',
    success: 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400',
    info: 'bg-blue-500/[0.08] border-blue-500/20 text-blue-400',
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-[13px] leading-relaxed mb-4 ${styles[variant]}`}>
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  autoFocus,
  rightElement,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  autoFocus?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full px-3 py-[7px] bg-[#1e1e1e] border border-white/[0.1] rounded-md text-[13px] text-white/90 placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all ${rightElement ? 'pr-16' : ''} ${className}`}
      />
      {rightElement && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-4">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search...'}
        className="w-full pl-9 pr-3 py-[7px] bg-[#1e1e1e] border border-white/[0.1] rounded-md text-[13px] text-white/90 placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
      />
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
  variant = 'primary',
  className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm shadow-blue-600/20',
    secondary: 'bg-white/[0.08] hover:bg-white/[0.12] active:bg-white/[0.06] text-white/80 border border-white/[0.08]',
    danger: 'bg-red-600/80 hover:bg-red-500/80 active:bg-red-700/80 text-white shadow-sm shadow-red-600/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-[6px] text-[13px] font-medium rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12px] font-medium text-white/50 uppercase tracking-wider mb-1.5">{children}</label>;
}

function HelpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-8 p-4">
      <h3 className="text-[13px] font-medium text-white/70 mb-2">{title}</h3>
      <div className="text-[12px] text-white/40 leading-relaxed">{children}</div>
    </Card>
  );
}

// ============================================================================
// Modal Overlay
// ============================================================================

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#2a2a2a] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/40 w-[380px]">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// API Key Section
// ============================================================================

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
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
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
        setSaveResult('success');
        setApiKey('');
        await loadCurrentKey();
      } else {
        setSaveMessage('Failed to save API key. Please try again.');
        setSaveResult('error');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSaveMessage(`Failed to save API key: ${message}`);
      setSaveResult('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Gemini API Key" />

      {loadError && <AlertBox variant="error">{loadError}</AlertBox>}

      {!isEncrypted && (
        <AlertBox variant="warning">
          Secure encryption is not available on this system. Your API key will be stored in plain text.
        </AlertBox>
      )}

      {maskedKey && (
        <Card className="p-4 mb-5">
          <div className="text-[12px] font-medium text-white/40 uppercase tracking-wider mb-1">Current API Key</div>
          <div className="font-mono text-[13px] text-white/70">{maskedKey}</div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div>
          <Label>{maskedKey ? 'Enter new API Key' : 'Enter your Gemini API Key'}</Label>
          <TextInput
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(v) => {
              setApiKey(v);
              setValidationResult(null);
              setSaveMessage(null);
              setSaveResult(null);
            }}
            placeholder="AIza..."
            rightElement={
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-[12px] text-white/40 hover:text-white/70 transition-colors px-1"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            }
          />
        </div>

        {validationResult && (
          <AlertBox variant={validationResult.valid ? 'success' : 'error'}>
            {validationResult.valid ? 'API key is valid!' : validationResult.error}
          </AlertBox>
        )}

        {saveMessage && (
          <AlertBox variant={saveResult === 'success' ? 'success' : 'error'}>
            {saveMessage}
          </AlertBox>
        )}

        <div className="flex gap-2 pt-1">
          <PrimaryButton onClick={handleValidate} disabled={!apiKey.trim() || isValidating} variant="secondary">
            {isValidating ? 'Validating...' : 'Validate'}
          </PrimaryButton>
          <PrimaryButton onClick={handleSave} disabled={!apiKey.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </PrimaryButton>
        </div>
      </Card>

      <HelpCard title="How to get your API Key">
        <ol className="space-y-1.5 list-decimal list-inside">
          <li>
            Go to{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              Google AI Studio
            </a>
          </li>
          <li>Sign in with your Google account</li>
          <li>Click &quot;Create API key&quot;</li>
          <li>Copy the generated key and paste it above</li>
        </ol>
      </HelpCard>
    </div>
  );
}

// ============================================================================
// Dictionary Section
// ============================================================================

function DictionarySection() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
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

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.reading.toLowerCase().includes(query) ||
        e.word.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

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
    if (!window.confirm('Are you sure you want to delete this dictionary entry?')) return;
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
    <div>
      <SectionHeader
        title="Dictionary"
        action={
          <PrimaryButton onClick={() => setIsAddDialogOpen(true)}>
            <span className="flex items-center gap-1.5">
              <PlusIcon className="w-3.5 h-3.5" />
              New Word
            </span>
          </PrimaryButton>
        }
      />

      {error && <AlertBox variant="error" onDismiss={() => setError(null)}>{error}</AlertBox>}

      {isLoading && (
        <div className="py-6 text-center text-[13px] text-white/40">Loading dictionary...</div>
      )}

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search words..." />

      {filteredEntries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Reading
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Word
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-white/[0.03] transition-colors ${
                    i !== filteredEntries.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-[13px] text-white/60">{entry.reading}</td>
                  <td className="px-4 py-2.5 text-[13px] text-white/90 font-medium">{entry.word}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditDialog(entry)}
                        className="p-1.5 rounded-md text-white/30 hover:text-blue-400 hover:bg-white/[0.05] transition-all"
                        title="Edit"
                        aria-label="Edit entry"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-white/[0.05] transition-all"
                        title="Delete"
                        aria-label="Delete entry"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : !isLoading ? (
        <Card className="py-12 text-center">
          <BookIcon className="w-10 h-10 mx-auto mb-3 text-white/15" />
          <p className="text-[13px] text-white/40">No dictionary entries yet.</p>
          <p className="text-[12px] text-white/25 mt-1">
            Click &quot;New Word&quot; to add custom words for better transcription.
          </p>
        </Card>
      ) : null}

      {/* Add/Edit Dialog */}
      {(isAddDialogOpen || editingEntry) && (
        <ModalOverlay onClose={closeDialog}>
          <div
            className="p-5"
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
            <h3 className="text-[16px] font-semibold text-white mb-5">
              {editingEntry ? 'Edit Word' : 'Add New Word'}
            </h3>

            <div className="space-y-4">
              <div>
                <Label>Reading</Label>
                <TextInput
                  value={newReading}
                  onChange={setNewReading}
                  placeholder="e.g., dictate"
                  autoFocus
                />
              </div>
              <div>
                <Label>Word</Label>
                <TextInput
                  value={newWord}
                  onChange={setNewWord}
                  placeholder="e.g., Dictate"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <PrimaryButton onClick={closeDialog} variant="secondary">
                Cancel
              </PrimaryButton>
              <PrimaryButton
                onClick={editingEntry ? handleUpdateEntry : handleAddEntry}
                disabled={!newReading.trim() || !newWord.trim()}
              >
                {editingEntry ? 'Save' : 'Add'}
              </PrimaryButton>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ============================================================================
// Shortcuts Section
// ============================================================================

function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState<ShortcutSettings>({ ...DEFAULT_SHORTCUTS });
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

      // Escape cancels recording
      if (key === 'Escape') {
        setIsRecording(false);
        isRecordingRef.current = false;
        setEditingKey(null);
        editingKeyRef.current = null;
        setCurrentKeys('');
        pressedKeysRef.current.clear();
        window.electronAPI.resumeShortcuts();
        return;
      }

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

  const resetToDefaults = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    setMessage(null);
  };

  const shortcutLabels: Record<keyof ShortcutSettings, { label: string; description: string }> = {
    toggleRecording: { label: 'Toggle Recording', description: 'Start/stop voice recording' },
    cancelRecording: { label: 'Cancel Recording', description: 'Cancel current recording without transcription' },
    openSettings: { label: 'Open Settings', description: 'Open the settings window' },
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Keyboard Shortcuts" />
        <div className="py-8 text-center text-[13px] text-white/40">Loading shortcuts...</div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Keyboard Shortcuts" />

      {message && (
        <AlertBox variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </AlertBox>
      )}

      <Card className="divide-y divide-white/[0.04]">
        {(Object.keys(shortcuts) as Array<keyof ShortcutSettings>).map((key) => (
          <div key={key} className="flex items-center justify-between px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white/90">{shortcutLabels[key].label}</p>
              <p className="text-[12px] text-white/40 mt-0.5">{shortcutLabels[key].description}</p>
            </div>
            <button
              onClick={() => isRecording && editingKey === key ? cancelRecording() : startRecording(key)}
              className={`ml-4 px-3 py-1.5 rounded-md font-mono text-[12px] transition-all min-w-[110px] text-center flex-shrink-0 ${
                isRecording && editingKey === key
                  ? 'bg-blue-500/20 border border-blue-400/40 text-blue-300 animate-pulse'
                  : 'bg-[#1e1e1e] border border-white/[0.1] text-white/70 hover:border-white/20 hover:text-white/90'
              }`}
            >
              {isRecording && editingKey === key
                ? (currentKeys || 'Press keys...')
                : shortcuts[key]}
            </button>
          </div>
        ))}
      </Card>

      <div className="flex gap-2 mt-5">
        <PrimaryButton onClick={resetToDefaults} variant="secondary">
          Reset to Defaults
        </PrimaryButton>
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Shortcuts'}
        </PrimaryButton>
      </div>

      <HelpCard title="Tips">
        <ul className="space-y-1 list-disc list-inside">
          <li>Click on a shortcut to change it, then press your desired key combination</li>
          <li>Use modifier keys like Alt, Ctrl, Shift, or Command with other keys</li>
          <li>Some shortcuts may conflict with system or other app shortcuts</li>
          <li>Changes take effect immediately after saving</li>
        </ul>
      </HelpCard>
    </div>
  );
}

// ============================================================================
// History Section
// ============================================================================

function HistorySection() {
  const [entries, setEntries] = useState<TranscriptionHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadEntries();
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

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

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.originalText.toLowerCase().includes(query) ||
        e.formattedText.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

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

  const handleCopyToClipboard = useCallback(async (id: string, text: string) => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for Electron
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  return (
    <div>
      <SectionHeader
        title="History"
        action={
          entries.length > 0 ? (
            <PrimaryButton onClick={() => setShowDeleteAllConfirm(true)} variant="danger">
              <span className="flex items-center gap-1.5">
                <TrashIcon className="w-3.5 h-3.5" />
                Delete All
              </span>
            </PrimaryButton>
          ) : undefined
        }
      />

      {error && <AlertBox variant="error" onDismiss={() => setError(null)}>{error}</AlertBox>}

      {isLoading && (
        <div className="py-6 text-center text-[13px] text-white/40">Loading history...</div>
      )}

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search history..." />

      {filteredEntries.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase tracking-wider w-36">
                  Date
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  Text
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-white/40 uppercase tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-white/[0.03] transition-colors ${
                    i !== filteredEntries.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-[12px] text-white/40 whitespace-nowrap font-mono">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td
                    className="px-4 py-2.5 text-[13px] text-white/80 cursor-pointer hover:text-blue-300 transition-colors"
                    onClick={() => handleCopyToClipboard(entry.id, entry.formattedText)}
                    title="Click to copy"
                  >
                    <div className="relative">
                      <span className="block truncate">
                        {entry.formattedText}
                      </span>
                      {copiedId === entry.id && (
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-emerald-400 bg-[#2a2a2a] pl-2 pr-1 rounded">
                          Copied!
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-white/[0.05] transition-all"
                      title="Delete"
                      aria-label="Delete history entry"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : !isLoading ? (
        <Card className="py-12 text-center">
          <ClockIcon className="w-10 h-10 mx-auto mb-3 text-white/15" />
          <p className="text-[13px] text-white/40">No transcription history yet.</p>
          <p className="text-[12px] text-white/25 mt-1">
            Your transcription history will appear here after you use voice input.
          </p>
        </Card>
      ) : null}

      {/* Delete All Confirmation Dialog */}
      {showDeleteAllConfirm && (
        <ModalOverlay onClose={() => setShowDeleteAllConfirm(false)}>
          <div className="p-5">
            <h3 className="text-[16px] font-semibold text-white mb-2">Delete All History?</h3>
            <p className="text-[13px] text-white/50 mb-5 leading-relaxed">
              This will permanently delete all {entries.length} transcription records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <PrimaryButton onClick={() => setShowDeleteAllConfirm(false)} variant="secondary">
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={handleDeleteAll} variant="danger">
                Delete All
              </PrimaryButton>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
