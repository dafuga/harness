import type { recordExampleCases } from '../support/recordExampleCases';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Outcome =
	| { ok: true; value: unknown }
	| { ok: false; error: { name: string; message: string } };
