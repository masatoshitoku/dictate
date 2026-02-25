import { describe, it, expect } from 'vitest';
import { escapeAppleScript, requiresClipboardForText, maskApiKeyString } from '../shared/string-utils';

// ============================================================================
// Tests — import real functions from shared pure module
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

describe('maskApiKeyString', () => {
  it('should mask short keys completely', () => {
    expect(maskApiKeyString('12345678')).toBe('●●●●●●●●');
  });

  it('should mask keys shorter than 8 characters', () => {
    expect(maskApiKeyString('abc')).toBe('●●●');
  });

  it('should show first 4 and last 4 characters for longer keys', () => {
    expect(maskApiKeyString('AIzaSyBc123456789xyz')).toBe('AIza●●●●●●●●●●●●9xyz');
  });

  it('should handle exactly 9 character key', () => {
    const key = '123456789';
    const masked = maskApiKeyString(key);
    expect(masked).toBe('1234●6789');
  });

  it('should mask single character', () => {
    expect(maskApiKeyString('x')).toBe('●');
  });

  it('should mask empty string', () => {
    expect(maskApiKeyString('')).toBe('');
  });
});

describe('requiresClipboardForText', () => {
  it('should return false for ASCII-only text', () => {
    expect(requiresClipboardForText('hello world')).toBe(false);
  });

  it('should return false for ASCII with tabs and newlines', () => {
    expect(requiresClipboardForText('hello\tworld\n')).toBe(false);
  });

  it('should return true for Japanese text', () => {
    expect(requiresClipboardForText('こんにちは')).toBe(true);
  });

  it('should return true for emoji', () => {
    expect(requiresClipboardForText('hello 👋')).toBe(true);
  });

  it('should return true for mixed ASCII and non-ASCII', () => {
    expect(requiresClipboardForText('hello 世界')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(requiresClipboardForText('')).toBe(false);
  });

  it('should return true for control characters below 0x20', () => {
    expect(requiresClipboardForText('\x00')).toBe(true);
    expect(requiresClipboardForText('\x1F')).toBe(true);
  });
});
