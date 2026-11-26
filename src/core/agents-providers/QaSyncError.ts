// @harness-uid u_yiixaxqovk
/** A QA sync refusal whose message is safe to print: it never carries a token or Slack text. */
export class QaSyncError extends Error {
	override readonly name = 'QaSyncError';
}
