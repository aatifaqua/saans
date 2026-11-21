import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * The server hosts the built app on its own origin, so the bundle calls `/api` relatively and
 * needs no CORS. In development Vite forwards `/api` to the local server on port 8080.
 */
export default defineConfig({
  plugins: [svelte()],
  build: { target: 'es2022' },
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
