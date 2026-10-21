import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { profilingPlugins } from '../../vitest.config';

export default defineConfig(async () => ({
	plugins: [sveltekit(), ...(await profilingPlugins())],
	test: {
		include: ['test/**/*.test.ts'],
		// Run files sequentially to reduce contention between Git/process-heavy integration fixtures.
		fileParallelism: false
	}
}));
