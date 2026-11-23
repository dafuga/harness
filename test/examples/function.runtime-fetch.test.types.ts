import type { runtimeFetch } from '../../src/utils/execution-runtimes/runtimeFetch';

export type Runtime = Parameters<typeof runtimeFetch>[0];
