import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { profilingPlugins, testWorkers } from '../../vitest.config';
export default defineConfig(async () => ({
	plugins: await profilingPlugins(),
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts'],
		setupFiles: [fileURLToPath(new URL('../../test/support/gameWorkload.ts', import.meta.url))]
	}
}));
