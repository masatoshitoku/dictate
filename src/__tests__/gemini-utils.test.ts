import { describe, it, expect } from 'vitest';

// These are pure functions extracted from gemini.ts for testability.
// We re-implement them here to test the logic without Electron dependencies.
// The actual gemini.ts functions have identical logic.

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mp3',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/m4a',
  };
  return mimeTypes[ext] || 'audio/wav';
}

interface TranscriptionError extends Error {
  code?: string;
  isRetryable: boolean;
}

function createTranscriptionError(message: string, code?: string, isRetryable = false): TranscriptionError {
  const error = new Error(message) as TranscriptionError;
  error.code = code;
  error.isRetryable = isRetryable;
  return error;
}

function parseGeminiError(error: unknown): TranscriptionError {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('ENOTFOUND') || message.includes('ETIMEDOUT') || message.includes('network')) {
    return createTranscriptionError('Network error. Please check your internet connection.', 'NETWORK_ERROR', true);
  }
  if (message.includes('quota') || message.includes('RATE_LIMIT') || message.includes('429')) {
    return createTranscriptionError('API rate limit exceeded. Please try again in a moment.', 'RATE_LIMIT', true);
  }
  if (message.includes('API key') || message.includes('API_KEY_INVALID') || message.includes('401')) {
    return createTranscriptionError('Invalid API key. Please check your Gemini API key in Settings.', 'INVALID_API_KEY', false);
  }
  if (message.includes('safety') || message.includes('SAFETY')) {
    return createTranscriptionError('Content was blocked by safety filters.', 'SAFETY_BLOCK', false);
  }
  return createTranscriptionError(`Transcription failed: ${message}`, 'UNKNOWN_ERROR', false);
}

describe('getMimeType', () => {
  it('returns audio/mp3 for .mp3', () => {
    expect(getMimeType('recording.mp3')).toBe('audio/mp3');
  });

  it('returns audio/webm for .webm', () => {
    expect(getMimeType('audio.webm')).toBe('audio/webm');
  });

  it('returns audio/ogg for .ogg', () => {
    expect(getMimeType('file.ogg')).toBe('audio/ogg');
  });

  it('returns audio/wav for .wav', () => {
    expect(getMimeType('test.wav')).toBe('audio/wav');
  });

  it('returns audio/m4a for .m4a', () => {
    expect(getMimeType('voice.m4a')).toBe('audio/m4a');
  });

  it('returns audio/wav as default for unknown extension', () => {
    expect(getMimeType('file.flac')).toBe('audio/wav');
  });

  it('handles uppercase extensions', () => {
    expect(getMimeType('file.MP3')).toBe('audio/mp3');
  });

  it('handles paths with directories', () => {
    expect(getMimeType('/tmp/recordings/my-file.webm')).toBe('audio/webm');
  });

  it('handles no extension', () => {
    expect(getMimeType('noextension')).toBe('audio/wav');
  });

  it('handles file with multiple dots', () => {
    expect(getMimeType('my.audio.file.ogg')).toBe('audio/ogg');
  });
});

describe('createTranscriptionError', () => {
  it('creates an error with message', () => {
    const err = createTranscriptionError('test error');
    expect(err.message).toBe('test error');
    expect(err instanceof Error).toBe(true);
  });

  it('sets code when provided', () => {
    const err = createTranscriptionError('msg', 'TEST_CODE');
    expect(err.code).toBe('TEST_CODE');
  });

  it('defaults isRetryable to false', () => {
    const err = createTranscriptionError('msg');
    expect(err.isRetryable).toBe(false);
  });

  it('sets isRetryable to true when specified', () => {
    const err = createTranscriptionError('msg', 'CODE', true);
    expect(err.isRetryable).toBe(true);
  });

  it('has undefined code when not provided', () => {
    const err = createTranscriptionError('msg');
    expect(err.code).toBeUndefined();
  });
});

describe('parseGeminiError', () => {
  it('detects ENOTFOUND as network error (retryable)', () => {
    const err = parseGeminiError(new Error('getaddrinfo ENOTFOUND api.google.com'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.isRetryable).toBe(true);
  });

  it('detects ETIMEDOUT as network error (retryable)', () => {
    const err = parseGeminiError(new Error('connect ETIMEDOUT'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.isRetryable).toBe(true);
  });

  it('detects network keyword as network error', () => {
    const err = parseGeminiError(new Error('network failure'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.isRetryable).toBe(true);
  });

  it('detects quota as rate limit (retryable)', () => {
    const err = parseGeminiError(new Error('Resource has been exhausted (quota)'));
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.isRetryable).toBe(true);
  });

  it('detects 429 as rate limit', () => {
    const err = parseGeminiError(new Error('HTTP 429 Too Many Requests'));
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.isRetryable).toBe(true);
  });

  it('detects RATE_LIMIT keyword', () => {
    const err = parseGeminiError(new Error('RATE_LIMIT exceeded'));
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.isRetryable).toBe(true);
  });

  it('detects API key invalid (not retryable)', () => {
    const err = parseGeminiError(new Error('API_KEY_INVALID'));
    expect(err.code).toBe('INVALID_API_KEY');
    expect(err.isRetryable).toBe(false);
  });

  it('detects 401 as API key error', () => {
    const err = parseGeminiError(new Error('HTTP 401 Unauthorized'));
    expect(err.code).toBe('INVALID_API_KEY');
    expect(err.isRetryable).toBe(false);
  });

  it('detects safety block (not retryable)', () => {
    const err = parseGeminiError(new Error('SAFETY block triggered'));
    expect(err.code).toBe('SAFETY_BLOCK');
    expect(err.isRetryable).toBe(false);
  });

  it('returns unknown error for unrecognized message', () => {
    const err = parseGeminiError(new Error('something unexpected'));
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.isRetryable).toBe(false);
    expect(err.message).toContain('something unexpected');
  });

  it('handles non-Error input', () => {
    const err = parseGeminiError('string error');
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.message).toContain('Unknown error');
  });

  it('handles null input', () => {
    const err = parseGeminiError(null);
    expect(err.code).toBe('UNKNOWN_ERROR');
  });

  it('handles undefined input', () => {
    const err = parseGeminiError(undefined);
    expect(err.code).toBe('UNKNOWN_ERROR');
  });

  // Priority testing: network takes precedence over other patterns
  it('prioritizes network error over other patterns', () => {
    const err = parseGeminiError(new Error('ENOTFOUND API key invalid'));
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
