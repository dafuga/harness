import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { begin } from './hub.service.native-handoff.test';

export interface Desktop {
	verifier: string;
	nonce: string;
	resource: string;
}

export type Case = Parameters<typeof recordExampleCases>[1][number];

export type Begun = Awaited<ReturnType<typeof begin>>;
