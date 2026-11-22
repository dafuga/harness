// @harness-uid u_oiafoy4z3i
/** An input file that is not a regular file or exceeds the byte limit, so it is unreadable. */
export class UnreadableInputFileError extends Error {
	override name = 'UnreadableInputFileError';
}
