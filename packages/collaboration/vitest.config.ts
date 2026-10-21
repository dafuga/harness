import { defineConfig } from 'vitest/config';
import { testWorkers } from '../../vitest.config';
export default defineConfig({ test: { ...testWorkers, include: ['test/**/*.test.ts'] } });
