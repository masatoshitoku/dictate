import { BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
    console.log('[AudioRecorder] startRecording called');
    console.log('[AudioRecorder] - mainWindow exists:', !!this.mainWindow);
    console.log('[AudioRecorder] - mainWindow destroyed:', this.mainWindow?.isDestroyed());
    console.log('[AudioRecorder] - webContents exists:', !!this.mainWindow?.webContents);

    if (!this.mainWindow) {
      console.log('[AudioRecorder] No mainWindow, aborting');
      return;
    }

    // Force reset state if stuck
    if (this.isStopping) {
      console.log('[AudioRecorder] Forcing reset of isStopping flag');
      this.isStopping = false;
      this.pendingStopPromise = null;
    }

    if (this.isRecording) {
      console.log('[AudioRecorder] Already recording, ignoring start');
      return;
    }

    this.isRecording = true;
    this.pendingStopPromise = null;
    this.currentRecordingId++; // New recording session
    console.log(`[AudioRecorder] New recording session ID: ${this.currentRecordingId}`);

    console.log('[AudioRecorder] Sending start-audio-capture to renderer...');
    this.mainWindow.webContents.send('start-audio-capture');
    console.log('[AudioRecorder] Recording started, isRecording=true');
  }

  stopRecording(): Promise<Buffer> {
    console.log(`[AudioRecorder] stopRecording called`);
    console.log(`[AudioRecorder] - isRecording: ${this.isRecording}`);
    console.log(`[AudioRecorder] - isStopping: ${this.isStopping}`);
    console.log(`[AudioRecorder] - mainWindow exists: ${!!this.mainWindow}`);
    console.log(`[AudioRecorder] - mainWindow destroyed: ${this.mainWindow?.isDestroyed()}`);

    // If already stopping, return the pending promise
    if (this.isStopping && this.pendingStopPromise) {
      console.log('[AudioRecorder] Already stopping, returning pending promise');
      return this.pendingStopPromise;
    }

    this.pendingStopPromise = new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mainWindow) {
        console.log(`[AudioRecorder] Cannot stop: isRecording=${this.isRecording}, hasWindow=${!!this.mainWindow}`);
        // Reset state to prevent stuck state
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        reject(new Error('Not recording'));
        return;
      }

      this.isStopping = true;
      const recordingIdAtStop = this.currentRecordingId; // Capture ID at stop time
      console.log(`[AudioRecorder] Setting up audio-data-ready handler for session ${recordingIdAtStop}...`);

      const handler = (_event: Electron.IpcMainEvent, audioData: ArrayBuffer) => {
        console.log(`[AudioRecorder] audio-data-ready received for session ${recordingIdAtStop}!`);
        ipcMain.removeListener('audio-data-ready', handler);
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        console.log(`[AudioRecorder] Audio received, ${audioData.byteLength} bytes`);
        resolve(Buffer.from(audioData));
      };

      ipcMain.once('audio-data-ready', handler);
      console.log('[AudioRecorder] Sending stop-audio-capture to renderer...');
      this.mainWindow.webContents.send('stop-audio-capture');
      console.log('[AudioRecorder] stop-audio-capture sent, waiting for audio data...');

      setTimeout(() => {
        console.log(`[AudioRecorder] Timeout check for session ${recordingIdAtStop} - current session: ${this.currentRecordingId}, isRecording: ${this.isRecording}, isStopping: ${this.isStopping}`);

        // Only timeout if this is still the same recording session
        if (recordingIdAtStop !== this.currentRecordingId) {
          console.log(`[AudioRecorder] Ignoring timeout for old session ${recordingIdAtStop}, current is ${this.currentRecordingId}`);
          return;
        }

        ipcMain.removeListener('audio-data-ready', handler);
        if (this.isRecording || this.isStopping) {
          console.log('[AudioRecorder] Recording timeout, resetting state');
          this.isRecording = false;
          this.isStopping = false;
          this.pendingStopPromise = null;
          // Notify main process to sync its state
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
