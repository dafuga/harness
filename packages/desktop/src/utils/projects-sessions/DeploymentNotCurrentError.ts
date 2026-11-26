// @harness-uid u_chssxwles4
/** A reviewed deployment plan that is no longer current and must be reviewed again. */
export class DeploymentNotCurrentError extends Error {
	override name = 'DeploymentNotCurrentError';
}
