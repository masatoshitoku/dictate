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
  targetApp?: string;
}

/**
 * Get the name of the currently frontmost application
 */
export async function getFrontmostApp(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to return name of first application process whose frontmost is true',
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
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
    await setClipboardAndPaste(text, options.targetApp);
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
 * Paste from clipboard using Cmd+V via AppleScript.
 * If targetApp is provided, activates that process via System Events first.
 * Using "set frontmost of process" avoids the Automation permission dialog
 * that would appear with "tell application X to activate".
 */
export async function pasteFromClipboard(targetApp?: string): Promise<void> {
  let script: string;

  if (targetApp) {
    const safeApp = escapeAppleScript(targetApp);
    // Activate via System Events process API — requires only Accessibility permission,
    // NOT the per-app Automation permission that "tell application X to activate" needs.
    script = `
      tell application "System Events"
        try
          set frontmost of process "${safeApp}" to true
        end try
        delay 0.3
        keystroke "v" using command down
      end tell
    `;
  } else {
    script = `
      tell application "System Events"
        delay 0.2
        keystroke "v" using command down
      end tell
    `;
  }

  console.log(`[dictate] pasteFromClipboard: targetApp="${targetApp ?? '(none)'}"`);

  try {
    await execFileAsync('osascript', ['-e', script]);
    console.log('[dictate] pasteFromClipboard: success');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[dictate] pasteFromClipboard error: ${message}`);
    throw new Error('Failed to paste. Please check accessibility permissions.');
  }
}

/**
 * Set clipboard content and paste using Cmd+V
 * Uses Electron clipboard API (secure, no shell injection)
 */
export async function setClipboardAndPaste(text: string, targetApp?: string): Promise<void> {
  try {
    // Use Electron's clipboard API - secure, no shell injection
    clipboard.writeText(text);

    await sleep(PASTE_DELAY_MS);
    await pasteFromClipboard(targetApp);
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
