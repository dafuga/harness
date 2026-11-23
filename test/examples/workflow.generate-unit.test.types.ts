import type { recordExampleCases } from '../support/recordExampleCases';

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
