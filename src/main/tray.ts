import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';

interface TrayManagerConfig {
  onToggleRecording: () => void;
  onShowWindow: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

class TrayManager {
  private tray: Tray | null = null;
  private isRecording = false;

  create(config: TrayManagerConfig): Tray {
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon.resize({ width: 18, height: 18 }));
    this.tray.setToolTip('Typeless Clone - Voice Dictation');

    this.updateMenu(config);

    this.tray.on('click', () => {
      config.onShowWindow();
    });

    return this.tray;
  }

  private getIconPath(): string {
    const isDev = !app.isPackaged;
    if (isDev) {
      // In dev mode, __dirname is dist/main, so go up to project root
      return path.join(process.cwd(), 'resources/tray-icon.png');
    }
    return path.join(process.resourcesPath, 'resources/tray-icon.png');
  }

  private updateMenu(config: TrayManagerConfig): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.isRecording ? 'Stop Recording' : 'Start Recording',
        click: config.onToggleRecording,
        accelerator: 'Alt+Space',
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: config.onShowWindow,
      },
      {
        label: 'Settings...',
        click: config.onOpenSettings,
        accelerator: 'CommandOrControl+,',
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: config.onQuit,
        accelerator: 'CommandOrControl+Q',
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  setRecordingState(isRecording: boolean, config: TrayManagerConfig): void {
    this.isRecording = isRecording;
    this.updateMenu(config);

    if (this.tray) {
      this.tray.setToolTip(
        isRecording
          ? 'Typeless Clone - Recording...'
          : 'Typeless Clone - Voice Dictation'
      );
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
