// @harness-uid u_vywguk6j2s
export class ExpectedCliError extends Error {
	override name = 'ExpectedCliError';
}

export function fail(message: string): never {
	throw new ExpectedCliError(message);
}

/** Accepts any value and keeps its type; a true result narrows it to ExpectedCliError. */
export function isExpectedCliError<T>(error: T): error is T & ExpectedCliError {
	return error instanceof ExpectedCliError;
}
