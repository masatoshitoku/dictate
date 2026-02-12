import { execFile } from 'child_process';
import { promisify } from 'util';
import { app, clipboard } from 'electron';

const execFileAsync = promisify(execFile);

// Constants
const TYPING_DELAYS: Record<TypingSpeed, number> = {
  instant: 0,
  fast: 10,
  natural: 50,
};
const DEFAULT_CHUNK_SIZE = 50;
const INSTANT_MODE_MAX_LENGTH = 500;
const PASTE_DELAY_MS = 100;

export type TypingSpeed = 'instant' | 'fast' | 'natural';

interface TypeTextOptions {
  speed?: TypingSpeed;
  chunkSize?: number;
}

/**
 * Escape text for use in AppleScript double-quoted strings
 */
function escapeAppleScript(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Type a chunk of text using AppleScript keystroke
 * Uses execFile to avoid shell interpretation (prevents command injection)
 */
async function typeChunk(text: string): Promise<void> {
  const escaped = escapeAppleScript(text);
  const script = `tell application "System Events" to keystroke "${escaped}"`;

  try {
    // Use execFile instead of exec to prevent shell injection
    await execFileAsync('osascript', ['-e', script]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!app.isPackaged) {
      console.error('AppleScript error:', message);
    }
    throw new Error('Failed to type text. Please check accessibility permissions.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type text into the currently focused application
 * Uses clipboard paste for non-ASCII characters (Japanese, etc.)
 * Uses keystroke for ASCII-only text
 */
export async function typeText(text: string, options: TypeTextOptions = {}): Promise<void> {
  if (!text || text.length === 0) {
    return;
  }

  // Use clipboard paste for non-ASCII characters (Japanese, emoji, etc.)
  const requiresClipboardPaste = /[^\x20-\x7E\t\n\r]/.test(text);

  if (requiresClipboardPaste) {
    await setClipboardAndPaste(text);
    return;
  }

  // ASCII-only text: use keystroke
  const { speed = 'fast', chunkSize = DEFAULT_CHUNK_SIZE } = options;
  const delay = TYPING_DELAYS[speed];

  // For instant mode with short text, type all at once
  if (speed === 'instant' && text.length <= INSTANT_MODE_MAX_LENGTH) {
    await typeChunk(text);
    return;
  }

  // Split into chunks for longer text or non-instant speeds
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i++) {
    try {
      await typeChunk(chunks[i]);
      if (delay > 0) {
        await sleep(delay);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Typing failed at chunk ${i + 1}/${chunks.length}: ${message}`);
    }
  }
}

/**
 * Paste from clipboard using Cmd+V via AppleScript
 * Uses execFile to prevent command injection
 */
export async function pasteFromClipboard(): Promise<void> {
  const script = `
    delay 0.1
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `;

  try {
    // Use execFile instead of exec to prevent shell injection
    await execFileAsync('osascript', ['-e', script]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!app.isPackaged) {
      console.error('Paste error:', message);
    }
    throw new Error('Failed to paste. Please check accessibility permissions.');
  }
}

/**
 * Set clipboard content and paste using Cmd+V
 * Uses Electron clipboard API (secure, no shell injection)
 */
export async function setClipboardAndPaste(text: string): Promise<void> {
  try {
    // Use Electron's clipboard API - secure, no shell injection
    clipboard.writeText(text);

    await sleep(PASTE_DELAY_MS);
    await pasteFromClipboard();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to set clipboard content: ${message}`);
  }
}

/**
 * Check if accessibility permission is granted
 * Required for keystroke simulation
 */
export async function checkAccessibilityPermission(): Promise<boolean> {
  const script = `
    tell application "System Events"
      keystroke ""
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script]);
    return true;
  } catch {
    return false;
  }
}
