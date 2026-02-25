import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  TranscriptionResult,
  DictionaryEntry,
  TranscriptionHistoryEntry,
  ApiKeyValidationResult,
  ShortcutSettings,
  RecordingState,
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/types';

console.log('[preload] Script starting...');

type RecordingStatus = RecordingState['status'];

export interface ElectronAPI {
  // Recording
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;

  // Permission
  checkMicrophonePermission: () => Promise<boolean>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  checkAccessibility: () => Promise<boolean>;

  // API Key
  saveApiKey: (apiKey: string) => Promise<boolean>;
  hasApiKey: () => Promise<boolean>;
  getMaskedApiKey: () => Promise<string | null>;
  validateApiKey: (apiKey: string) => Promise<ApiKeyValidationResult>;
  isEncryptionAvailable: () => Promise<boolean>;

  // Dictionary
  getDictionary: () => Promise<DictionaryEntry[]>;
  getDictionaryByCategory: (category: 'auto' | 'manual') => Promise<DictionaryEntry[]>;
  searchDictionary: (query: string) => Promise<DictionaryEntry[]>;
  addDictionaryEntry: (reading: string, word: string, category?: 'auto' | 'manual') => Promise<DictionaryEntry>;
  updateDictionaryEntry: (id: string, updates: { reading?: string; word?: string }) => Promise<DictionaryEntry | null>;
  deleteDictionaryEntry: (id: string) => Promise<boolean>;

  // History
  getHistory: () => Promise<TranscriptionHistoryEntry[]>;
  searchHistory: (query: string) => Promise<TranscriptionHistoryEntry[]>;
  deleteHistoryEntry: (id: string) => Promise<boolean>;
  deleteAllHistory: () => Promise<boolean>;

  // Window
  openSettings: () => Promise<void>;
  closeSettings: () => Promise<void>;

  // Shortcuts
  getShortcuts: () => Promise<ShortcutSettings>;
  saveShortcuts: (shortcuts: ShortcutSettings) => Promise<boolean>;
  pauseShortcuts: () => Promise<boolean>;
  resumeShortcuts: () => Promise<boolean>;

  // Events
  onStatusChanged: (callback: (status: RecordingStatus) => void) => () => void;
  onTranscriptionResult: (callback: (result: TranscriptionResult) => void) => () => void;
  onError: (callback: (message: string) => void) => () => void;
  onStartAudioCapture: (callback: () => void) => () => void;
  onStopAudioCapture: (callback: () => void) => () => void;
  onCancelRecording: (callback: () => void) => () => void;

  sendAudioData: (data: ArrayBuffer) => void;
}

const electronAPI: ElectronAPI = {
  // Recording
  startRecording: () => ipcRenderer.invoke(IPC_CHANNELS.START_RECORDING),
  stopRecording: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_RECORDING),
  toggleRecording: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_RECORDING),
  cancelRecording: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_RECORDING),

  // Permission
  checkMicrophonePermission: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_MICROPHONE_PERMISSION),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  checkAccessibility: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_ACCESSIBILITY),

  // API Key
  saveApiKey: (apiKey) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_API_KEY, apiKey),
  hasApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.HAS_API_KEY),
  getMaskedApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MASKED_API_KEY),
  validateApiKey: (apiKey) => ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_API_KEY, apiKey),
  isEncryptionAvailable: () => ipcRenderer.invoke(IPC_CHANNELS.IS_ENCRYPTION_AVAILABLE),

  // Dictionary
  getDictionary: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DICTIONARY),
  getDictionaryByCategory: (category) => ipcRenderer.invoke(IPC_CHANNELS.GET_DICTIONARY_BY_CATEGORY, category),
  searchDictionary: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_DICTIONARY, query),
  addDictionaryEntry: (reading, word, category) => ipcRenderer.invoke(IPC_CHANNELS.ADD_DICTIONARY_ENTRY, reading, word, category),
  updateDictionaryEntry: (id, updates) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DICTIONARY_ENTRY, id, updates),
  deleteDictionaryEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_DICTIONARY_ENTRY, id),

  // History
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),
  searchHistory: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_HISTORY, query),
  deleteHistoryEntry: (id) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_HISTORY_ENTRY, id),
  deleteAllHistory: () => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALL_HISTORY),

  // Window
  openSettings: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_SETTINGS),
  closeSettings: () => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_SETTINGS),

  // Shortcuts
  getShortcuts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SHORTCUTS),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SHORTCUTS, shortcuts),
  pauseShortcuts: () => ipcRenderer.invoke(IPC_CHANNELS.PAUSE_SHORTCUTS),
  resumeShortcuts: () => ipcRenderer.invoke(IPC_CHANNELS.RESUME_SHORTCUTS),

  // Events
  onStatusChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: RecordingStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATUS_CHANGED, handler);
  },

  onTranscriptionResult: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: TranscriptionResult) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_RESULT, handler);
  },

  onError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ERROR, handler);
  },

  onStartAudioCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.START_AUDIO_CAPTURE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.START_AUDIO_CAPTURE, handler);
  },

  onStopAudioCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.STOP_AUDIO_CAPTURE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STOP_AUDIO_CAPTURE, handler);
  },

  onCancelRecording: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.CANCEL_RECORDING, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CANCEL_RECORDING, handler);
  },

  sendAudioData: (data) => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_DATA_READY, data);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
console.log('[preload] electronAPI exposed to window');

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
