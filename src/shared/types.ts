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

export interface AppSettings {
  hotkey: string;
  recordingMode: 'push-to-talk' | 'toggle';
  typingSpeed: 'instant' | 'fast' | 'natural';
  language: 'ja' | 'en' | 'auto';
  autoLaunch: boolean;
  showInMenuBar: boolean;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
}

export interface IPCChannels {
  // Main -> Renderer
  'recording-started': () => void;
  'recording-stopped': () => void;
  'transcription-result': (result: TranscriptionResult) => void;
  'status-changed': (status: RecordingState['status']) => void;
  'error': (message: string) => void;

  // Renderer -> Main
  'start-recording': () => void;
  'stop-recording': () => void;
  'toggle-recording': () => void;
  'get-settings': () => AppSettings;
  'save-settings': (settings: Partial<AppSettings>) => void;

  // API Key management
  'save-api-key': (apiKey: string) => boolean;
  'has-api-key': () => boolean;
  'get-masked-api-key': () => string | null;
  'validate-api-key': (apiKey: string) => ApiKeyValidationResult;
  'is-encryption-available': () => boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'Alt+Space',
  recordingMode: 'toggle',
  typingSpeed: 'fast',
  language: 'ja',
  autoLaunch: false,
  showInMenuBar: true,
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

  // Window
  OPEN_SETTINGS: 'open-settings',
  CLOSE_SETTINGS: 'close-settings',

  // Events (Main -> Renderer)
  STATUS_CHANGED: 'status-changed',
  TRANSCRIPTION_RESULT: 'transcription-result',
  ERROR: 'error',
  START_AUDIO_CAPTURE: 'start-audio-capture',
  STOP_AUDIO_CAPTURE: 'stop-audio-capture',
  AUDIO_DATA_READY: 'audio-data-ready',
} as const;

export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
