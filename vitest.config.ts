import { defineConfig } from 'vitest/config';
import HarnessCaseReporter from './test/support/harnessCaseReporter.js';
export default defineConfig({
	test: { maxWorkers: 1, reporters: ['default', new HarnessCaseReporter()] }
});
