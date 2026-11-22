import type { isolatedChild } from '../../src/utils/reports-media/run-isolated/isolatedChild';

export type IsolatedRun = Parameters<typeof isolatedChild>[0];

export type ChildProcess = ReturnType<typeof isolatedChild>;
