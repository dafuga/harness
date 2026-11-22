// @harness-uid u_rw64iex44n
/** A module task CLI run that failed, or was rejected for its quota, model or tool use. */
export class ModuleTaskRunError extends Error {
	override name = 'ModuleTaskRunError';
}
