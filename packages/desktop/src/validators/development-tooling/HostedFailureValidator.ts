/** Safe transport errors retain only the category needed for cache policy. */
export class HostedFailureValidator extends Error {
	constructor(
		readonly category: 'offline' | 'denied' | 'failed',
		readonly status = 0
	) {
		super('Hosted request failed or access was refused.');
	}

	static classify(error: unknown): HostedFailureValidator {
		if (error instanceof HostedFailureValidator) return error;
		const cause =
			error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
		const offline = [
			'ECONNREFUSED',
			'ENOTFOUND',
			'EAI_AGAIN',
			'ENETUNREACH',
			'EHOSTUNREACH',
			'ECONNRESET',
			'UND_ERR_SOCKET'
		];
		return new HostedFailureValidator(offline.includes(cause?.code ?? '') ? 'offline' : 'failed');
	}
}
