// @harness-uid u_gnssflbak6
/** A request object or field that failed its check; the message says which check failed. */
export class IpcFieldError extends Error {
	override name = 'IpcFieldError';
}
