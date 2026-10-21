import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { testWorkers } from '../../vitest.config';
export default defineConfig({
	test: {
		...testWorkers,
		include: ['test/**/*.test.ts'],
		setupFiles: [fileURLToPath(new URL('../../test/support/gameWorkload.ts', import.meta.url))]
	}
});
