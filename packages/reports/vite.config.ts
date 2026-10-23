import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { testWorkers } from '../../vitest.config';

export default defineConfig({
	plugins: [sveltekit()],
	server: { host: '127.0.0.1', port: 5588 },
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts'],
		environment: 'node',
		fileParallelism: !process.env.CI,
		env: {
			...testWorkers.env,
			PROJECT_REPORTS_ASSET_STORAGE: 'local',
			PROJECT_REPORTS_HOME: '/tmp/project-reports-unit'
		}
	}
});
