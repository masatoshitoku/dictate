import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create a prefixed debug logger that is suppressed in production builds.
 * All main-process modules should use this instead of direct console.log.
 */
export function createLogger(prefix: string) {
  return function debugLog(msg: string): void {
    if (app.isPackaged) return;
    try {
      console.log(`[${prefix}] ${msg}`);
    } catch {
      // Ignore EPIPE errors when stdout is closed
    }
  };
}

/**
 * Log a critical error to a file unconditionally (even in production).
 * Used by global error handlers so production crashes are not invisible.
 */
export function logCriticalError(prefix: string, error: Error | string): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : error;
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${prefix}] ${message}\n`;

  try {
    const logDir = app.getPath('logs');
    const logFile = path.join(logDir, 'dictate-errors.log');
    fs.appendFileSync(logFile, line);
  } catch {
    // Last resort: write to stderr (EPIPE-safe)
    try { process.stderr.write(line); } catch { /* truly nothing we can do */ }
  }
}
