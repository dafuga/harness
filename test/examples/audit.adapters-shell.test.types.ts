import type { shellAdapter } from '../../src/audit/development-tooling/adapters/shell';

export type ShellFile = Parameters<typeof shellAdapter.audit>[0];
