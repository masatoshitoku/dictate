/**
 * Pure utility functions for Gemini error handling and MIME type detection.
 * Extracted from gemini.ts so tests can import real production code
 * without Electron dependencies.
 */

// ============================================================================
// Types
// ============================================================================

export interface TranscriptionError extends Error {
  code?: string;
  isRetryable: boolean;
}

// ============================================================================
// Functions
// ============================================================================

export function getMimeType(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const ext = lastDot === -1 ? '' : filePath.substring(lastDot).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mp3',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/m4a',
  };
  return mimeTypes[ext] || 'audio/wav';
}

export function createTranscriptionError(message: string, code?: string, isRetryable = false): TranscriptionError {
  const error = new Error(message) as TranscriptionError;
  error.code = code;
  error.isRetryable = isRetryable;
  return error;
}

export function parseGeminiError(error: unknown): TranscriptionError {
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
