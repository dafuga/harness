// @harness-uid u_2jn5g5w42t
/** Refused by the phone before anything is sent: no folder to open, or no branch tip on record. */
export class RequestRefusedError extends Error {
	override name = 'RequestRefusedError';
}
