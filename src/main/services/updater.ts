import { autoUpdater } from 'electron-updater';
import { app, dialog, net } from 'electron';
import Store from 'electron-store';
import { createLogger } from '../utils/logger';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 10000; // 10 seconds

const store = new Store<{ lastUpdateCheck: number }>({
  name: 'updater',
  defaults: { lastUpdateCheck: 0 },
});

const debugLog = createLogger('updater');

export function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    debugLog('Skipping auto-updater in development');
    return;
  }

  // Delay startup check
  setTimeout(() => {
    checkForUpdatesIfNeeded();
  }, STARTUP_DELAY_MS);
}

function checkForUpdatesIfNeeded(): void {
  // Check network connectivity
  if (!net.isOnline()) {
    debugLog('Offline, skipping update check');
    return;
  }

  // Skip if checked recently
  const lastCheck = store.get('lastUpdateCheck');
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) {
    debugLog('Checked recently, skipping');
    return;
  }

  autoUpdater.autoDownload = false; // User confirmation before download
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version ${info.version} is available. Would you like to download it?`,
      buttons: ['Download', 'Later'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    }).catch(() => { /* dialog dismissed */ });
  });

  autoUpdater.on('update-not-available', () => {
    debugLog('No update available');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'The new version has been downloaded. It will be installed when you restart the app.',
      buttons: ['Restart Now', 'Later'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    }).catch(() => { /* dialog dismissed */ });
  });

  autoUpdater.on('error', (error) => {
    const msg = error.message || String(error);
    if (msg.includes('net::') || msg.includes('ENOTFOUND')) {
      debugLog('Network error, will retry later');
    } else {
      debugLog(`Auto-updater error: ${msg}`);
    }
  });

  store.set('lastUpdateCheck', Date.now());
  autoUpdater.checkForUpdatesAndNotify();
}
