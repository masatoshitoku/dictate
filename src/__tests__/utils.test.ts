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

  // Boundary tests
  it('should handle null byte (\\0)', () => {
    // Null bytes pass through — AppleScript handles them at the OS level
    expect(escapeAppleScript('\x00')).toBe('\x00');
  });

  it('should handle very long string', () => {
    const long = 'a'.repeat(10000);
    expect(escapeAppleScript(long)).toBe(long);
  });

  it('should handle string of only special characters', () => {
    expect(escapeAppleScript('\\\"\n\r\t')).toBe('\\\\\\\"\\n\\r\\t');
  });

  it('should handle Unicode characters without escaping', () => {
    // Non-ASCII characters are not escaped — they pass through for clipboard routing
    expect(escapeAppleScript('こんにちは')).toBe('こんにちは');
  });

  it('should preserve output length consistency', () => {
    const input = 'a"b';
    const output = escapeAppleScript(input);
    // Each " becomes \", so output should be 2 chars longer
    expect(output.length).toBe(input.length + 1);
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

  it('should handle exactly 9 character key (boundary)', () => {
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

  // Boundary tests
  it('should handle exactly 8 character key (boundary: all masked)', () => {
    expect(maskApiKeyString('ABCDEFGH')).toBe('●●●●●●●●');
  });

  it('should preserve total length for any input', () => {
    for (const key of ['', 'a', 'ab', 'abcdefgh', 'abcdefghi', 'a'.repeat(100)]) {
      expect(maskApiKeyString(key).length).toBe(key.length);
    }
  });

  it('should show correct first 4 and last 4 for 10-char key', () => {
    expect(maskApiKeyString('1234567890')).toBe('1234●●7890');
  });

  it('should handle very long API key', () => {
    const key = 'sk-' + 'a'.repeat(97);
    const masked = maskApiKeyString(key);
    expect(masked.startsWith('sk-a')).toBe(true);
    expect(masked.endsWith('a'.repeat(4))).toBe(true);
    expect(masked.length).toBe(key.length);
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

  // Boundary tests
  it('should return false for all printable ASCII characters', () => {
    // Space (0x20) through tilde (0x7E) are the printable ASCII range
    let printableAscii = '';
    for (let i = 0x20; i <= 0x7E; i++) {
      printableAscii += String.fromCharCode(i);
    }
    expect(requiresClipboardForText(printableAscii)).toBe(false);
  });

  it('should return true for DEL character (0x7F)', () => {
    expect(requiresClipboardForText('\x7F')).toBe(true);
  });

  it('should return true for surrogate pair (emoji)', () => {
    expect(requiresClipboardForText('🎵')).toBe(true);
  });

  it('should return true for zero-width joiner', () => {
    expect(requiresClipboardForText('\u200D')).toBe(true);
  });

  it('should return false for carriage return only', () => {
    expect(requiresClipboardForText('\r')).toBe(false);
  });

  it('should return true for combining characters', () => {
    // Combining diacritical marks are above 0x7E
    expect(requiresClipboardForText('e\u0301')).toBe(true); // é as e + combining accent
  });
});
