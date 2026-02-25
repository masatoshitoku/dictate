import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1 MB

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
 * Rotate the log file if it exceeds MAX_LOG_SIZE_BYTES.
 * Renames current file to .old (overwriting any existing .old).
 */
function rotateIfNeeded(logFile: string): void {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_SIZE_BYTES) {
      const rotated = logFile + '.old';
      fs.renameSync(logFile, rotated);
    }
  } catch {
    // File may not exist yet — that's fine
  }
}

/**
 * Log a critical error to a file unconditionally (even in production).
 * Used by global error handlers and service-level fatal errors
 * so production failures are not invisible.
 * Includes log rotation: file is rotated when it exceeds 1 MB.
 */
export function logCriticalError(prefix: string, error: Error | string): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : error;
  const timestamp = new Date().toISOString();
  const meta = `v${app.getVersion()} ${process.platform}/${process.arch} ${os.release()}`;
  const line = `[${timestamp}] [${prefix}] [${meta}] ${message}\n`;

  try {
    const logDir = app.getPath('logs');
    const logFile = path.join(logDir, 'dictate-errors.log');
    rotateIfNeeded(logFile);
    fs.appendFileSync(logFile, line);
  } catch {
    // Last resort: write to stderr (EPIPE-safe)
    try { process.stderr.write(line); } catch { /* truly nothing we can do */ }
  }
}
