import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

export type Observed = Parameters<typeof recordExampleCases>[1];

export type Outcome =
	| { output: unknown }
	| { error: { name: string; code: string; message: string } };
