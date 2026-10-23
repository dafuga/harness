import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// The console as one script and one stylesheet, for hosts that serve it from their own server.
export default defineConfig({
	plugins: [svelte()],
	build: {
		outDir: 'dist/console',
		emptyOutDir: true,
		cssCodeSplit: false,
		lib: {
			entry: 'src/lib/console.ts',
			formats: ['iife'],
			name: 'HarnessConsole',
			fileName: 'console'
		}
	}
});
