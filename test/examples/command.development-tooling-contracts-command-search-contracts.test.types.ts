import type { searchContracts } from '../../src/commands/development-tooling/contracts-command/searchContracts';

export type Entry = Parameters<typeof searchContracts>[0][number];
