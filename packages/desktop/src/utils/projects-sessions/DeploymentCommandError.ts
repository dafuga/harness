// @harness-uid u_el27gksita
/** A deployment step that could not start, or that closed with a non-zero or null code. */
export class DeploymentCommandError extends Error {
	override name = 'DeploymentCommandError';
}
