import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
	plugins: [svelte()],
	build: {
		outDir: 'dist/viewer',
		emptyOutDir: true,
		cssCodeSplit: false,
		lib: {
			entry: 'src/lib/portable.ts',
			formats: ['iife'],
			name: 'ProjectReportViewer',
			fileName: 'report'
		}
	}
});
