import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type RecordedCases = Parameters<typeof recordExampleCases>[1];
