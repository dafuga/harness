import { APIError, TypeSafeClient } from '@typesafe-ai/sdk';
import type { Fetch } from '@typesafe-ai/sdk';
import type { JevEvaluation, JevRequest } from '../audit/cleanCodeTypes';
import { CleanCodeResponseValidator } from '../validators/CleanCodeResponseValidator';

export interface JevAdapterConfig {
	apiKey: string;
	model: string;
	fetch?: Fetch;
	timeout?: number;
	maxRetries?: number;
}

export class JevAdapter {
	private readonly client: TypeSafeClient;
	private readonly validator = new CleanCodeResponseValidator();

	constructor(private readonly config: JevAdapterConfig) {
		this.client = new TypeSafeClient({
			apiKey: config.apiKey,
			baseURL: 'https://api.typesafe.ai',
			defaultModel: config.model,
			fetch: config.fetch,
			timeout: config.timeout ?? 10000,
			retry: { maxRetries: config.maxRetries ?? 2, maxRetryAfterMs: 5000 },
			logLevel: 'error',
			logger: { debug() {}, info() {}, warn() {}, error() {} }
		});
	}

	async evaluate(request: JevRequest, signal?: AbortSignal): Promise<JevEvaluation> {
		if (signal?.aborted) throw new Error('Jev review was cancelled or timed out.');
		const deadline = AbortSignal.timeout(30000);
		const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
		try {
			const raw: unknown = await this.client.systemOne(
				{ ...request, model: this.config.model },
				{ signal: combined }
			);
			const result = this.validator.validate(raw, request.questions);
			if (
				this.config.model !== 'jev-latest' &&
				this.config.model !== 'jev-preview' &&
				result.model !== this.config.model
			)
				throw new Error('Model mismatch');
			return result;
		} catch (error) {
			if (error instanceof APIError) throw new Error(`Jev request failed (HTTP ${error.status}).`);
			if (combined.aborted) throw new Error('Jev review was cancelled or timed out.');
			throw new Error('Jev request or response validation failed.');
		}
	}
}
