/** Host-generated completion errors can be retained in run receipts. */
export class CompletionCheckError extends Error {
	override name = 'CompletionCheckError';
}
