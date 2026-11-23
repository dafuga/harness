import type { recordExampleCases } from '../support/recordExampleCases';

export type Case = Parameters<typeof recordExampleCases>[1][number];
