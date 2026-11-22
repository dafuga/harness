// @harness-uid u_vcijuxvzhw
/** The committed task source changed while its completion audit was running. */
export class TaskSourceChangedError extends Error {
	override name = 'TaskSourceChangedError';
}
