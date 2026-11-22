// @harness-uid u_4e2qiqzg5i
/** A counter interval that cannot yield available cores, such as a reset or a changed quota. */
export class CpuIntervalError extends Error {
	override name = 'CpuIntervalError';
}
