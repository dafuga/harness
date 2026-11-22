// @harness-uid u_wbj45qwkyz
import type { Fetch } from '@typesafe-ai/sdk';

export interface JevAdapterConfig {
	apiKey: string;
	model: string;
	fetch?: Fetch;
	timeout?: number;
	maxRetries?: number;
}
/** A Jev evaluation that was cancelled, timed out, rejected by the API, or failed validation. */
export class JevEvaluationError extends Error {
	override name = 'JevEvaluationError';
}
