/**
 * Pure string utility functions.
 * Extracted from main process modules for testability (no Electron dependencies).
 */

/**
 * Escape text for use in AppleScript double-quoted strings
 */
export function escapeAppleScript(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Check if text requires clipboard paste (contains non-ASCII characters)
 */
export function requiresClipboardForText(text: string): boolean {
  return /[^\x20-\x7E\t\n\r]/.test(text);
}

/**
 * Mask an API key string for display (pure function, no side effects).
 * Shows first 4 and last 4 characters, masks the rest.
 */
export function maskApiKeyString(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '●'.repeat(apiKey.length);
  }
  return apiKey.substring(0, 4) + '●'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}
