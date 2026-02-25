import { BrowserWindow, ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Suppress debug logs in production builds to avoid info leakage. */
function debugLog(msg: string): void {
  if (app.isPackaged) return;
  try { console.log(msg); } catch { /* EPIPE */ }
}

export interface AudioRecorderConfig {
  sampleRate?: number;
  channels?: number;
}

export class AudioRecorder {
  private mainWindow: BrowserWindow | null = null;
  private isRecording = false;
  private isStopping = false;
  private tempDir: string;
  private pendingStopPromise: Promise<Buffer> | null = null;
  private onTimeoutCallback: (() => void) | null = null;
  private currentRecordingId = 0; // Unique ID for each recording session

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'typeless-clone');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setOnTimeoutCallback(callback: () => void): void {
    this.onTimeoutCallback = callback;
  }

  startRecording(): void {
    debugLog('[AudioRecorder] startRecording called');

    if (!this.mainWindow) {
      debugLog('[AudioRecorder] No mainWindow, aborting');
      return;
    }

    // Force reset state if stuck
    if (this.isStopping) {
      debugLog('[AudioRecorder] Forcing reset of isStopping flag');
      this.isStopping = false;
      this.pendingStopPromise = null;
    }

    if (this.isRecording) {
      debugLog('[AudioRecorder] Already recording, ignoring start');
      return;
    }

    this.isRecording = true;
    this.pendingStopPromise = null;
    this.currentRecordingId++; // New recording session
    debugLog(`[AudioRecorder] New session ID: ${this.currentRecordingId}`);

    this.mainWindow.webContents.send('start-audio-capture');
    debugLog('[AudioRecorder] Recording started');
  }

  stopRecording(): Promise<Buffer> {
    debugLog('[AudioRecorder] stopRecording called');

    // If already stopping, return the pending promise
    if (this.isStopping && this.pendingStopPromise) {
      debugLog('[AudioRecorder] Already stopping, returning pending promise');
      return this.pendingStopPromise;
    }

    this.pendingStopPromise = new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mainWindow) {
        debugLog(`[AudioRecorder] Cannot stop: isRecording=${this.isRecording}, hasWindow=${!!this.mainWindow}`);
        // Reset state to prevent stuck state
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        reject(new Error('Not recording'));
        return;
      }

      this.isStopping = true;
      const recordingIdAtStop = this.currentRecordingId;
      debugLog(`[AudioRecorder] Waiting for audio data (session ${recordingIdAtStop})`);

      const handler = (_event: Electron.IpcMainEvent, audioData: ArrayBuffer) => {
        ipcMain.removeListener('audio-data-ready', handler);
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        debugLog(`[AudioRecorder] Audio received, ${audioData.byteLength} bytes`);
        resolve(Buffer.from(audioData));
      };

      ipcMain.once('audio-data-ready', handler);
      this.mainWindow.webContents.send('stop-audio-capture');

      setTimeout(() => {
        // Only timeout if this is still the same recording session
        if (recordingIdAtStop !== this.currentRecordingId) {
          return;
        }

        ipcMain.removeListener('audio-data-ready', handler);
        if (this.isRecording || this.isStopping) {
          debugLog('[AudioRecorder] Recording timeout, resetting state');
          this.isRecording = false;
          this.isStopping = false;
          this.pendingStopPromise = null;
          if (this.onTimeoutCallback) {
            this.onTimeoutCallback();
          }
          reject(new Error('Recording timeout'));
        }
      }, 5000);
    });

    return this.pendingStopPromise;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getTempFilePath(): string {
    return path.join(this.tempDir, `recording-${Date.now()}.wav`);
  }

  async saveToFile(audioBuffer: Buffer, filePath?: string): Promise<string> {
    const outputPath = filePath || this.getTempFilePath();
    fs.writeFileSync(outputPath, audioBuffer);
    return outputPath;
  }

  cleanup(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const audioRecorder = new AudioRecorder();
