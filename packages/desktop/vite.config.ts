import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { profilingPlugins } from '../../vitest.config';

export default defineConfig(async () => ({
	plugins: [sveltekit(), ...(await profilingPlugins())],
	test: {
		include: ['test/**/*.test.ts'],
		setupFiles: [fileURLToPath(new URL('../../test/support/gameWorkload.ts', import.meta.url))],
		// Run files sequentially to reduce contention between Git/process-heavy integration fixtures.
		fileParallelism: false
	}
}));
