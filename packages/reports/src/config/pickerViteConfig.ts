import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	build: {
		outDir: 'dist/picker',
		emptyOutDir: true,
		cssCodeSplit: false,
		lib: {
			entry: 'src/utils/providerPickerEntry.ts',
			formats: ['iife'],
			name: 'HarnessPicker',
			fileName: 'picker'
		}
	}
});
