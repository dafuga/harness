import { resourceWorkers } from '../../src/utils/resourceWorkers';
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { ...resourceWorkers(), include: ['test/**/*.test.ts'] } });
