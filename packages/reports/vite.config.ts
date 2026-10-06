import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: { host: '127.0.0.1', port: 5588 },
	test: {
		include: ['test/**/*.test.ts'],
		environment: 'node',
		env: {
			PROJECT_REPORTS_ASSET_STORAGE: 'local',
			PROJECT_REPORTS_HOME: '/tmp/project-reports-unit'
		}
	}
});
