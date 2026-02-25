import { BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../utils/logger';

const debugLog = createLogger('AudioRecorder');

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
    debugLog('startRecording called');

    if (!this.mainWindow) {
      debugLog('No mainWindow, aborting');
      return;
    }

    // Force reset state if stuck
    if (this.isStopping) {
      debugLog('Forcing reset of isStopping flag');
      this.isStopping = false;
      this.pendingStopPromise = null;
    }

    if (this.isRecording) {
      debugLog('Already recording, ignoring start');
      return;
    }

    this.isRecording = true;
    this.pendingStopPromise = null;
    this.currentRecordingId++; // New recording session
    debugLog(`New session ID: ${this.currentRecordingId}`);

    this.mainWindow.webContents.send('start-audio-capture');
    debugLog('Recording started');
  }

  stopRecording(): Promise<Buffer> {
    debugLog('stopRecording called');

    // If already stopping, return the pending promise
    if (this.isStopping && this.pendingStopPromise) {
      debugLog('Already stopping, returning pending promise');
      return this.pendingStopPromise;
    }

    this.pendingStopPromise = new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mainWindow) {
        debugLog(`Cannot stop: isRecording=${this.isRecording}, hasWindow=${!!this.mainWindow}`);
        // Reset state to prevent stuck state
        this.isRecording = false;
        this.isStopping = false;
        // NOTE: Do NOT null pendingStopPromise here — this runs synchronously inside
        // the Promise constructor, and the caller returns this.pendingStopPromise.
        // Nulling it would cause the caller to return null instead of a Promise.
        reject(new Error('Not recording'));
        return;
      }

      this.isStopping = true;
      const recordingIdAtStop = this.currentRecordingId;
      debugLog(`Waiting for audio data (session ${recordingIdAtStop})`);

      const handler = (_event: Electron.IpcMainEvent, audioData: ArrayBuffer) => {
        ipcMain.removeListener('audio-data-ready', handler);
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        debugLog(`Audio received, ${audioData.byteLength} bytes`);
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
          debugLog('Recording timeout, resetting state');
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
