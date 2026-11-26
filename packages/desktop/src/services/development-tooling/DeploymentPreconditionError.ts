// @harness-uid u_sbr2ymmwy7
/** A deployment refused before it starts because a precondition is not met. */
export class DeploymentPreconditionError extends Error {
	override name = 'DeploymentPreconditionError';
}
