import { resourceWorkers } from '../../src/utils/resourceWorkers';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		...resourceWorkers(),
		include: ['test/**/*.test.ts']
	}
});
