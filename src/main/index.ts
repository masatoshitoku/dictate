import { app, BrowserWindow, ipcMain, dialog, screen, systemPreferences, session } from 'electron';
import * as path from 'path';

// Prevent EPIPE errors when stdout/stderr is closed
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});

import Store from 'electron-store';
import { trayManager } from './tray';
import { shortcutManager, setupShortcuts } from './shortcuts';
import { audioRecorder } from './services/audio-recorder';
import { initGeminiService, getGeminiService } from './services/gemini';
import { dictionaryService } from './services/dictionary';
import { historyService } from './services/history';
import { setupAutoUpdater } from './services/updater';
import { typeText, checkAccessibilityPermission } from './text-input';
import { DEFAULT_SETTINGS, AppSettings, IPC_CHANNELS, ShortcutSettings, DEFAULT_SHORTCUTS } from '../shared/types';
import {
  getApiKey,
  hasApiKey,
  saveApiKey,
  validateApiKey,
  getMaskedApiKey,
  isEncryptionAvailable
} from './secure-storage';

// ============================================================================
// Constants
// ============================================================================

const WINDOW_WIDTH = 200;
const WINDOW_HEIGHT = 56;
const WINDOW_BOTTOM_MARGIN = 100;
const SETTINGS_WINDOW_WIDTH = 800;
const SETTINGS_WINDOW_HEIGHT = 600;
const SETTINGS_WINDOW_MIN_WIDTH = 600;
const SETTINGS_WINDOW_MIN_HEIGHT = 400;
const WINDOW_HIDE_DELAY_MS = 100;
const MIN_AUDIO_BUFFER_SIZE = 5000; // Minimum audio buffer size in bytes (~0.5 seconds)

// ============================================================================
// Store
// ============================================================================

const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: DEFAULT_SETTINGS,
  },
});

// ============================================================================
// State
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let isRecording = false;
let appIsQuitting = false;
let stopPromise: Promise<void> | null = null;

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Debug logging (ENABLED in all modes for debugging permission issue)
 */
function debugLog(msg: string): void {
  try {
    console.log(`[dictate] ${msg}`);
  } catch {
    // Ignore EPIPE errors when stdout is closed
  }
}

/**
 * Get default web preferences for BrowserWindow
 */
function getDefaultWebPreferences(): Electron.WebPreferences {
  const preloadPath = path.join(__dirname, '../../preload/preload/index.js');
  debugLog(`Preload path: ${preloadPath}`);
  debugLog(`__dirname: ${__dirname}`);
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,  // Disabled for MediaDevices API stability
    webSecurity: true,  // Enforce same-origin policy
    backgroundThrottling: false,  // Keep renderer active when window is hidden
  };
}

/**
 * Load URL based on environment (development vs production)
 */
function loadWindowURL(window: BrowserWindow, hash?: string): void {
  // Use Vite dev server only when explicitly in development mode
  if (process.env.VITE_DEV_SERVER_URL) {
    const url = hash ? `${process.env.VITE_DEV_SERVER_URL}#${hash}` : process.env.VITE_DEV_SERVER_URL;
    window.loadURL(url);
  } else {
    // __dirname is dist/main/main, renderer is at dist/renderer
    const rendererPath = path.join(__dirname, '../../renderer/index.html');
    debugLog(`Renderer path: ${rendererPath}`);
    const options = hash ? { hash } : undefined;
    window.loadFile(rendererPath, options);
  }
}

/**
 * Show error notification via renderer
 */
function notifyError(window: BrowserWindow | null, message: string): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.ERROR, message);
  }
}

// ============================================================================
// Window Management
// ============================================================================

function positionWindowOnCurrentScreen(): void {
  if (!mainWindow) return;

  const cursorPoint = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = currentDisplay.workArea;

  const newX = x + Math.round((width - WINDOW_WIDTH) / 2);
  const newY = y + height - WINDOW_HEIGHT - WINDOW_BOTTOM_MARGIN;

  mainWindow.setPosition(newX, newY);
}

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.round((screenWidth - WINDOW_WIDTH) / 2),
    y: screenHeight - WINDOW_HEIGHT - WINDOW_BOTTOM_MARGIN,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    focusable: false,
    webPreferences: getDefaultWebPreferences(),
    show: false,
  });

  // Set window level to floating (shows above all windows on all spaces)
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadWindowURL(mainWindow);

  // Open DevTools in development for debugging
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('close', (event) => {
    if (!appIsQuitting) {
      event.preventDefault();

      mainWindow?.hide();
    }
  });

  audioRecorder.setMainWindow(mainWindow);

  // Sync isRecording state when audio-recorder times out
  audioRecorder.setOnTimeoutCallback(() => {
    debugLog('Recording timeout - syncing main process state');
    isRecording = false;
    stopPromise = null;
    trayManager.setRecordingState(false, getTrayConfig());
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Tell renderer to cancel/cleanup its recording state
      mainWindow.webContents.send(IPC_CHANNELS.CANCEL_RECORDING);
      mainWindow.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'idle');

      mainWindow.hide();
    }
  });
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    minWidth: SETTINGS_WINDOW_MIN_WIDTH,
    minHeight: SETTINGS_WINDOW_MIN_HEIGHT,
    title: 'Settings',
    titleBarStyle: 'hiddenInset',
    webPreferences: getDefaultWebPreferences(),
  });

  loadWindowURL(settingsWindow, '/settings');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ============================================================================
// Recording Logic
// ============================================================================

let lastStartTime = 0;
const START_DEBOUNCE_MS = 300; // Only debounce starting, not stopping

async function toggleRecording(): Promise<void> {
  const now = Date.now();

  if (!mainWindow) {
    // API Key未設定の場合、設定画面を開くよう促す
    dialog.showMessageBox({
      type: 'info',
      title: 'Setup Required',
      message: 'API Keyを設定してください',
      detail: '録音機能を使用するには、Gemini API Keyの設定が必要です。',
      buttons: ['設定を開く', '後で'],
    }).then((result) => {
      if (result.response === 0) {
        createSettingsWindow();
      }
    });
    return;
  }

  if (isRecording || stopPromise) {
    // Always allow stopping - no debounce for stop
    await stopRecording();
  } else {
    // Debounce only for starting
    if (now - lastStartTime < START_DEBOUNCE_MS) {
      debugLog('Start debounced');
      return;
    }
    lastStartTime = now;

    // Ensure window is visible on all workspaces before showing
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'floating');
    positionWindowOnCurrentScreen();
    mainWindow.showInactive();
    await startRecording();
  }
}

async function startRecording(): Promise<void> {
  if (isRecording || !mainWindow) return;

  try {
    mainWindow.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'recording');
    audioRecorder.startRecording();
    isRecording = true;
    trayManager.setRecordingState(true, getTrayConfig());
    debugLog('Recording started');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    debugLog(`Failed to start recording: ${message}`);
    notifyError(mainWindow, 'Failed to start recording. Please check microphone permissions.');
    mainWindow.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'error');
  }
}

/**
 * Process transcription result and type text
 */
// Remove unnecessary spaces from Japanese text
function removeJapaneseSpaces(text: string): string {
  // Japanese character ranges
  const japanesePattern = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/;

  let result = text;
  let prev = '';

  // Repeat until no more changes (handles consecutive spaces)
  while (result !== prev) {
    prev = result;
    // Remove spaces between Japanese characters
    result = result.replace(/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g, '$1$2');
    // Remove spaces between Japanese and ASCII
    result = result.replace(/([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])\s+([a-zA-Z0-9])/g, '$1$2');
    result = result.replace(/([a-zA-Z0-9])\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])/g, '$1$2');
  }

  // Also convert full-width spaces to nothing when between Japanese
  result = result.replace(/\u3000/g, '');

  return result;
}

async function processTranscription(transcribedText: string): Promise<void> {
  if (!transcribedText || transcribedText.length === 0) {
    debugLog('No text to type');
    return;
  }

  // Remove unnecessary spaces from Japanese text
  const formattedText = removeJapaneseSpaces(transcribedText);
  debugLog(`About to type: "${formattedText}"`);

  // Wait for window to fully hide before typing
  await new Promise(resolve => setTimeout(resolve, WINDOW_HIDE_DELAY_MS));

  // Type the text
  const settings = store.get('settings');
  await typeText(formattedText, { speed: settings.typingSpeed });
  debugLog(`Typing completed for: "${formattedText}"`);
}

async function stopRecording(): Promise<void> {
  // If already stopping, wait for the existing promise
  if (stopPromise) {
    debugLog('Already stopping, waiting for existing promise');
    return stopPromise;
  }

  // Capture window reference at start to avoid race condition
  const window = mainWindow;
  if (!isRecording || !window) {
    debugLog('Not recording or no window');
    return;
  }

  stopPromise = (async () => {
    try {
      window.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'processing');

      debugLog('Stopping recording...');
      const audioBuffer = await audioRecorder.stopRecording();
      debugLog(`Audio buffer size: ${audioBuffer.length}`);

      // Skip if audio is too short (likely no real speech)
      if (audioBuffer.length < MIN_AUDIO_BUFFER_SIZE) {
        debugLog('Audio too short, skipping transcription');
  
        window.hide();
        return;
      }

      debugLog('Calling Gemini API...');
      const gemini = getGeminiService();
      const dictionaryPrompt = dictionaryService.getDictionaryPrompt();
      const transcribedText = await gemini.transcribeAudioBuffer(audioBuffer, 'audio/webm', dictionaryPrompt);
      debugLog(`Transcription completed: "${transcribedText}"`);

      // Hide window before typing

      window.hide();

      // Skip if no speech detected
      if (!transcribedText || transcribedText.length === 0) {
        debugLog('No speech detected, skipping');
        return;
      }

      // Save to history
      const formattedText = removeJapaneseSpaces(transcribedText);
      historyService.add(transcribedText, formattedText);
      debugLog(`History saved: "${formattedText}"`);

      // Process and type the transcription
      await processTranscription(transcribedText);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugLog(`Recording error: ${message}`);

      // Show error to user
      notifyError(window, `Transcription failed: ${message}`);
      window.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'error');

      window.hide();
    } finally {
      isRecording = false;
      stopPromise = null;
      trayManager.setRecordingState(false, getTrayConfig());
    }
  })();

  return stopPromise;
}

async function cancelRecording(): Promise<void> {
  const window = mainWindow;
  if (!window) return;

  if (isRecording) {
    // Stop the audio recorder
    try {
      await audioRecorder.stopRecording();
    } catch {
      // Ignore errors during cancel
    }

    window.webContents.send(IPC_CHANNELS.CANCEL_RECORDING);
    isRecording = false;
    trayManager.setRecordingState(false, getTrayConfig());
    debugLog('Recording cancelled');
  }

  window.webContents.send(IPC_CHANNELS.STATUS_CHANGED, 'idle');

  window.hide();
}

// ============================================================================
// Tray Configuration
// ============================================================================

interface TrayConfig {
  onToggleRecording: () => Promise<void>;
  onShowWindow: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

function getTrayConfig(): TrayConfig {
  return {
    onToggleRecording: toggleRecording,
    onShowWindow: () => mainWindow?.show(),
    onOpenSettings: () => createSettingsWindow(),
    onQuit: () => {
      appIsQuitting = true;
      app.quit();
    },
  };
}

// ============================================================================
// IPC Handlers with Error Handling
// ============================================================================

function setupIPC(): void {
  // Recording
  ipcMain.handle(IPC_CHANNELS.START_RECORDING, async () => {
    try {
      await startRecording();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start recording: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.STOP_RECORDING, async () => {
    try {
      await stopRecording();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to stop recording: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_RECORDING, async () => {
    try {
      await toggleRecording();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to toggle recording: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_RECORDING, async () => {
    try {
      await cancelRecording();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to cancel recording: ${message}`);
    }
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    try {
      return store.get('settings');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get settings: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, settings: Partial<AppSettings>) => {
    try {
      const currentSettings = store.get('settings');
      const newSettings = { ...currentSettings, ...settings };
      store.set('settings', newSettings);
      return newSettings;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save settings: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_ACCESSIBILITY, async () => {
    try {
      return await checkAccessibilityPermission();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to check accessibility: ${message}`);
    }
  });

  // Dictionary
  ipcMain.handle(IPC_CHANNELS.GET_DICTIONARY, () => {
    try {
      return dictionaryService.getAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get dictionary: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_DICTIONARY_BY_CATEGORY, (_event, category: 'auto' | 'manual') => {
    try {
      return dictionaryService.getByCategory(category);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get dictionary by category: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SEARCH_DICTIONARY, (_event, query: string) => {
    try {
      return dictionaryService.search(query);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to search dictionary: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_DICTIONARY_ENTRY, (_event, reading: string, word: string, category?: 'auto' | 'manual') => {
    try {
      return dictionaryService.add(reading, word, category);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to add dictionary entry: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DICTIONARY_ENTRY, (_event, id: string, updates: { reading?: string; word?: string }) => {
    try {
      return dictionaryService.update(id, updates);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update dictionary entry: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DICTIONARY_ENTRY, (_event, id: string) => {
    try {
      return dictionaryService.delete(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete dictionary entry: ${message}`);
    }
  });

  // History
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, () => {
    try {
      return historyService.getAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get history: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SEARCH_HISTORY, (_event, query: string) => {
    try {
      return historyService.search(query);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to search history: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_HISTORY_ENTRY, (_event, id: string) => {
    try {
      return historyService.delete(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete history entry: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_ALL_HISTORY, () => {
    try {
      historyService.deleteAll();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete all history: ${message}`);
    }
  });

  // Window
  ipcMain.handle(IPC_CHANNELS.OPEN_SETTINGS, () => {
    try {
      createSettingsWindow();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to open settings: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_SETTINGS, () => {
    try {
      settingsWindow?.close();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to close settings: ${message}`);
    }
  });

  // API Key management
  ipcMain.handle(IPC_CHANNELS.SAVE_API_KEY, async (_event, apiKey: string) => {
    try {
      const result = saveApiKey(apiKey);
      if (result) {
        initGeminiService(apiKey);
      }
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save API key: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.HAS_API_KEY, () => {
    try {
      return hasApiKey();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to check API key: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_MASKED_API_KEY, () => {
    try {
      return getMaskedApiKey();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get masked API key: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_event, apiKey: string) => {
    try {
      return await validateApiKey(apiKey);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: `Validation failed: ${message}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.IS_ENCRYPTION_AVAILABLE, () => {
    try {
      return isEncryptionAvailable();
    } catch (error: unknown) {
      return false;
    }
  });

  // Shortcuts
  ipcMain.handle(IPC_CHANNELS.GET_SHORTCUTS, () => {
    try {
      const settings = store.get('settings');
      return settings.shortcuts || DEFAULT_SHORTCUTS;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get shortcuts: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SHORTCUTS, (_event, shortcuts: ShortcutSettings) => {
    try {
      const success = shortcutManager.updateShortcuts(shortcuts);
      if (success) {
        const currentSettings = store.get('settings');
        store.set('settings', { ...currentSettings, shortcuts });
      }
      return success;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save shortcuts: ${message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAUSE_SHORTCUTS, () => {
    try {
      shortcutManager.pause();
      return true;
    } catch (error: unknown) {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_SHORTCUTS, () => {
    try {
      shortcutManager.resume();
      return true;
    } catch (error: unknown) {
      return false;
    }
  });

  // Permission check - returns cached status without triggering dialog
  ipcMain.handle(IPC_CHANNELS.CHECK_MICROPHONE_PERMISSION, () => {
    const result = checkMicrophonePermission();
    debugLog(`IPC CHECK_MICROPHONE_PERMISSION called, returning: ${result}`);
    return result;
  });
}

// ============================================================================
// Permission Checks
// ============================================================================

let microphonePermissionGranted = false;
let microphonePermissionChecked = false;
// Flag to ensure we only call askForMediaAccess() once (prevents infinite dialog loop)
let hasRequestedMicPermission = false;

async function requestMicrophonePermission(): Promise<boolean> {
  const status = systemPreferences.getMediaAccessStatus('microphone');
  debugLog(`Microphone permission status: ${status}`);

  if (status === 'granted') {
    microphonePermissionGranted = true;
    microphonePermissionChecked = true;
    return true;
  }

  if (status === 'denied') {
    microphonePermissionGranted = false;
    microphonePermissionChecked = true;
    return false;
  }

  // not-determined: Show the macOS permission dialog ONCE.
  // On macOS 26, askForMediaAccess() shows the dialog but returns false immediately
  // without waiting for the user's response. We fire-and-forget, then the user
  // grants/denies in the dialog, and checkMicrophonePermission() picks up the new status.
  if (!hasRequestedMicPermission) {
    hasRequestedMicPermission = true;
    debugLog('Requesting microphone permission via askForMediaAccess (fire-and-forget)...');
    systemPreferences.askForMediaAccess('microphone').then(result => {
      debugLog(`askForMediaAccess resolved: ${result}`);
    });
  }

  microphonePermissionGranted = false;
  microphonePermissionChecked = true;
  return false; // Not granted yet - user needs to respond to the dialog
}

function checkMicrophonePermission(): boolean {
  const status = systemPreferences.getMediaAccessStatus('microphone');
  debugLog(`checkMicrophonePermission: ${status}`);
  // Only return true when macOS TCC has actually granted permission.
  // 'not-determined' means the dialog is pending - user hasn't responded yet.
  return status === 'granted';
}

// ============================================================================
// App Initialization
// ============================================================================

async function initialize(): Promise<void> {
  // Setup IPC first so settings window can use it
  setupIPC();

  // Get stored shortcuts
  const settings = store.get('settings');
  const shortcuts = settings.shortcuts || DEFAULT_SHORTCUTS;

  const apiKey = getApiKey();

  if (!apiKey) {
    // No API key configured - show settings window for first-time setup
    createSettingsWindow();

    // Still create tray for access
    trayManager.create(getTrayConfig());
    setupShortcuts({
      onToggleRecording: toggleRecording,
      onCancelRecording: cancelRecording,
      onOpenSettings: createSettingsWindow,
    }, shortcuts);

    return;
  }

  // Initialize Gemini service with stored key
  initGeminiService(apiKey);

  createWindow();

  trayManager.create(getTrayConfig());

  setupShortcuts({
    onToggleRecording: toggleRecording,
    onCancelRecording: cancelRecording,
    onOpenSettings: createSettingsWindow,
  }, shortcuts);

  // Request microphone permission ONCE from main process
  // This prevents the renderer from triggering multiple permission dialogs
  const hasMicrophone = await requestMicrophonePermission();
  if (!hasMicrophone) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Microphone Permission Required',
      message: 'This app requires microphone access for voice dictation.',
      detail: 'Please go to System Settings > Privacy & Security > Microphone and enable access for this app.',
      buttons: ['OK'],
    });
  }

  // Check accessibility permission
  const hasAccessibility = await checkAccessibilityPermission();
  if (!hasAccessibility) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'This app requires accessibility permission to type text into other applications.',
      detail: 'Please go to System Settings > Privacy & Security > Accessibility and add this app.',
      buttons: ['OK'],
    });
  }

  // Setup auto-updater
  setupAutoUpdater();
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Set up permission handler to auto-grant media permissions
  // This prevents the infinite permission dialog loop
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'microphone'];
    if (allowedPermissions.includes(permission)) {
      debugLog(`Auto-granting permission: ${permission}`);
      callback(true);
    } else {
      debugLog(`Permission requested: ${permission}`);
      callback(true); // Allow other permissions too for now
    }
  });

  // Also handle permission checks
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'microphone'];
    return allowedPermissions.includes(permission);
  });

  initialize();
});

// Disable DevTools in production
app.on('web-contents-created', (_, contents) => {
  if (app.isPackaged) {
    contents.on('before-input-event', (event, input) => {
      // Block DevTools shortcuts
      if (input.type === 'keyDown') {
        const isDevToolsShortcut =
          (input.control && input.shift && input.key === 'I') ||
          (input.meta && input.alt && input.key === 'I') ||
          input.key === 'F12';
        if (isDevToolsShortcut) {
          event.preventDefault();
        }
      }
    });
    // Prevent DevTools from being opened programmatically
    contents.on('devtools-opened', () => {
      contents.closeDevTools();
    });
  }
});

app.on('window-all-closed', () => {
  // Keep running in background on macOS
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  appIsQuitting = true;
  shortcutManager.unregisterAll();
  trayManager.destroy();
  audioRecorder.cleanup();
});
