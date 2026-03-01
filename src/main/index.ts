import { app, BrowserWindow, ipcMain, dialog, screen, systemPreferences, session, shell } from 'electron';
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
import { typeText, getFrontmostApp, checkAccessibilityPermission } from './text-input';
import { DEFAULT_SETTINGS, AppSettings, IPC_CHANNELS, ShortcutSettings, DEFAULT_SHORTCUTS } from '../shared/types';
import { removeJapaneseSpaces } from '../shared/text-processing';
import {
  getApiKey,
  hasApiKey,
  saveApiKey,
  validateApiKey,
  getMaskedApiKey,
  isEncryptionAvailable
} from './secure-storage';
import { createLogger, logCriticalError } from './utils/logger';

// ============================================================================
// Constants
// ============================================================================

const WINDOW_WIDTH = 176;
// WINDOW_HEIGHT must match the CSS h-[44px] container + 4px vertical padding from bg-transparent wrapper
const WINDOW_HEIGHT = 48;
const WINDOW_BOTTOM_MARGIN = 40;
const SETTINGS_WINDOW_WIDTH = 800;
const SETTINGS_WINDOW_HEIGHT = 600;
const SETTINGS_WINDOW_MIN_WIDTH = 600;
const SETTINGS_WINDOW_MIN_HEIGHT = 400;
const WINDOW_HIDE_DELAY_MS = 100;
const MIN_AUDIO_BUFFER_SIZE = 1000; // Minimum audio buffer size in bytes

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
let previousFrontApp: string | null = null; // App that was active before recording started

// ============================================================================
// Shared Utilities
// ============================================================================

const debugLog = createLogger('dictate');

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
function loadWindowURL(targetWindow: BrowserWindow, hash?: string): void {
  console.log('[loadWindowURL] VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
  console.log('[loadWindowURL] hash:', hash);
  console.log('[loadWindowURL] using:', process.env.VITE_DEV_SERVER_URL ? 'dev server' : 'file');
  // Use Vite dev server only when explicitly in development mode
  if (process.env.VITE_DEV_SERVER_URL) {
    const url = hash ? `${process.env.VITE_DEV_SERVER_URL}#${hash}` : process.env.VITE_DEV_SERVER_URL;
    console.log('[loadWindowURL] loading URL:', url);
    targetWindow.loadURL(url);
  } else {
    // __dirname is dist/main/main, renderer is at dist/renderer
    const rendererPath = path.join(__dirname, '../../renderer/index.html');
    debugLog(`Renderer path: ${rendererPath}`);
    console.log('[loadWindowURL] loading file:', rendererPath);
    const options = hash ? { hash } : undefined;
    targetWindow.loadFile(rendererPath, options);
  }
}

/**
 * Show error notification via renderer.
 * Guards against destroyed webContents (e.g. window closed during async operation).
 */
function notifyError(window: BrowserWindow | null, message: string): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.ERROR, message);
  }
}

/**
 * Safely send IPC message to a window, guarding against destroyed webContents.
 */
function safeSend(window: BrowserWindow | null, channel: string, ...args: unknown[]): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, ...args);
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
    hasShadow: false,
    focusable: false,
    webPreferences: getDefaultWebPreferences(),
    show: false,
  });

  // Set window level to floating (shows above all windows on all spaces)
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadWindowURL(mainWindow);

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
    // Tell renderer to cancel/cleanup its recording state
    safeSend(mainWindow, IPC_CHANNELS.CANCEL_RECORDING);
    safeSend(mainWindow, IPC_CHANNELS.STATUS_CHANGED, 'idle');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });
}

function createSettingsWindow(): void {
  console.log('[createSettingsWindow] creating new window');
  if (settingsWindow) {
    console.log('[createSettingsWindow] window already exists, focusing');
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
    }).catch((error: unknown) => {
      debugLog(`Dialog error: ${error instanceof Error ? error.message : 'Unknown'}`);
    });
    return;
  }

  try {
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

      // Capture the frontmost app BEFORE showing the Dictate window,
      // so we can restore focus to it when pasting the transcription.
      previousFrontApp = await getFrontmostApp();
      debugLog(`Previous front app: ${previousFrontApp}`);

      // Ensure window is visible on all workspaces before showing
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.setAlwaysOnTop(true, 'floating');
      positionWindowOnCurrentScreen();
      mainWindow.showInactive();
      await startRecording();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    debugLog(`toggleRecording error: ${message}`);
  }
}

async function startRecording(): Promise<void> {
  if (isRecording || !mainWindow) return;

  try {
    safeSend(mainWindow, IPC_CHANNELS.STATUS_CHANGED, 'recording');
    audioRecorder.startRecording();
    isRecording = true;
    trayManager.setRecordingState(true, getTrayConfig());
    debugLog('Recording started');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    debugLog(`Failed to start recording: ${message}`);
    notifyError(mainWindow, 'Failed to start recording. Please check microphone permissions.');
    safeSend(mainWindow, IPC_CHANNELS.STATUS_CHANGED, 'error');
    mainWindow.hide();
  }
}

/**
 * Process transcription result and type text.
 * Expects already-formatted text (removeJapaneseSpaces applied by caller).
 */
async function processTranscription(formattedText: string): Promise<void> {
  if (!formattedText || formattedText.length === 0) {
    debugLog('No text to type');
    return;
  }

  debugLog(`About to type: "${formattedText}" → targetApp: "${previousFrontApp ?? 'none'}"`);

  // Wait for window to fully hide before typing
  await new Promise(resolve => setTimeout(resolve, WINDOW_HIDE_DELAY_MS));

  // Type the text, restoring focus to the app that was active before recording
  const settings = store.get('settings');
  await typeText(formattedText, { speed: settings.typingSpeed, targetApp: previousFrontApp ?? undefined });
  debugLog(`Typing completed for: "${formattedText}"`);
}

async function stopRecording(): Promise<void> {
  // If already stopping, wait for the existing promise
  if (stopPromise) {
    debugLog('Already stopping, waiting for existing promise');
    return stopPromise;
  }

  // Capture window reference at start to avoid race condition
  const targetWindow = mainWindow;
  if (!isRecording || !targetWindow) {
    debugLog('Not recording or no window');
    return;
  }

  stopPromise = (async () => {
    // Tracks whether we already sent a terminal status (error/idle) to the renderer.
    // The finally block uses this to avoid sending a redundant 'idle' after an error status.
    let statusAlreadyUpdated = false;
    try {
      safeSend(targetWindow, IPC_CHANNELS.STATUS_CHANGED, 'processing');

      debugLog('Stopping recording...');
      const audioBuffer = await audioRecorder.stopRecording();
      // Skip if audio is too short (likely no real speech)
      if (audioBuffer.length < MIN_AUDIO_BUFFER_SIZE) {
        debugLog('Audio too short, skipping transcription');
        targetWindow.hide();
        return;
      }

      debugLog('Calling Gemini API...');
      const gemini = getGeminiService();
      const dictionaryPrompt = dictionaryService.getDictionaryPrompt();
      const transcribedText = await gemini.transcribeAudioBuffer(audioBuffer, 'audio/webm', dictionaryPrompt);
      debugLog(`Transcription completed: "${transcribedText}"`);

      // Hide window before typing
      targetWindow.hide();

      // Skip if no speech detected
      if (!transcribedText || transcribedText.length === 0) {
        debugLog('No speech detected, skipping');
        return;
      }

      // Format once, use for both history and typing
      const formattedText = removeJapaneseSpaces(transcribedText);
      historyService.add(transcribedText, formattedText);
      debugLog(`History saved: "${formattedText}"`);

      // If accessibility is not granted, open System Settings automatically
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        statusAlreadyUpdated = true;
        debugLog('Accessibility permission not granted, opening System Settings');
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
        notifyError(targetWindow, 'テキスト入力にはアクセシビリティ権限が必要です。システム設定 > プライバシーとセキュリティ > アクセシビリティ でDictateを許可してください。');
        safeSend(targetWindow, IPC_CHANNELS.STATUS_CHANGED, 'error');
        return;
      }
      await processTranscription(formattedText);

    } catch (error: unknown) {
      statusAlreadyUpdated = true;
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugLog(`Recording error: ${message}`);

      // Show error to user
      notifyError(targetWindow, 'Transcription failed');
      safeSend(targetWindow, IPC_CHANNELS.STATUS_CHANGED, 'error');

      targetWindow.hide();
    } finally {
      isRecording = false;
      stopPromise = null;
      trayManager.setRecordingState(false, getTrayConfig());
      if (!statusAlreadyUpdated) {
        safeSend(targetWindow, IPC_CHANNELS.STATUS_CHANGED, 'idle');
      }
    }
  })();

  return stopPromise;
}

async function cancelRecording(): Promise<void> {
  const targetWindow = mainWindow;
  if (!targetWindow) return;

  if (stopPromise) {
    // A stop is already in-flight — await it; stopRecording handles its own cleanup
    try {
      await stopPromise;
    } catch {
      // Ignore errors from the in-flight stop
    }
    // stopRecording already sent 'idle', hid the window, and reset state.
    // Only send CANCEL_RECORDING so the renderer discards any pending result.
    safeSend(targetWindow, IPC_CHANNELS.CANCEL_RECORDING);
    debugLog('Recording cancelled (was already stopping)');
    return;
  }

  if (isRecording) {
    // Active recording with no stop in-flight — stop recorder and discard
    try {
      await audioRecorder.stopRecording();
    } catch {
      // Ignore errors during cancel
    }
    isRecording = false;
    trayManager.setRecordingState(false, getTrayConfig());
  }

  safeSend(targetWindow, IPC_CHANNELS.CANCEL_RECORDING);
  safeSend(targetWindow, IPC_CHANNELS.STATUS_CHANGED, 'idle');
  targetWindow.hide();
  debugLog('Recording cancelled');
}

// ============================================================================
// Tray Configuration
// ============================================================================

function getTrayConfig() {
  const settings = store.get('settings');
  return {
    onToggleRecording: toggleRecording,
    onShowWindow: () => mainWindow?.show(),
    onOpenSettings: () => createSettingsWindow(),
    onQuit: () => {
      appIsQuitting = true;
      app.quit();
    },
    currentShortcut: settings.shortcuts?.toggleRecording,
  };
}

// ============================================================================
// IPC Handlers
// ============================================================================

/**
 * Register an IPC handler with standardized error wrapping.
 * The handler receives only the user-supplied args (event is stripped).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- IPC args are untyped at the process boundary
function safeHandle(channel: string, handler: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`${channel} failed: ${message}`);
    }
  });
}

/**
 * Register an IPC handler that returns a fallback value on error instead of throwing.
 * Used for handlers where the renderer expects a value (not an exception) on failure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- IPC args are untyped at the process boundary
function safeHandleSoft<T>(channel: string, fallback: T, handler: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugLog(`${channel} failed (returning fallback): ${message}`);
      return fallback;
    }
  });
}

function setupIPC(): void {
  // Recording
  safeHandle(IPC_CHANNELS.START_RECORDING, () => startRecording());
  safeHandle(IPC_CHANNELS.STOP_RECORDING, () => stopRecording());
  safeHandle(IPC_CHANNELS.TOGGLE_RECORDING, () => toggleRecording());
  safeHandle(IPC_CHANNELS.CANCEL_RECORDING, () => cancelRecording());

  // Settings
  safeHandle(IPC_CHANNELS.GET_SETTINGS, () => store.get('settings'));
  safeHandle(IPC_CHANNELS.SAVE_SETTINGS, (settings: Partial<AppSettings>) => {
    const currentSettings = store.get('settings');
    const newSettings = { ...currentSettings, ...settings };
    store.set('settings', newSettings);
    return newSettings;
  });
  safeHandle(IPC_CHANNELS.CHECK_ACCESSIBILITY, () => checkAccessibilityPermission());

  // Dictionary
  safeHandle(IPC_CHANNELS.GET_DICTIONARY, () => dictionaryService.getAll());
  safeHandle(IPC_CHANNELS.GET_DICTIONARY_BY_CATEGORY, (category: 'auto' | 'manual') => dictionaryService.getByCategory(category));
  safeHandle(IPC_CHANNELS.SEARCH_DICTIONARY, (query: string) => dictionaryService.search(query));
  safeHandle(IPC_CHANNELS.ADD_DICTIONARY_ENTRY, (reading: string, word: string, category?: 'auto' | 'manual') => dictionaryService.add(reading, word, category));
  safeHandle(IPC_CHANNELS.UPDATE_DICTIONARY_ENTRY, (id: string, updates: { reading?: string; word?: string }) => dictionaryService.update(id, updates));
  safeHandle(IPC_CHANNELS.DELETE_DICTIONARY_ENTRY, (id: string) => dictionaryService.delete(id));

  // History
  safeHandle(IPC_CHANNELS.GET_HISTORY, () => historyService.getAll());
  safeHandle(IPC_CHANNELS.SEARCH_HISTORY, (query: string) => historyService.search(query));
  safeHandle(IPC_CHANNELS.DELETE_HISTORY_ENTRY, (id: string) => historyService.delete(id));
  safeHandle(IPC_CHANNELS.DELETE_ALL_HISTORY, () => { historyService.deleteAll(); return true; });

  // Window
  safeHandle(IPC_CHANNELS.OPEN_SETTINGS, () => createSettingsWindow());
  safeHandle(IPC_CHANNELS.CLOSE_SETTINGS, () => settingsWindow?.close());

  // API Key management
  safeHandle(IPC_CHANNELS.SAVE_API_KEY, (apiKey: string) => {
    const result = saveApiKey(apiKey);
    if (result) {
      initGeminiService(apiKey);
      // Create recording window if it doesn't exist yet (first-time setup)
      if (!mainWindow) {
        createWindow();
      }
    }
    return result;
  });
  safeHandle(IPC_CHANNELS.HAS_API_KEY, () => hasApiKey());
  safeHandle(IPC_CHANNELS.GET_MASKED_API_KEY, () => getMaskedApiKey());

  // Validate API key — returns error object on failure (renderer checks .valid)
  safeHandleSoft(IPC_CHANNELS.VALIDATE_API_KEY, { valid: false, error: 'Validation failed' },
    (apiKey: string) => validateApiKey(apiKey));

  // Encryption check — returns false on error
  safeHandleSoft(IPC_CHANNELS.IS_ENCRYPTION_AVAILABLE, false,
    () => isEncryptionAvailable());

  // Shortcuts
  safeHandle(IPC_CHANNELS.GET_SHORTCUTS, () => {
    const settings = store.get('settings');
    return settings.shortcuts || DEFAULT_SHORTCUTS;
  });
  safeHandle(IPC_CHANNELS.SAVE_SHORTCUTS, (shortcuts: ShortcutSettings) => {
    const success = shortcutManager.updateShortcuts(shortcuts);
    if (success) {
      const currentSettings = store.get('settings');
      store.set('settings', { ...currentSettings, shortcuts });
    }
    return success;
  });

  // Pause/resume — return false on error
  safeHandleSoft(IPC_CHANNELS.PAUSE_SHORTCUTS, false, () => { shortcutManager.pause(); return true; });
  safeHandleSoft(IPC_CHANNELS.RESUME_SHORTCUTS, false, () => { shortcutManager.resume(); return true; });

  // Permission check
  safeHandle(IPC_CHANNELS.CHECK_MICROPHONE_PERMISSION, () => {
    const result = checkMicrophonePermission();
    debugLog(`IPC CHECK_MICROPHONE_PERMISSION called, returning: ${result}`);
    return result;
  });
}

// ============================================================================
// Permission Checks
// ============================================================================

// Flag to ensure we only call askForMediaAccess() once (prevents infinite dialog loop)
let hasRequestedMicPermission = false;

async function requestMicrophonePermission(): Promise<boolean> {
  const status = systemPreferences.getMediaAccessStatus('microphone');
  debugLog(`Microphone permission status: ${status}`);

  if (status === 'granted') {
    return true;
  }

  if (status === 'denied') {
    return false;
  }

  // not-determined: Show the macOS permission dialog.
  // On macOS 26 Tahoe beta, askForMediaAccess() requires the app to have a
  // visible, focused window before the TCC dialog appears.
  if (!hasRequestedMicPermission) {
    hasRequestedMicPermission = true;

    // Temporarily show the main window and bring app to foreground.
    // This is required on macOS 26 Tahoe beta for the TCC dialog to appear.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      app.focus({ steal: true });
      // Brief delay to ensure the window is fully visible before requesting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    debugLog('Requesting microphone permission via askForMediaAccess...');
    const result = await systemPreferences.askForMediaAccess('microphone');
    debugLog(`askForMediaAccess resolved: ${result}`);

    const newStatus = systemPreferences.getMediaAccessStatus('microphone');
    debugLog(`TCC status after askForMediaAccess: ${newStatus}`);

    if (result || (newStatus as string) === 'granted') {
      // Hide the window again after permission granted
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
      return true;
    }

    // macOS 26 Tahoe beta bug: dialog still didn't appear.
    // Open System Settings as fallback for manual grant.
    if (newStatus !== 'granted') {
      debugLog('Opening System Settings (Microphone) for manual permission grant');
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
    }
  }

  return false;
}

function checkMicrophonePermission(): boolean {
  const status = systemPreferences.getMediaAccessStatus('microphone');
  debugLog(`checkMicrophonePermission: ${status}`);
  // macOS 26 Tahoe beta bug: getMediaAccessStatus() returns 'not-determined'
  // even when permission is enabled in System Settings → Microphone.
  // Only block if explicitly denied; otherwise allow and let the OS enforce TCC.
  return status !== 'denied';
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
  await requestMicrophonePermission();

  // Check accessibility permission silently (isTrustedAccessibilityClient does NOT
  // trigger the macOS "wants to control your computer" dialog when prompt=false).
  // The osascript-based checkAccessibilityPermission() triggers that dialog every
  // launch which caused the "infinite dialogs" issue.
  const hasAccessibility = systemPreferences.isTrustedAccessibilityClient(false);
  debugLog(`Accessibility permission: ${hasAccessibility}`);

  // Setup auto-updater
  setupAutoUpdater();
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Enforce CSP via response headers (supplements the <meta> tag in index.html).
  // This ensures CSP is active even in development (Vite dev server) where the
  // HTML <meta> CSP may be bypassed.
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const csp = isDev
    // Dev: allow Vite HMR WebSocket, inline scripts, and unsafe-eval for ES module dynamic imports
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*; font-src 'self';"
    // Prod: strict policy
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self';";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Permission check: reflect actual macOS TCC status so Chromium doesn't
  // bypass TCC by assuming permission is already granted.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (['media', 'mediaKeySystem', 'microphone'].includes(permission)) {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      // macOS 26 Tahoe beta bug: getMediaAccessStatus() returns 'not-determined'
      // even when the user has granted access in System Settings → Microphone.
      // Only block if explicitly denied; otherwise allow and let the OS kernel
      // enforce TCC at the hardware level.
      const granted = status !== 'denied';
      debugLog(`setPermissionCheckHandler: ${permission} → TCC=${status}, granted=${granted}`);
      return granted;
    }
    // Deny all non-media permissions by default (principle of least privilege)
    return false;
  });

  // Permission request: when Chromium asks (e.g. getUserMedia), grant it.
  // The actual TCC dialog is handled by requestMicrophonePermission() at startup.
  // Here we just ensure Chromium doesn't block the audio stream.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (['media', 'mediaKeySystem', 'microphone'].includes(permission)) {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      debugLog(`setPermissionRequestHandler: ${permission} → TCC=${status}`);
      if (status === 'denied') {
        callback(false);
        return;
      }
      // Grant Chromium-level permission. The OS TCC check happens at the
      // AVFoundation level regardless of what we return here.
      callback(true);
    } else {
      // Deny all non-media permissions by default (principle of least privilege)
      callback(false);
    }
  });

  initialize().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    debugLog(`Initialization failed: ${message}`);
    dialog.showErrorBox('Dictate - Initialization Error', `Failed to start: ${message}`);
    app.quit();
  });
});

// Security: restrict navigation and new window creation on all web contents
app.on('web-contents-created', (_, contents) => {
  // Block navigation to external URLs (prevents open redirect / phishing attacks)
  contents.on('will-navigate', (event, url) => {
    // Allow file:// (production) and localhost (dev server) only
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
      debugLog(`Blocked navigation to: ${url}`);
    }
  });

  // Block all new window creation (window.open, target=_blank, etc.)
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Block DevTools keyboard shortcuts in production
  if (app.isPackaged) {
    contents.on('before-input-event', (event, input) => {
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

// ============================================================================
// Global Error Handlers
// ============================================================================

process.on('uncaughtException', (error: Error) => {
  debugLog(`Uncaught exception: ${error.message}`);
  logCriticalError('uncaughtException', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  debugLog(`Unhandled rejection: ${message}`);
  logCriticalError('unhandledRejection', message);
});
