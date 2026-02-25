import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main/**/*', // Electron main process needs different testing approach
        'src/preload/**/*',
      ],
      thresholds: {
        // Enforce minimum coverage for shared modules (testable without Electron)
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
