// @harness-uid u_vywguk6j2s
export class ExpectedCliError extends Error {
	override name = 'ExpectedCliError';
}

export function fail(message: string): never {
	throw new ExpectedCliError(message);
}

export function isExpectedCliError(error: unknown): error is ExpectedCliError {
	return error instanceof ExpectedCliError;
}
