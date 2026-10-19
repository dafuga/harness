import { resourceWorkers } from '../../src/utils/resourceWorkers';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		...resourceWorkers(),
		include: ['test/**/*.test.ts'],
		// Run files sequentially to reduce contention between Git/process-heavy integration fixtures.
		fileParallelism: false
	}
});
