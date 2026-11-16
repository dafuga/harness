// @harness-uid u_cb75ddl7us
export class CodexConnectionClosedError extends Error {
	override name = 'CodexConnectionClosedError';
}

export class CodexMessageTooLargeError extends Error {
	override name = 'CodexMessageTooLargeError';
}
