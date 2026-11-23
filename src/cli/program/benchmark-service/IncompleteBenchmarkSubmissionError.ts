// @harness-uid u_cmhcvcbkcz
/** A benchmark submission whose provider events lack a session or a successful completion. */
export class IncompleteBenchmarkSubmissionError extends Error {
	override name = 'IncompleteBenchmarkSubmissionError';
}
