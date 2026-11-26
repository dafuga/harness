import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Failure = { name: string; message: string };

export type Cases = Parameters<typeof recordExampleCases>[1];
