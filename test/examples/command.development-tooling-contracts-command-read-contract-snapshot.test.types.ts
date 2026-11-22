import type { createContractHistoryReader } from '../../src/commands/development-tooling/contracts-command/readContractSnapshot';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Reader = Awaited<ReturnType<typeof createContractHistoryReader>>;

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type IdentityContract = { id: string; uid: string; kind: 'command' };
