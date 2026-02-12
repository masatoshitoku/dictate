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

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'typeless-clone');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  startRecording(): void {
    if (this.isRecording || this.isStopping || !this.mainWindow) return;

    this.isRecording = true;
    this.isStopping = false;
    this.pendingStopPromise = null;
    this.mainWindow.webContents.send('start-audio-capture');
  }

  stopRecording(): Promise<Buffer> {
    // If already stopping, return the pending promise
    if (this.isStopping && this.pendingStopPromise) {
      return this.pendingStopPromise;
    }

    this.pendingStopPromise = new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mainWindow) {
        reject(new Error('Not recording'));
        return;
      }

      this.isStopping = true;

      const handler = (_event: Electron.IpcMainEvent, audioData: ArrayBuffer) => {
        ipcMain.removeListener('audio-data-ready', handler);
        this.isRecording = false;
        this.isStopping = false;
        this.pendingStopPromise = null;
        resolve(Buffer.from(audioData));
      };

      ipcMain.on('audio-data-ready', handler);
      this.mainWindow.webContents.send('stop-audio-capture');

      setTimeout(() => {
        ipcMain.removeListener('audio-data-ready', handler);
        if (this.isRecording || this.isStopping) {
          this.isRecording = false;
          this.isStopping = false;
          this.pendingStopPromise = null;
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
