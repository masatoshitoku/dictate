import { describe, it, expect } from 'vitest';

// ============================================================================
// Test Utilities - Pure Functions
// ============================================================================

/**
 * Escape text for use in AppleScript double-quoted strings
 * (Extracted for testing purposes)
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
 * Get a masked version of the API key for display
 * (Extracted for testing purposes)
 */
function getMaskedApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null;

  if (apiKey.length <= 8) {
    return '●'.repeat(apiKey.length);
  }

  return apiKey.substring(0, 4) + '●'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}

/**
 * Check if text requires clipboard paste (non-ASCII)
 */
function requiresClipboardPaste(text: string): boolean {
  return /[^\x20-\x7E\t\n\r]/.test(text);
}

// ============================================================================
// Tests
// ============================================================================

describe('escapeAppleScript', () => {
  it('should escape backslashes', () => {
    expect(escapeAppleScript('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('should escape double quotes', () => {
    expect(escapeAppleScript('say "hello"')).toBe('say \\"hello\\"');
  });

  it('should escape newlines', () => {
    expect(escapeAppleScript('line1\nline2')).toBe('line1\\nline2');
  });

  it('should escape carriage returns', () => {
    expect(escapeAppleScript('line1\rline2')).toBe('line1\\rline2');
  });

  it('should escape tabs', () => {
    expect(escapeAppleScript('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('should handle multiple escape sequences', () => {
    expect(escapeAppleScript('say "hello\\world"\n')).toBe('say \\"hello\\\\world\\"\\n');
  });

  it('should handle empty string', () => {
    expect(escapeAppleScript('')).toBe('');
  });

  it('should not modify plain text', () => {
    expect(escapeAppleScript('hello world')).toBe('hello world');
  });
});

describe('getMaskedApiKey', () => {
  it('should return null for null input', () => {
    expect(getMaskedApiKey(null)).toBeNull();
  });

  it('should mask short keys completely', () => {
    expect(getMaskedApiKey('12345678')).toBe('●●●●●●●●');
  });

  it('should mask keys shorter than 8 characters', () => {
    expect(getMaskedApiKey('abc')).toBe('●●●');
  });

  it('should show first 4 and last 4 characters for longer keys', () => {
    // 'AIzaSyBc123456789xyz' is 20 characters: 4 + 12 + 4 = 20
    expect(getMaskedApiKey('AIzaSyBc123456789xyz')).toBe('AIza●●●●●●●●●●●●9xyz');
  });

  it('should handle exactly 9 character key', () => {
    const key = '123456789';
    const masked = getMaskedApiKey(key);
    expect(masked).toBe('1234●6789');
  });
});

describe('requiresClipboardPaste', () => {
  it('should return false for ASCII-only text', () => {
    expect(requiresClipboardPaste('hello world')).toBe(false);
  });

  it('should return false for ASCII with tabs and newlines', () => {
    expect(requiresClipboardPaste('hello\tworld\n')).toBe(false);
  });

  it('should return true for Japanese text', () => {
    expect(requiresClipboardPaste('こんにちは')).toBe(true);
  });

  it('should return true for emoji', () => {
    expect(requiresClipboardPaste('hello 👋')).toBe(true);
  });

  it('should return true for mixed ASCII and non-ASCII', () => {
    expect(requiresClipboardPaste('hello 世界')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(requiresClipboardPaste('')).toBe(false);
  });

  it('should return true for control characters below 0x20', () => {
    expect(requiresClipboardPaste('\x00')).toBe(true);
    expect(requiresClipboardPaste('\x1F')).toBe(true);
  });
});
