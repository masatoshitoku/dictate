export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  status: 'idle' | 'recording' | 'processing' | 'typing' | 'error';
  errorMessage?: string;
}

export interface TranscriptionResult {
  originalText: string;
  formattedText: string;
  confidence?: number;
  duration: number;
}

export interface DictionaryEntry {
  id: string;
  reading: string;      // 読み方（ひらがな）
  word: string;         // 変換後の単語
  category: 'auto' | 'manual';
  createdAt: number;
  usageCount: number;
}

export interface TranscriptionHistoryEntry {
  id: string;
  originalText: string;   // 元のテキスト
  formattedText: string;  // フォーマット後のテキスト
  createdAt: number;      // タイムスタンプ
}

export interface ShortcutSettings {
  toggleRecording: string;
  cancelRecording: string;
  openSettings: string;
}

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  toggleRecording: 'Alt+Space',
  cancelRecording: 'Alt+Escape',  // Changed from 'Escape' - plain Escape conflicts with other apps
  openSettings: 'F2',
};

export interface AppSettings {
  hotkey: string;
  recordingMode: 'push-to-talk' | 'toggle';
  typingSpeed: 'instant' | 'fast' | 'natural';
  language: 'ja' | 'en' | 'auto';
  autoLaunch: boolean;
  showInMenuBar: boolean;
  shortcuts: ShortcutSettings;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'Alt+Space',
  recordingMode: 'toggle',
  typingSpeed: 'fast',
  language: 'ja',
  autoLaunch: false,
  showInMenuBar: true,
  shortcuts: DEFAULT_SHORTCUTS,
};

// IPC Channel Constants - use these instead of string literals
export const IPC_CHANNELS = {
  // Recording
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  TOGGLE_RECORDING: 'toggle-recording',
  CANCEL_RECORDING: 'cancel-recording',

  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  CHECK_ACCESSIBILITY: 'check-accessibility',

  // API Key
  SAVE_API_KEY: 'save-api-key',
  HAS_API_KEY: 'has-api-key',
  GET_MASKED_API_KEY: 'get-masked-api-key',
  VALIDATE_API_KEY: 'validate-api-key',
  IS_ENCRYPTION_AVAILABLE: 'is-encryption-available',

  // Dictionary
  GET_DICTIONARY: 'get-dictionary',
  GET_DICTIONARY_BY_CATEGORY: 'get-dictionary-by-category',
  SEARCH_DICTIONARY: 'search-dictionary',
  ADD_DICTIONARY_ENTRY: 'add-dictionary-entry',
  UPDATE_DICTIONARY_ENTRY: 'update-dictionary-entry',
  DELETE_DICTIONARY_ENTRY: 'delete-dictionary-entry',

  // History
  GET_HISTORY: 'get-history',
  SEARCH_HISTORY: 'search-history',
  DELETE_HISTORY_ENTRY: 'delete-history-entry',
  DELETE_ALL_HISTORY: 'delete-all-history',

  // Window
  OPEN_SETTINGS: 'open-settings',
  CLOSE_SETTINGS: 'close-settings',

  // Shortcuts
  GET_SHORTCUTS: 'get-shortcuts',
  SAVE_SHORTCUTS: 'save-shortcuts',
  PAUSE_SHORTCUTS: 'pause-shortcuts',
  RESUME_SHORTCUTS: 'resume-shortcuts',

  // Interim (Real-time transcription)
  REQUEST_INTERIM_AUDIO: 'request-interim-audio',
  SEND_INTERIM_AUDIO: 'send-interim-audio',

  // Events (Main -> Renderer)
  STATUS_CHANGED: 'status-changed',
  TRANSCRIPTION_RESULT: 'transcription-result',
  ERROR: 'error',
  START_AUDIO_CAPTURE: 'start-audio-capture',
  STOP_AUDIO_CAPTURE: 'stop-audio-capture',
  AUDIO_DATA_READY: 'audio-data-ready',

  // Permission
  CHECK_MICROPHONE_PERMISSION: 'check-microphone-permission',
} as const;

export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
