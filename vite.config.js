import { defineConfig } from 'vite';

/**
 * Vite and Vitest configuration for ChromaSense.
 * Configured with network host access for iPhone testing and happy-dom for headless test execution.
 */
export default defineConfig({
  base: process.env.BASE_PATH || (process.env.NODE_ENV === 'production' ? '/practice-app/' : '/'),
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
