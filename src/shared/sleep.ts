/**
 * Simple async sleep utility.
 * No Electron dependency — safe for shared use across main process modules.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
