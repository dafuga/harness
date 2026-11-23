// @harness-uid u_4c6cbv56v5
/** A kernel server that timed out, exited, or sent invalid readiness data before it was ready. */
export class KernelServerStartupError extends Error {
	override name = 'KernelServerStartupError';
}
