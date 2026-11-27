import type { browserAuth } from '../../src/utils/accounts-access/browserAuth';

export type Api = Parameters<typeof browserAuth>[0];

export interface Call {
	method: string;
	path: string;
	body?: unknown;
}
