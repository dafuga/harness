// @harness-uid u_inny3zqpds
/** A deployment execution stopped by its plan blockers, or by a failed health check before its receipt was saved. */
export class DeploymentExecutionError extends Error {
	override name = 'DeploymentExecutionError';
}
