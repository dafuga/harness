import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Case = Parameters<typeof recordExampleCases>[1][number];
