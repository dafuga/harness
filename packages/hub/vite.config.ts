import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { testWorkers } from '../../vitest.config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts']
	}
});
