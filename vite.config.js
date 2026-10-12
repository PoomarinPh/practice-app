import { defineConfig } from 'vite';

/**
 * Vite and Vitest configuration for ChromaSense.
 * Configured with network host access for iPhone testing and happy-dom for headless test execution.
 */
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
