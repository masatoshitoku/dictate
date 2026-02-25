import { safeStorage, app } from 'electron';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { maskApiKeyString } from '../shared/string-utils';

const store = new Store<{
  encryptedApiKey?: string;
  apiKey?: string; // Fallback for systems without encryption
}>();

const API_KEY_ENCRYPTED = 'encryptedApiKey';
const API_KEY_PLAIN = 'apiKey';

/**
 * Check if encryption is available on this system
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Save API key securely using safeStorage (or plaintext fallback)
 */
export function saveApiKey(apiKey: string): boolean {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      store.set(API_KEY_ENCRYPTED, encrypted.toString('base64'));
      // Remove plaintext version if it exists
      store.delete(API_KEY_PLAIN);
    } else {
      // Fallback to plaintext storage (will show warning to user)
      store.set(API_KEY_PLAIN, apiKey);
    }
    return true;
  } catch (error: unknown) {
    if (!app.isPackaged) console.error('Failed to save API key:', error);
    return false;
  }
}

/**
 * Get stored API key
 * In development, also checks environment variable
 */
export function getApiKey(): string | null {
  // Development: allow environment variable override
  if (!app.isPackaged && process.env.GEMINI_API) {
    return process.env.GEMINI_API;
  }

  try {
    // Try encrypted version first
    const encrypted = store.get(API_KEY_ENCRYPTED);
    if (encrypted && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }

    // Fallback to plaintext
    const plainKey = store.get(API_KEY_PLAIN);
    if (plainKey) {
      return plainKey;
    }
  } catch (error: unknown) {
    if (!app.isPackaged) console.error('Failed to retrieve API key:', error);
  }

  return null;
}

/**
 * Check if an API key is stored
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Delete stored API key
 */
export function deleteApiKey(): void {
  store.delete(API_KEY_ENCRYPTED);
  store.delete(API_KEY_PLAIN);
}

/**
 * Validate API key by making a test request to Gemini API
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Make a minimal test request
    await model.generateContent('test');

    return { valid: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common API key errors
    if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
      return { valid: false, error: 'Invalid API key. Please check and try again.' };
    }
    if (errorMessage.includes('quota') || errorMessage.includes('RATE_LIMIT')) {
      return { valid: false, error: 'API quota exceeded. Please try again later.' };
    }

    return { valid: false, error: `Validation failed: ${errorMessage}` };
  }
}

/**
 * Get a masked version of the stored API key for display
 */
export function getMaskedApiKey(): string | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return maskApiKeyString(apiKey);
}
