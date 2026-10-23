import { defineConfig } from 'vitest/config';
import { profilingPlugins, testWorkers } from '../../vitest.config';

/** Most tests run the Worker in workerd and talk to it over real sockets. */
export default defineConfig(async () => ({
	plugins: await profilingPlugins(),
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts'],
		testTimeout: 30_000,
		hookTimeout: 60_000
	}
}));
