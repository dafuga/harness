import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['test/**/*.test.ts'],
		setupFiles: [fileURLToPath(new URL('../../test/support/gameWorkload.ts', import.meta.url))],
		// Run files sequentially to reduce contention between Git/process-heavy integration fixtures.
		fileParallelism: false
	}
});
