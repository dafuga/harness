import type { hubRuntime } from '../../src/routes/api/[...path]/hubRuntime';

export type Env = Parameters<typeof hubRuntime>[0];
