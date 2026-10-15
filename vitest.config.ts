import { defineConfig } from 'vitest/config';
export default defineConfig({
	test: {
		// A fresh checkout has no generated SvelteKit configs; root tests resolve them.
		globalSetup: ['test/svelteKitConfigs.ts'],
		setupFiles: ['test/setup.ts'],
		exclude: ['packages/**', 'node_modules/**', 'dist/**', 'work/**']
	}
});
