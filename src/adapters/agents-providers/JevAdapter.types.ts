import type { Fetch } from '@typesafe-ai/sdk';

export interface JevAdapterConfig {
	apiKey: string;
	model: string;
	fetch?: Fetch;
	timeout?: number;
	maxRetries?: number;
}
