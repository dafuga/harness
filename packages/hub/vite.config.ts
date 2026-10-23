import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { profilingPlugins, testWorkers } from '../../vitest.config';

export default defineConfig(async () => ({
	plugins: [sveltekit(), ...(await profilingPlugins())],
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts']
	}
}));
