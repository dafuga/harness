import { defineConfig } from 'vitest/config';
export default defineConfig({
	test: { setupFiles: ['test/setup.ts'], exclude: ['packages/**', 'node_modules/**', 'dist/**'] }
});
