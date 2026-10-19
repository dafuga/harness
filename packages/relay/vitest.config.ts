import { resourceWorkers } from '../../src/utils/resourceWorkers';
import { defineConfig } from 'vitest/config';

/** Most tests run the Worker in workerd and talk to it over real sockets. */
export default defineConfig({
	test: {
		...resourceWorkers(),
		include: ['test/**/*.test.ts'],
		testTimeout: 30_000,
		hookTimeout: 60_000
	}
});
