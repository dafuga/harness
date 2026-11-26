import type { explorerCategory } from '../../src/utils/explorer-ui/explorerCategory';
import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Subject = Parameters<typeof explorerCategory>[0];

export type Row = [name: string, subject: Subject, expected: string | null];

export type Cases = Parameters<typeof recordExampleCases>[1];
