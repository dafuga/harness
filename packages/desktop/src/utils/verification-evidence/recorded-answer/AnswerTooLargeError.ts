// @harness-uid u_lkzrod2wrf
/** An answer too large for one message of any transport, refused rather than cut short. */
export class AnswerTooLargeError extends Error {
	override name = 'AnswerTooLargeError';
}
