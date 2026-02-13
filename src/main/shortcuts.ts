import { globalShortcut } from 'electron';
import type { ShortcutSettings } from '../shared/types';
import { DEFAULT_SHORTCUTS } from '../shared/types';

type ShortcutCallback = () => void;

interface ShortcutCallbacks {
  onToggleRecording: () => void;
  onCancelRecording: () => void;
  onOpenSettings?: () => void;
}

class ShortcutManager {
  private registeredShortcuts: Map<string, ShortcutCallback> = new Map();
  private callbacks: ShortcutCallbacks | null = null;
  private currentSettings: ShortcutSettings = DEFAULT_SHORTCUTS;
  private isPaused: boolean = false;

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

  setCallbacks(callbacks: ShortcutCallbacks): void {
    this.callbacks = callbacks;
  }

  getCurrentSettings(): ShortcutSettings {
    return { ...this.currentSettings };
  }

  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    globalShortcut.unregisterAll();
    console.log('Shortcuts paused');
  }

  resume(): void {
    if (!this.isPaused || !this.callbacks) return;
    this.isPaused = false;

    // Re-register all shortcuts
    this.register(this.currentSettings.toggleRecording, this.callbacks.onToggleRecording);
    this.register(this.currentSettings.cancelRecording, this.callbacks.onCancelRecording);
    if (this.callbacks.onOpenSettings) {
      this.register(this.currentSettings.openSettings, this.callbacks.onOpenSettings);
    }
    console.log('Shortcuts resumed');
  }

  updateShortcuts(settings: ShortcutSettings): boolean {
    if (!this.callbacks) {
      console.error('Callbacks not set');
      return false;
    }

    // Unregister all current shortcuts
    this.unregisterAll();

    // Register new shortcuts
    const results: boolean[] = [];

    results.push(this.register(settings.toggleRecording, this.callbacks.onToggleRecording));
    results.push(this.register(settings.cancelRecording, this.callbacks.onCancelRecording));

    if (this.callbacks.onOpenSettings) {
      results.push(this.register(settings.openSettings, this.callbacks.onOpenSettings));
    }

    // Update current settings if all succeeded
    if (results.every(Boolean)) {
      this.currentSettings = { ...settings };
      return true;
    }

    // Rollback to previous settings on failure
    this.unregisterAll();
    this.register(this.currentSettings.toggleRecording, this.callbacks.onToggleRecording);
    this.register(this.currentSettings.cancelRecording, this.callbacks.onCancelRecording);
    if (this.callbacks.onOpenSettings) {
      this.register(this.currentSettings.openSettings, this.callbacks.onOpenSettings);
    }

    return false;
  }
}

export const shortcutManager = new ShortcutManager();

export function setupShortcuts(
  callbacks: ShortcutCallbacks,
  settings?: ShortcutSettings
): void {
  const shortcuts = settings || DEFAULT_SHORTCUTS;

  shortcutManager.setCallbacks(callbacks);
  shortcutManager.updateShortcuts(shortcuts);
}

// Keep for backward compatibility
export function setupDefaultShortcuts(
  onToggleRecording: () => void,
  onCancelRecording: () => void,
  onOpenSettings?: () => void
): void {
  setupShortcuts({
    onToggleRecording,
    onCancelRecording,
    onOpenSettings,
  });
}
