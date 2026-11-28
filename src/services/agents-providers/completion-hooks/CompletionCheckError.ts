// @harness-uid u_xghv2ih7cg
/** Host-generated completion errors can be retained in run receipts. */
export class CompletionCheckError extends Error {
	override name = 'CompletionCheckError';
	constructor(
		message: string,
		readonly summary?: string
	) {
		super(message);
	}
}
