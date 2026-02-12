import { globalShortcut } from 'electron';

type ShortcutCallback = () => void;

class ShortcutManager {
  private registeredShortcuts: Map<string, ShortcutCallback> = new Map();

  register(accelerator: string, callback: ShortcutCallback): boolean {
    if (this.registeredShortcuts.has(accelerator)) {
      this.unregister(accelerator);
    }

    const success = globalShortcut.register(accelerator, callback);

    if (success) {
      this.registeredShortcuts.set(accelerator, callback);
      console.log(`Shortcut registered: ${accelerator}`);
    } else {
      console.error(`Failed to register shortcut: ${accelerator}`);
    }

    return success;
  }

  unregister(accelerator: string): void {
    if (this.registeredShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(accelerator);
      console.log(`Shortcut unregistered: ${accelerator}`);
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
    console.log('All shortcuts unregistered');
  }

  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts.keys());
  }
}

export const shortcutManager = new ShortcutManager();

export function setupDefaultShortcuts(
  onToggleRecording: () => void,
  onCancelRecording: () => void,
  onOpenSettings?: () => void
): void {
  shortcutManager.register('Alt+Space', onToggleRecording);

  shortcutManager.register('Escape', onCancelRecording);

  if (onOpenSettings) {
    // Use F2 as settings shortcut (less likely to conflict)
    shortcutManager.register('F2', onOpenSettings);
  }
}
